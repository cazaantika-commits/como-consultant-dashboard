import {eq} from 'drizzle-orm';
import {comoNextStagedDirectives,comoNextWorkFileUpdates,comoNextActions} from '../drizzle/schema';
import {getDb} from '../server/db';
import {createCommunicationDraftCommand,appendEvent} from '../server/services/comoNextCommands';
import {linkReportFollowupDraft,readWorkFileLifecycle} from '../server/services/comoWorkFileLifecycle';
import {writeFile} from 'node:fs/promises';
const db=await getDb();if(!db)throw new Error('database_unavailable');
const [source]=await db.select().from(comoNextStagedDirectives).where(eq(comoNextStagedDirectives.id,150003)).limit(1);
if(!source||source.userId!==1||source.workFileId!==60017||!source.directiveText.includes('Do not send anything yet'))throw new Error('source_mismatch');
const [update]=await db.select().from(comoNextWorkFileUpdates).where(eq(comoNextWorkFileUpdates.id,1230001)).limit(1);if(!update||update.updateText!==source.directiveText)throw new Error('update_source_mismatch');
const body=`Dear Charitha,

I hope you are well.

Further to your email of 21 September, could you please share an update on the initial financial analysis, which you confirmed would be submitted as the next deliverable? The second invoice has now been paid from our side.

We understand that the analysis will be preliminary and based on the current draft layouts, with refinements to follow as the design develops. We would appreciate it if you could confirm when we can expect to receive it.

Thank you for your continued support.

Kind regards,
Abdalrahman Zaqout
Development Director
COMO Real Estate Development L.L.C.
M: +971 55 106 2668
E: a.zaqout@comodevelopments.com`;
const draft=await createCommunicationDraftCommand({userId:1,workFileId:60017,channel:'email',subject:'Re: Draft Report Submission V0.2 - Updated Concept & Next Steps',body,toText:'Charitha Abeyratne <Abeyratne.Charitha@mena.colliers.com>',ccText:'Grant Nash <grant.nash@mena.colliers.com>; Nicholas Brown <nicholas.brown@mena.colliers.com>; wael@zooma.ae',sourceEmailId:90027,idempotencyKey:'executive-directive-email-draft:1230001'});
const mailboxRef=draft.mailboxDraft?`${draft.mailboxDraft.folder} UID ${draft.mailboxDraft.uid}`:draft.externalMessageRef;
if(!mailboxRef||!/^Drafts UID \d+$/.test(mailboxRef))throw new Error('mailbox_draft_not_observed');
const report=await linkReportFollowupDraft({userId:1,workFileId:60017,updateId:1230001,communicationId:Number(draft.id),mailboxDraftRef:mailboxRef});
const summary=`سُجل سداد الفاتورة 7314002290 بإفادة المالك المحفوظة #150003؛ لا إيصال بنكي ولا تاريخ تحويل محدد. أُغلق انتظار الدفع #60109 فقط. أعد Manus متابعة التقرير وحفظها ${mailboxRef}، دون إرسال. التقرير #60100 باقٍ مستقلًا؛ المطلوب من المالك الآن مراجعة المسودة وإرسالها فقط. انتظار الرد الجديد لا يبدأ قبل الإرسال الفعلي.`;
await db.update(comoNextWorkFileUpdates).set({analysisStatus:'applied',analysisSummary:summary,targetActionId:report.nextActionId||null,reviewedByUserId:1,reviewedAt:new Date().toISOString().slice(0,19).replace('T',' '),modelId:'manus-executive-source-reviewed'}).where(eq(comoNextWorkFileUpdates.id,1230001));
await db.update(comoNextActions).set({title:'فاتورة كولييرز 7314002290 — مسددة بإفادة المالك',description:'انتهى انتظار السداد بإفادة المالك عبر سارة #150003 بتاريخ 9 أكتوبر؛ طبقها Manus بتوجيهه المؤكد في 12 أكتوبر. لم يُرفق إيصال بنكي وتاريخ التحويل الفعلي غير محدد. متابعة التقرير مستقلة.'}).where(eq(comoNextActions.id,60109));
await db.transaction(tx=>appendEvent(tx,{userId:1,projectId:1,workFileId:60017,actorType:'manus',actorUserId:null,eventType:'executive_directive_source_reconciled',summary:'تنفيذ التوجيه المحفوظ القديم: السداد مستقل، ومتابعة التقرير محفوظة كمسودة فقط',payload:{directiveId:150003,updateId:1230001,communicationId:Number(draft.id),mailboxDraftRef:mailboxRef,completed:true,sent:false},idempotencyKey:'colliers-source-reconciled:150003'}));
const receipt={sourceDirectiveId:150003,updateId:1230001,communicationDraftId:Number(draft.id),mailboxDraftRef:mailboxRef,nextActionId:report.nextActionId,executionSummary:summary,lifecycleResults:report.lifecycleResults,completedNow:true,sent:false,lanes:await readWorkFileLifecycle(60017)};
await writeFile('/home/ubuntu/reports/colliers-lifecycle-2026-10-12/report-draft-prepared.json',JSON.stringify(receipt,null,2)+'\n');await writeFile('/home/ubuntu/reports/colliers-lifecycle-2026-10-12/Colliers_Report_Followup.md',`# Colliers — Follow-up on the initial financial analysis\n\n**Status:** Saved to COMO Drafts; not sent.\n\n**To:** Charitha Abeyratne <Abeyratne.Charitha@mena.colliers.com>\n\n**Cc:** Grant Nash <grant.nash@mena.colliers.com>; Nicholas Brown <nicholas.brown@mena.colliers.com>; wael@zooma.ae\n\n**Subject:** Re: Draft Report Submission V0.2 - Updated Concept & Next Steps\n\n${body}\n`);
console.log(JSON.stringify(receipt,null,2));process.exit(0);
