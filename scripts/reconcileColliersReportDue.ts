import {sql} from 'drizzle-orm';
import {getDb} from '../server/db';
import {appendEvent} from '../server/services/comoNextCommands';
const db=await getDb();if(!db)throw Error('database_unavailable');
await db.transaction(async tx=>{
 await tx.execute(sql`SELECT id FROM como_next_work_files WHERE id=60017 FOR UPDATE`);
 await appendEvent(tx,{userId:1,projectId:1,workFileId:60017,actionId:60100,actorType:'manus',actorUserId:null,eventType:'report_due_source_reconciled',summary:'تصحيح موعد التقرير: 24 سبتمبر موعد تشغيلي قديم دون وعد مؤرخ في رسالة كولييرز؛ رسالة21سبتمبر تقول shortly. نطلب موعدًا محدثًا في المسودة بدل وصفه باستحقاق مثبت.',payload:{priorDueAt:'2026-09-24 07:00:00',sourceEmailId:90027,newDueAt:null,mailboxDraftRef:'Drafts UID 937'},idempotencyKey:'colliers-due-source-reconciled:60100'});
 await tx.execute(sql`UPDATE como_next_actions SET due_at=NULL,evidence_reference='COMO INBOX UID 412 / رسالة #90027 بتاريخ21سبتمبر: التحليل المالي الأولي هو التسليم التالي، دون موعد يوم محدد؛ متابعة Drafts UID 937' WHERE id=60100`);
 await tx.execute(sql`UPDATE como_next_lifecycle_lanes SET due_at=NULL,source_text='رسالة كولييرز21سبتمبر تحدد التحليل المالي الأولي كتسليم تالٍ وتقول shortly دون موعد يوم محدد؛ مسودة937 تطلب موعدًا محدثًا. مستقل عن سداد الفاتورة.' WHERE work_file_id=60017 AND kind='deliverable' AND action_id=60100`);
});console.log('Report due source corrected; payment unchanged.');process.exit(0);
