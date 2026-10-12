import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const st=vi.hoisted(()=>({status:'waiting_external',remaining:1,permission:true,queries:[] as string[],events:[] as any[],transactions:0}));
const dialect=new MySqlDialect();
const db={execute:vi.fn(async(q:any)=>{const text=dialect.sqlToQuery(q).sql;st.queries.push(text);if(text.includes('project_id AS projectId'))return [[{projectId:6,workFileId:390001}]];if(text.includes('action_status AS status'))return [[{id:9,title:'شاهد — انتظار المستند',status:st.status,updatedAt:'2026-10-12 10:00:00'}]];if(text.includes('AS actions'))return [[{actions:st.remaining,decisions:0,directives:0,lanes:0}]];if(text.includes("SET action_status='verified'"))st.status='verified';return [[]];}),transaction:vi.fn(async(fn:any)=>{st.transactions++;const before=st.status;try{return await fn(db)}catch(e){st.status=before;throw e}})};
vi.mock('./db',()=>({getDb:async()=>db}));
vi.mock('./services/comoNextCommands',()=>({requireProjectAccess:vi.fn(async()=>{if(!st.permission)throw Error('no_access')}),appendEvent:vi.fn(async(_tx:any,event:any)=>st.events.push(event))}));
import {confirmActionReceiptCommand} from './services/comoKitchenReceipts';
beforeEach(()=>{st.status='waiting_external';st.remaining=1;st.permission=true;st.queries=[];st.events=[];st.transactions=0;vi.clearAllMocks()});
describe('one-click owner receipt',()=>{
 it('closes the exact waiting action with an owner statement and no bank claim',async()=>{
  const result=await confirmActionReceiptCommand({userId:1,actionId:9});expect(result).toMatchObject({success:true,ownerReported:true,replayed:false});expect(st.status).toBe('verified');
  expect(st.events).toHaveLength(1);expect(st.events[0]).toMatchObject({actorType:'human',actorUserId:1,eventType:'owner_receipt_confirmed',actionId:9});expect(st.events[0].payload.paymentChanged).toBe(false);
  const lane=st.queries.find(x=>x.startsWith('UPDATE como_next_lifecycle_lanes'))!;expect(lane).toContain("kind IN ('deliverable','external_response')");expect(lane).not.toContain("kind='payment'");
  expect(st.queries.some(x=>/UPDATE.*finance/i.test(x))).toBe(false);expect(st.queries.some(x=>x.includes("work_file_status='ready_to_close'"))).toBe(false);
 });
 it('accepts a double click once only',async()=>{await confirmActionReceiptCommand({userId:1,actionId:9});const second=await confirmActionReceiptCommand({userId:1,actionId:9});expect(second.replayed).toBe(true);expect(st.events).toHaveLength(1);expect(st.queries.filter(x=>x.startsWith('UPDATE como_next_actions'))).toHaveLength(1)});
 it('rejects an active task and leaves it untouched',async()=>{st.status='open';await expect(confirmActionReceiptCommand({userId:1,actionId:9})).rejects.toThrow('الانتظار فقط');expect(st.status).toBe('open');expect(st.events).toHaveLength(0);expect(st.queries.some(x=>x.startsWith('UPDATE'))).toBe(false)});
 it('does not write without project permission',async()=>{st.permission=false;await expect(confirmActionReceiptCommand({userId:7,actionId:9})).rejects.toThrow('no_access');expect(st.transactions).toBe(0);expect(st.events).toHaveLength(0)});
 it('keeps a finished topic from creating a phantom next-step task',async()=>{st.remaining=0;await confirmActionReceiptCommand({userId:1,actionId:9});expect(st.queries.some(x=>x.includes("work_file_status='ready_to_close'"))).toBe(true);expect(st.queries.some(x=>x.includes("work_file_status='closed'"))).toBe(false)});
});
