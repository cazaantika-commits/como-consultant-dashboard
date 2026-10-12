import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {describeMailExecution,automaticMailNeedsNoReview,type MailExecutionRow} from './services/comoMailExecution';
import {scoreEmailSuggestionCandidate} from './services/comoNextEmailInbox';
const base:MailExecutionRow={emailId:1020002,subject:'Consultancy Agreement',fromEmail:'dkv@artecint.com',receivedAt:'2026-10-12 07:01:39',importedAt:'2026-10-12 07:04:40',inboxStatus:'unmatched',workFileId:null,fileStatus:null,analysisId:4020001,actionId:null,actionStatus:null,actionEvidence:null,directiveId:null,dispatchState:null,dispatchEvidence:null,lastProgressAt:null,hasOwnerGate:0};
const now=new Date('2026-10-12T08:00:00Z');
const source=readFileSync('server/services/comoMailExecution.ts','utf8');
const dispatch=readFileSync('server/services/comoManusDispatch.ts','utf8');
const route=readFileSync('server/scheduledEmailSyncRoute.ts','utf8');
describe('source-bound mail execution, independent from heartbeat success',()=>{
 it('keeps an analyzed unlinked mail blocked and reports a delay',()=>{expect(describeMailExecution(base,now)).toMatchObject({state:'blocked_linkage',delayed:true,analysisPending:false});});
 it('does not convert automatic analysis to execution',()=>{expect(describeMailExecution({...base,inboxStatus:'linked',workFileId:390001,fileStatus:'open'},now).state).toBe('awaiting_work');});
 it('does not count creating or delivering a task as review completion',()=>{
  const linked={...base,inboxStatus:'linked',workFileId:390001,fileStatus:'open',actionId:123,actionStatus:'open'};
  expect(describeMailExecution(linked,now).state).toBe('awaiting_dispatch');
  expect(describeMailExecution({...linked,dispatchState:'delivered'},now).state).toBe('awaiting_result');
  expect(describeMailExecution({...linked,dispatchState:'running'},now).state).toBe('running');
 });
 it('requires a verified action AND an actual dispatch receipt',()=>{
  const linked={...base,inboxStatus:'linked',workFileId:390001,fileStatus:'open',actionId:123,actionStatus:'verified',actionEvidence:'review #1'};
  expect(describeMailExecution(linked,now).state).not.toBe('review_completed');
  expect(describeMailExecution({...linked,dispatchState:'completed'},now).state).not.toBe('review_completed');
  expect(describeMailExecution({...linked,dispatchState:'completed',dispatchEvidence:'work product #1'},now)).toMatchObject({state:'review_completed',delayed:false});
 });
 it('preserves known failure and uncertainty without resetting them',()=>{
  expect(describeMailExecution({...base,workFileId:390001,fileStatus:'open',dispatchState:'failed'},now).state).toBe('blocked_dispatch');
  expect(describeMailExecution({...base,workFileId:390001,fileStatus:'open',dispatchState:'delivery_unknown'},now).reason).toContain('لا إعادة');
 });
 it('does not silently reopen closed or cancelled work files',()=>{
  expect(describeMailExecution({...base,workFileId:390001,fileStatus:'closed'},now).state).toBe('blocked_closed_file');
  expect(source).toContain("['closed','cancelled'].includes(liveFile?.work_file_status)");
 });
 it('exempts only recognizable system notices, not ordinary professional messages',()=>{
  expect(automaticMailNeedsNoReview('Automatic reply: received','x@artec.com')).toBe(true);
  expect(automaticMailNeedsNoReview('Consultancy Agreement','dkv@artecint.com')).toBe(false);
  expect(automaticMailNeedsNoReview('Invoice','tdimitrova@artecint.com')).toBe(false);
 });
 it('refuses an explicit different plot even from a registered contact',()=>{
  expect(scoreEmailSuggestionCandidate({plotNumber:'6180578',contactEmail:'x@artec.com',partyLinkedToFile:1},{from:'x@artec.com',to:'',cc:'',subject:'Invoice for Plot 9999999',textBody:''} as any).score).toBe(0);
 });
 it('serializes file+source checks and creates one durable task without a new schedule',()=>{
  expect(source).toContain('FOR UPDATE');expect(source).toContain("source_record_id=${`mail-review:${e.emailId}`}");expect(source).toContain('if(old)return');
  expect(route.match(/app\.post\("\/api\/scheduled\//g)).toHaveLength(3);
  expect(source).not.toMatch(/invokeLLM|sendMail|sendReply|saveComoMailboxDraft|setInterval|node-cron/);
 });
 it('gives real Manus attachment review rather than completing through an LLM response',()=>{
  expect(dispatch).toContain("fulfillment:'requires_agent_mail_review'");
  expect(dispatch).toContain('mail_review_attachments_not_reviewed');
  expect(dispatch).toContain('mail_review_source_changed');
  expect(dispatch).toContain("eventType:'mail_review_completed'");
  expect(dispatch.indexOf("fulfillment:'requires_agent_mail_review'")).toBeLessThan(dispatch.indexOf('const result=await executeExecutiveDirectiveCommand'));
 });
 it('shows identical unresolved-source warnings in the UI and both Sara reading routes',()=>{
  expect(readFileSync('client/src/components/ComoNextEmailInbox.tsx','utf8')).toContain('التعامل مع البريد لم يكتمل');
  expect(readFileSync('server/services/saraBriefings.ts','utf8')).toContain('mailExecution.warning');
  expect(readFileSync('server/services/saraRealtime.ts','utf8')).toContain('execution:mailExecution');
 });
});
