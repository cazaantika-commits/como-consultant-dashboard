import {describe,expect,it} from 'vitest';
import {comoManusDispatchInternals} from './services/comoManusDispatch';
const {canClaimDispatchForWorker,canRetryKnownUndeliveredDispatch,delayFor,hasCompletedFulfillment,safeError}=comoManusDispatchInternals;
describe('COMO durable dispatch',()=>{
 it('claims only approved submitted event once',()=>{
  expect(canClaimDispatchForWorker({state:'delivered',claimToken:null,directiveStatus:'submitting',ownerApproved:true})).toBe(true);
  expect(canClaimDispatchForWorker({state:'running',claimToken:'worker:one',directiveStatus:'submitting',ownerApproved:true})).toBe(false);
  expect(canClaimDispatchForWorker({state:'queued',claimToken:null,directiveStatus:'pending',ownerApproved:true})).toBe(false);
  expect(canClaimDispatchForWorker({state:'queued',claimToken:null,directiveStatus:'submitting',ownerApproved:false})).toBe(false);
 });
 it('arrival proves delivery even if HTTP acknowledgement is in flight or lost',()=>{
  for(const state of ['queued','delivery_unknown'] as const)expect(canClaimDispatchForWorker({state,claimToken:'delivery:one',directiveStatus:'submitting',ownerApproved:true})).toBe(true);
  expect(canClaimDispatchForWorker({state:'failed',claimToken:'worker:failed',directiveStatus:'submitting',ownerApproved:true})).toBe(false);
 });
 it('never retries ambiguous delivery or partial execution',()=>{
  expect(canRetryKnownUndeliveredDispatch({state:'queued',claimToken:null})).toBe(true);
  expect(canRetryKnownUndeliveredDispatch({state:'failed',claimToken:null,error:'dispatch_webhook_rejected'})).toBe(true);
  expect(canRetryKnownUndeliveredDispatch({state:'failed',claimToken:null,error:'dispatch_execution_failed'})).toBe(false);
  expect(canRetryKnownUndeliveredDispatch({state:'failed',claimToken:'worker:one',error:'dispatch_execution_failed'})).toBe(false);
  expect(canRetryKnownUndeliveredDispatch({state:'delivery_unknown',claimToken:null})).toBe(false);
 });
 it('needs output receipt, not mere communication row or next task',()=>{
  expect(hasCompletedFulfillment({communicationDraftId:77,completedNow:false})).toBe(false);
  expect(hasCompletedFulfillment({mailboxDraftRef:'Drafts UID 937'})).toBe(true);
  expect(hasCompletedFulfillment({completedNow:true})).toBe(true);
  expect(hasCompletedFulfillment({workProductId:99})).toBe(true);
 });
 it('uses UTC or ISO progress time rather than treating fresh progress as delay',()=>{
  const old=new Date(Date.now()-121000).toISOString();
  expect(delayFor({state:'queued',queuedAt:old,lastProgressAt:null,startedAt:null})).toMatchObject({detected:true});
  expect(delayFor({state:'queued',queuedAt:old.slice(0,19).replace('T',' '),lastProgressAt:null,startedAt:null})).toMatchObject({detected:true});
  expect(delayFor({state:'running',queuedAt:old,lastProgressAt:new Date().toISOString(),startedAt:old})).toMatchObject({detected:false});
  expect(delayFor({state:'completed',queuedAt:old,lastProgressAt:null,startedAt:old})).toMatchObject({detected:false});
 });
 it('never exposes provider error or token',()=>{expect(safeError('provider token=secret')).toBe('dispatch_execution_failed')});
});
