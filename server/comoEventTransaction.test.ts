import {describe,it,expect,vi} from 'vitest';
import {appendEvent} from './services/comoNextCommands';
const input={userId:1,projectId:6,workFileId:390001,eventType:'test',summary:'test',actorType:'manus' as const,actorUserId:null};
function transactionMock(previous:number){
 const values=vi.fn().mockResolvedValue(undefined);
 const tx={rollback:vi.fn(),execute:vi.fn().mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{sequenceNo:previous}]]),insert:vi.fn().mockReturnValue({values})};
 return {tx,values};
}
describe('event transaction boundary',()=>{
 it('wraps a root database call so lock and sequence insertion share one transaction',async()=>{
  const {tx,values}=transactionMock(8);const root={transaction:vi.fn(async fn=>fn(tx)),execute:vi.fn(),insert:vi.fn()};
  await appendEvent(root,input);
  expect(root.transaction).toHaveBeenCalledTimes(1);expect(root.execute).not.toHaveBeenCalled();expect(root.insert).not.toHaveBeenCalled();
  expect(tx.execute).toHaveBeenCalledTimes(2);expect(values).toHaveBeenCalledWith(expect.objectContaining({sequenceNo:9,actorType:'manus',actorUserId:null}));
 });
 it('does not start a nested transaction for an existing transaction',async()=>{
  const {tx,values}=transactionMock(0);const rootLike={...tx,transaction:vi.fn()};
  await appendEvent(rootLike,input);expect(rootLike.transaction).not.toHaveBeenCalled();expect(values).toHaveBeenCalledWith(expect.objectContaining({sequenceNo:1}));
 });
 it('does not allocate another sequence or insert a duplicate event',async()=>{
  const values=vi.fn();const tx={rollback:vi.fn(),execute:vi.fn().mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{id:123}]]),insert:vi.fn().mockReturnValue({values})};
  await appendEvent(tx,{...input,idempotencyKey:'one-receipt'});
  expect(tx.execute).toHaveBeenCalledTimes(2);expect(tx.insert).not.toHaveBeenCalled();expect(values).not.toHaveBeenCalled();
 });
});
