import { describe,it,expect } from 'vitest';
import { classifyLifecycleAction,invoiceKeys,ownerAssertsPaymentPaid } from './services/comoWorkFileLifecycle';
import { directiveRequestsCommunicationDraft } from './services/comoNextExecutiveDirectives';
import { readFileSync } from 'node:fs';
describe('Independent work-file lifecycle',()=>{
 it.each(['تم سداد فاتورة كولييرز','الفاتورة مسددة','Payment is now confirmed as paid from our side','The invoice has been paid'])('accepts owner assertion %s',t=>expect(ownerAssertsPaymentPaid(t)).toBe(true));
 it.each(['لم يتم سداد الفاتورة','الفاتورة غير مدفوعة','payment is pending','invoice is not paid','هل تم سداد الفاتورة؟'])('does not invent payment %s',t=>expect(ownerAssertsPaymentPaid(t)).toBe(false));
 it('classifies payment and deliverable independently',()=>{
  expect(classifyLifecycleAction({title:'فاتورة كولييرز معتمدة ومُرسلة لوائل — بانتظار تأكيد تنفيذ الدفع'})).toBe('payment');
  expect(classifyLifecycleAction({title:'بانتظار تسليم التحليل المالي الأولي من Colliers'})).toBe('deliverable');
  expect(classifyLifecycleAction({title:'متابعة سداد الفاتورة وتسليم التقرير'})).toBe('ambiguous');
 });
 it('matches one specific invoice not every payment',()=>expect(invoiceKeys('Tax Invoice No. 7314002290 and فاتورة رقم 7314002290')).toEqual(['7314002290']));
 it.each(['Prepare a reminder to Charitha. Do not send anything yet—just prepare the reminder for my review.','جهّز رسالة متابعة التقرير ولا ترسلها'])('prepares requested draft despite no send %s',t=>expect(directiveRequestsCommunicationDraft(t)).toBe(true));
 it.each(['ذكّري وائل، خلي ما نرسل','لا تجهز المسودة','Do not prepare a draft'])('honors cancellation %s',t=>expect(directiveRequestsCommunicationDraft(t)).toBe(false));
 it('never sends, resets due or fabricates receipt',()=>{
  const code=readFileSync('server/services/comoWorkFileLifecycle.ts','utf8');
  expect(code).not.toMatch(/sendMail\(|sendApprovedComoReply\(/);
  expect(code).toContain('paid_owner_reported');expect(code).toContain('awaiting_owner_send');
  expect(code).toContain('matchingKeys.length!==1');
  expect(code).not.toMatch(/dueAt:\s*(nowSql|new Date)/);
 });
});
