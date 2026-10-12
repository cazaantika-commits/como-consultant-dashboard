import {beforeEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>{
 const batches:any[][]=[];
 const chain:any={from:vi.fn(),where:vi.fn(),limit:vi.fn(async()=>batches.shift()||[])};
 chain.from.mockReturnValue(chain);chain.where.mockReturnValue(chain);
 const db:any={select:vi.fn(()=>chain),insert:vi.fn(),transaction:vi.fn()};
 db.transaction.mockImplementation(async(fn:any)=>fn(db));
 return {db,batches,saveDraft:vi.fn()};
});
vi.mock('./db',()=>({getDb:vi.fn(async()=>h.db)}));
vi.mock('./emailMonitor',()=>({saveComoMailboxDraft:h.saveDraft}));
import {createCommunicationDraftCommand} from './services/comoNextCommands';
function prepare(status:string){
 h.batches.push([{id:390001,projectId:6,status:'open'}],[{id:6,userId:1,isTestProject:0,name:'Villas'}],[{id:1590001,communicationStatus:status,externalMessageRef:status==='sent'?'Sent UID 207':'Drafts UID 938',evidenceReference:'owner decision'}]);
}
beforeEach(()=>{h.batches.length=0;vi.clearAllMocks();});
describe('owner cancellation is a terminal draft boundary',()=>{
 it.each(['email','internal'] as const)('rejects a cancelled %s producer replay before any mailbox write',async(channel)=>{
  prepare('cancelled');
  await expect(createCommunicationDraftCommand({userId:1,workFileId:390001,channel,subject:'Superseded survey clarification',body:'Old producer replay',toText:'wael@zooma.ae',idempotencyKey:'original-key'})).rejects.toMatchObject({code:'PRECONDITION_FAILED'});
  expect(h.saveDraft).not.toHaveBeenCalled();expect(h.db.insert).not.toHaveBeenCalled();
 });
 it('preserves actual sent evidence rather than recreating a draft',async()=>{
  prepare('sent');
  const result=await createCommunicationDraftCommand({userId:1,workFileId:390001,channel:'email',subject:'Contract to Shahid',body:'Already fulfilled',toText:'shahid@zooma.ae',idempotencyKey:'original-key'});
  expect(result).toMatchObject({replayed:true,communicationStatus:'sent',mailboxDraft:null,externalSideEffect:false});
  expect(h.saveDraft).not.toHaveBeenCalled();expect(h.db.insert).not.toHaveBeenCalled();
 });
});
