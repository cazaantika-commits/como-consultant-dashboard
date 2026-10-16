import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const state=vi.hoisted(()=>({queries:[] as string[],closed:false,sourceChanged:false,waiting:true,completed:false}));
vi.mock('./db',()=>({getDb:async()=>({execute:executeQuery,transaction:async(fn:any)=>fn({execute:executeQuery})})}));
vi.mock('./services/comoAppOwner',()=>({matchesAuthenticatedAppOwner:()=>true}));
const dialect=new MySqlDialect();
async function executeQuery(s:any){
 const {sql:q}=dialect.sqlToQuery(s);state.queries.push(q);
 const row=(v:any)=>[[v],[]];
 if(q.startsWith('SELECT d.*,sd.status'))return row({directive_id:750001,user_id:1,project_id:6,work_file_id:390001,action_id:840001,state:state.completed?'completed':'running',claim_token:'worker:unit',directive_status:'submitting',source_member_id:'system:manus-action'});
 if(q.startsWith('SELECT d.id,d.directive_id'))return row({id:540001,directiveId:750001,state:'completed',workProductId:99,nextActionId:900001,deliveryAttempts:1,queuedAt:null,lastProgressAt:null,startedAt:null});
 if(q.startsWith('SELECT * FROM como_next_actions'))return row({source_system:'como_next',title:'مراجعة حالة تنفيذ المالية لفاتورة أرتك5586',action_status:'open'});
 if(q.startsWith('SELECT work_file_status'))return row({work_file_status:state.closed?'cancelled':'active'});
 if(q.startsWith('SELECT state,claim_token'))return row({state:'running',claim_token:'worker:unit'});
 if(q.startsWith('SELECT source_system,title,action_status'))return row({source_system:'como_next',title:'مراجعة حالة تنفيذ المالية لفاتورة أرتك5586',action_status:'open'});
 if(q.startsWith('SELECT body_sha256,linked_work_file_id'))return row({body_sha256:(state.sourceChanged?'b':'a').repeat(64),linked_work_file_id:390001});
 if(q.startsWith('SELECT id FROM como_next_lifecycle_lanes'))return row({id:30001});
 if(q.startsWith('SELECT id FROM como_next_actions'))return state.waiting?row({id:900001}):[[],[]];
 if(q.startsWith('INSERT INTO como_next_work_memory'))return [{insertId:99,affectedRows:1},[]];
 if(q.startsWith('SELECT'))return [[],[]];
 return [{affectedRows:1,insertId:100},[]];
}
vi.mock('./services/comoNextCommands',()=>({appendEvent:async()=>undefined,requireProjectAccess:async()=>undefined}));
import {completeDispatchedPaymentStatusReview} from './services/comoManusDispatch';
const input=()=>({directiveId:750001,invoiceNumber:5586,checkedAt:new Date().toISOString(),sourceProofs:[{emailId:1080003,sha256:'a'.repeat(64)},{emailId:1380001,sha256:'a'.repeat(64)}],summary:'الفلل — فُحص خيط COMO وبقي السداد غير مثبت؛ لا بريد أو طلب صرف جديد.',workProductBody:'فحص Manus المصادر الفعلية لطلب الصرف والمستندات. '.repeat(8),nextActionId:900001});
describe('COMO payment-status completion',()=>{
 beforeEach(()=>{state.queries=[];state.closed=false;state.sourceChanged=false;state.waiting=true;state.completed=false;});
 it('closes only the review action, with no payment or mailbox writes',async()=>{
  const r=await completeDispatchedPaymentStatusReview(input());
  expect(r).toMatchObject({workProductId:99,completedNow:true,reviewCompleted:true,paymentChanged:false,paymentRequestCreated:false,communicationDraftId:null,sent:false,nextActionId:900001});
  const writes=state.queries.filter(q=>/^(INSERT|UPDATE|DELETE)/.test(q));
  expect(writes.some(q=>q.startsWith('UPDATE como_next_actions'))).toBe(true);
  expect(writes.some(q=>/como_next_lifecycle_lanes|como_next_communications|como_mailbox_draft_ledger/.test(q))).toBe(false);
 });
 it('rejects stale evidence before writing anything',async()=>{
  await expect(completeDispatchedPaymentStatusReview({...input(),checkedAt:'2025-01-01T00:00:00Z'})).rejects.toThrow('evidence_incomplete');
  expect(state.queries.some(q=>/^(INSERT|UPDATE)/.test(q))).toBe(false);
 });
 it('rejects a cancelled file during the completion transaction',async()=>{
  state.closed=true;await expect(completeDispatchedPaymentStatusReview(input())).rejects.toThrow('file_closed');
  expect(state.queries.some(q=>/^(INSERT|UPDATE)/.test(q))).toBe(false);
 });
 it('rejects a changed source without writing a receipt',async()=>{
  state.sourceChanged=true;await expect(completeDispatchedPaymentStatusReview(input())).rejects.toThrow('source_changed');
  expect(state.queries.some(q=>/^(INSERT|UPDATE)/.test(q))).toBe(false);
 });
 it('does not invent an external waiting action',async()=>{
  state.waiting=false;await expect(completeDispatchedPaymentStatusReview(input())).rejects.toThrow('waiting_not_proven');
  expect(state.queries.some(q=>/^(INSERT|UPDATE)/.test(q))).toBe(false);
 });
 it('returns the existing completed receipt without any repeated writes',async()=>{
  state.completed=true;
  expect(await completeDispatchedPaymentStatusReview(input())).toMatchObject({state:'completed',workProductId:99,nextActionId:900001});
  expect(state.queries.some(q=>/^(INSERT|UPDATE)/.test(q))).toBe(false);
 });
});
