# COMO Next — عقد توصيل متابعات البريد المشروطة

## الحالة عند التسليم

**غير موصول حيًا عمدًا.** لا تستدعي النسخة الحالية adapter المتابعة من `emailMonitor.ts` أو `scheduledEmailSyncRoute.ts` أو `comoNextEmailInbox.ts`، ولا تشغّل أي DB أو IMAP أو SMTP.  أُعدّت الخدمة وMySQL adapter والمخطط فقط؛ يجب أن يضيف الوالد التوصيل بعد مراجعة الدليل أدناه.

## نقطة التوصيل بعد استيراد Sent للقراءة فقط

بعد أن يلتزم `syncReadonlyInboxCommand` بسجل `como_next_email_messages` في `folder_name = 'Sent'`، يستدعي الوالد منشئ الخدمة صراحةً. لا تستدعِها قبل التزام الاستيراد، ولا من حفظ Draft، ولا من `communication_status = 'approved_for_send'`.

```ts
const store = await createComoNextEmailFollowupMysqlStore();
const followups = new ComoNextEmailFollowupService(store);
await followups.scheduleAfterConfirmedSentReminder(verifiedReminder);
```

`verifiedReminder` لا يصح إلا إذا أثبت الاستعلام/المحول كل ما يأتي:

1. الرسالة مستوردة للقراءة فقط، `sourceFolder === 'Sent'` و`sourceIsDraft === false`، ولها `sentMessageRef` ثابت مبني على mailbox/folder/UIDVALIDITY/UID أو هوية استيراد مكافئة.
2. الرسالة مرتبطة بملف عمل واحد مُصرح للمستخدم.
3. `sentCorrelation` يثبت الارتباط **بمفتاح `X-COMO-Draft-Key` نفسه** المحفوظ عند إنشاء المسودة النظامية، أو بمطابقة Message-ID ثابتة في `In-Reply-To`/`References`. لا تستخدم الموضوع أو To/CC أو تطابق نصي كبديل.
4. `ownerDirectiveRef` مصدره توجيه المالك الأصلي، و`ownerDirectiveExplicitlyApproved` يساوي `true` **فقط** إذا كان ذلك التوجيه يسجل موافقة صريحة قابلة للتدقيق على متابعة البريد. لا تستنتجه من `draft` أو `approved_for_send` أو من أي نص نموذج.
5. تنسخ `toText` و`ccText` من **رسالة Sent المثبتة**. لا تعيد حسابهما ولا تتجاوز `applyComoCcPolicy` عند إنشاء Draft؛ gateway الحالي يطبق سياسة CC المعيارية.

المفتاح النظامي لمسودات التوجيه الحالية هو `executive-directive-email-draft:${updateId}`. من الأفضل أن يحفظ محول الوالد هذا المفتاح وMessage-ID للمسودة قبل إرسال المالك، لأن `como_next_email_messages` لا يخزن MIME headers حاليًا.

## نقطة التوصيل بعد دليل الرد

بعد أن يسجّل خط التحليل/المراجعة قرارًا صريحًا بشأن رد INBOX، يستدعي الوالد فقط:

```ts
await store.cancelAfterQualifiedResolution({
  workFileId,
  sourceSentMessageRef,
  kind: "reply" | "analysis" | "deliverable" | "invoice_paid" | "invoice_approved",
  occurredAt,
  explicitlyAdequate: true,
  evidenceReference,
});
```

- الدليل يجب أن يكون مربوطًا بملف العمل وبـ`sourceSentMessageRef` الأصلي.
- `invoice_approved` **لا يلغي** مطلقًا متابعة `invoice_paid`; السداد يتطلب `kind: 'invoice_paid'` مع دليل صريح (مثل قيد disbursement/paid موثق)، وليس حالة approved.
- لا تستخرج `explicitlyAdequate` بالـkeyword matching. تحتاج قرار مراجع/سياسة موثق.

## نقطة الاستحقاق

ينشئ الوالد حلقة منفصلة ومحدودة تستدعي:

```ts
await new ComoNextEmailFollowupService(store).reconcile({ now });
```

الخدمة:

- تحسب ثلاثة أيام عمل في `Asia/Dubai` (السبت والأحد مستثنيان افتراضيًا).
- تلغي قبل الموعد عند دليل مؤهل فقط، ثم تعيد التحقق بعد claim لتجنب سباق وصول الرد.
- عند الاستحقاق، لا تنشئ Draft إلا إذا `ownerDirectiveExplicitlyApproved === true` ولم يوجد دليل حل مؤهل.
- غير المعتمد يتحول إلى `owner_review`، بلا كتابة إلى صندوق البريد.
- تستخدم lease token + `draftKey = como-next-followup:${idempotencyKey}`. الـgateway يبحث `X-COMO-Draft-Key` قبل append؛ لذا يعيد التشغيل/استعادة lease من دون مسودة مكررة.
- لا يستدعي SMTP؛ `saveComoMailboxDraft` ينشئ Draft فقط في `Private Email Drafts` كما يحدده صندوق البريد.

## migration

`drizzle/0097_como_next_email_followups.sql` إنشاء إضافي فقط: جدول جديد، فهارس ومفاتيح خارجية؛ لا يوجد `UPDATE` أو backfill أو نقل/حذف بيانات. لم يُشغّل على قاعدة بيانات في هذا العمل.

## مراجعة قبل التوصيل

- تأكد أن طريقة حفظ/استيراد Sent يمكنها الوصول إلى `X-COMO-Draft-Key` أو MIME `In-Reply-To`/`References`. بدون واحد منهما يفشل adapter عمدًا.
- امنع retries غير المقيدة: نفّذ reconcile في heartbeat منفصل بعد import/قرار الدليل، وليس داخل IMAP callback.
- تعامل مع أي failure في gateway كفشل قابل لإعادة المحاولة فقط؛ لا ترسل ولا تغيّر To/CC.
