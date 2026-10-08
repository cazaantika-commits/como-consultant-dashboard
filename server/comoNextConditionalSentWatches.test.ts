import {describe,it,expect} from 'vitest';
import {comparableReplySubject,completedConditionalReplySearch,isRelevantWatchReply} from './services/comoNextConditionalSentWatches';
const sent={sentTo:'Jamil <jj@neb.ae>',sentSubject:'Majan Shopping Centre — Request for Lead Consultant Proposal',sentAt:'2026-10-07 15:02:56'};
const reply={receivedFrom:'jj@neb.ae',receivedSubject:'Re: Majan Shopping Centre — Request for Lead Consultant Proposal',receivedAt:'2026-10-08 09:00:00',receivedBody:'Thank you, we have received the RFP.\nFrom: Owner'};
describe('conditional Sent watch evidence',()=>{
 it('normalizes standard reply prefixes while preserving project subject',()=>{
  expect(comparableReplySubject('RE: Fwd: Majan Shopping Centre — Request for Lead Consultant Proposal')).toBe(comparableReplySubject(sent.sentSubject));
  expect(isRelevantWatchReply({...sent,...reply})).toBe(true);
 });
 it('does not resolve for another contact or another project',()=>{
  expect(isRelevantWatchReply({...sent,...reply,receivedFrom:'colleague@neb.ae'})).toBe(false);
  expect(isRelevantWatchReply({...sent,...reply,receivedSubject:'Re: Different project'})).toBe(false);
 });
 it('rejects old messages, delivery robots and quoted empty replies',()=>{
  expect(isRelevantWatchReply({...sent,...reply,receivedAt:'2026-10-06 09:00:00'})).toBe(false);
  expect(isRelevantWatchReply({...sent,...reply,receivedSubject:'Automatic Reply: Majan Shopping Centre — Request for Lead Consultant Proposal'})).toBe(false);
  expect(isRelevantWatchReply({...sent,...reply,receivedBody:'From: Owner\nQuoted email'})).toBe(false);
 });
 it('does not accept multiple To recipients for a one-to-one watch',()=>{
  expect(isRelevantWatchReply({...sent,...reply,sentTo:'jj@neb.ae, another@neb.ae'})).toBe(false);
 });
 it('keeps a watch waiting when bounded reply discovery is truncated',()=>{
  expect(completedConditionalReplySearch(500)).toBe(true);
  expect(completedConditionalReplySearch(501)).toBe(false);
 });
});
