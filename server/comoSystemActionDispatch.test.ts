import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {isInternalSystemActionEligible} from './services/comoSystemActionDispatch';
describe('System work reaches real Manus without new authority',()=>{
 it.each(['مراجعة الرد الجديد على متابعة التقرير','تحليل الفاتورة ومطابقة المصدر','تحضير نقاط اجتماع','Review report email'])('allows internal work %s',title=>expect(isInternalSystemActionEligible(title)).toBe(true));
 it.each(['إرسال مطالبة بالدفع','سداد الفاتورة','توقيع العقد','تعيين الاستشاري','Send email'])('rejects consequential action %s',title=>expect(isInternalSystemActionEligible(title)).toBe(false));
 it('requires real event and remains separate from owner assertions',()=>{const code=readFileSync('server/services/comoManusDispatch.ts','utf8');expect(code).toContain("systemAction?'executive_control':'owner'");expect(code).toContain("status=${completed?'submitted':'submitting'}");const route=readFileSync('server/scheduledEmailSyncRoute.ts','utf8');expect(route).toContain('systemWorkDispatch');expect(route).toContain("system-manus-action:");});
});
