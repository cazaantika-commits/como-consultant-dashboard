import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { comoNextEmailSyncSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { resolveOwnerUserIdForSara } from "./comoNextIntake";
import { presentSaraDubaiTimes, saraDubaiTimestamp } from "./saraDubaiTimes";

export const SARA_REALTIME_MODEL = "gpt-realtime-2.1";
export const SARA_REALTIME_VOICE = "marin";

export type SaraMember = {
  memberId: string;
  nameAr: string;
  role: string;
};

export const saraRealtimeTools = [
  {
    type: "function" as const,
    name: "lookup_executive_workspace",
    description: "اقرئي مكتب COMO Next التنفيذي الحالي فقط: الملفات والإجراءات والقرارات والاجتماعات والمراسلات الواردة حديثًا أيضًا. تعرض النتائج أوقات Dubai وحالة حداثة مزامنة البريد. لا تقرئي مركز القيادة القديم. متاحة لعبد الرحمن فقط، ولا ترسل أو تعدل أي شيء.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["overview", "project_memory", "work_files", "actions", "decisions", "communications", "meetings", "proposals"],
        },
        project_name: { type: "string", description: "اسم المشروع اختياري لتضييق النتيجة" },
      },
      required: ["category"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "read_executive_work_file",
    description: "افتحي ملف الموضوع نفسه واقرئي محتواه التفصيلي: مخرجات Manus والتقارير والتحليلات والوثائق المرتبطة ومحاضر ومحاور ونتائج الاجتماعات والتحديثات والمراسلات والقرارات والإجراءات. استخدميها عندما يسأل عبد الرحمن ماذا يوجد داخل تحليل أو تقرير أو اجتماع أو لماذا وصل الملف إلى موقف معين. هذه قراءة فقط ولا تكشف روابط التخزين الخاصة.",
    parameters: {
      type: "object",
      properties: {
        work_file_id: { type: "integer", description: "معرّف ملف الموضوع من lookup_executive_workspace" },
        focus: {
          type: "string",
          enum: ["overview", "analysis", "meetings", "communications", "history", "full"],
          description: "اختاري analysis للتقرير، meetings لمحضر أو نتيجة اجتماع، communications للمراسلات، history للتسلسل، full عند الحاجة للصورة الكاملة",
        },
        question: { type: ["string", "null"], description: "سؤال عبد الرحمن أو اسم التحليل المطلوب لانتقاء الجزء الأدق" },
        document_id: { type: ["integer", "null"], description: "اختياري: معرّف وثيقة محددة من نتيجة قراءة سابقة" },
      },
      required: ["work_file_id", "focus", "question", "document_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "direct_manus_in_work_file",
    description: "اكتبي توجيه عبد الرحمن مباشرة داخل ملف الموضوع الصحيح وشغّلي به محرك Manus التنفيذي نفسه المستخدم في المطبخ. استخدميها بعد تحديد ملف الموضوع من أداة القراءة. تنفذ الأعمال الداخلية الآمنة فقط؛ لا ترسل بريدًا ولا تقبل عرضًا ولا تعيّن طرفًا ولا تنشئ دفعًا أو التزامًا خارجيًا.",
    parameters: {
      type: "object",
      properties: {
        work_file_id: { type: "integer", description: "معرّف ملف الموضوع المطابق من lookup_executive_workspace" },
        directive_text: { type: "string", description: "كلام عبد الرحمن كما قاله، دون تحويله إلى نموذج أو اقتراح" },
        action_id: { type: ["integer", "null"], description: "معرّف تدخل المستخدم فقط إذا كان كلامه ينجز هذا التدخل تحديدًا" },
        current_decision_id: { type: ["integer", "null"], description: "معرّف القرار فقط إذا حسمه عبد الرحمن صراحة، وليس لمجرد التعليق عليه" },
      },
      required: ["work_file_id", "directive_text", "action_id", "current_decision_id"],
      additionalProperties: false,
    },
  },
] as const;

export function buildSaraRealtimeInstructions(member: SaraMember) {
  const address = member.memberId === "abdulrahman" ? "عبد الرحمن" : member.nameAr;
  return `أنتِ سارة، الواجهة الصوتية والمرئية الوحيدة في تطبيق COMO أمام ${address}.

VOICE DELIVERY — never read these directions aloud:
- Speak in natural Lebanese Arabic, not formal Modern Standard Arabic, except when quoting an official title or document.
- Use a soft, warm feminine delivery with bright, happy energy.
- Speak only one notch faster than a normal conversation: lively and clear, never very fast, rushed, robotic, or breathless.
- Sound like a warm, respectful, witty friend. Be friendly without flattery, pet names, exaggerated praise, or overfamiliar language.
- Use light situational humor, playful comments, and an occasional natural chuckle when they fit. Do not force a joke or laugh in every turn.
- Never joke about a financial amount, legal risk, deadline, contractual obligation, or an unverified fact. Humor may decorate the delivery but must never alter the meaning.
- When moving to a new topic, make a short natural pause, name the new topic clearly, and leave room for ${address} to react. If he comments or interrupts, respond to him first, then resume from the exact point where you stopped.
- Keep sentences short and spoken, with natural Lebanese connectors. Read names, dates, times, amounts, and decisions slowly enough to remain unambiguous even while the overall pace stays quick.
- Avoid stiff corporate language, ceremonial introductions, excessive apologies, and phrases that sound like a secretary reading a report.

أسلوبك مع ${address}:
- أنتِ صديقة لبنانية لطيفة ومحترمة: ناعمة، سريعة البديهة، خفيفة الدم، وحماسها هادئ وطبيعي.
- ممنوع ألقاب مثل «يا زعيم» و«يا كبير»، وممنوع التملق والمديح الزائد. خاطبيه بلطف مباشر ومن دون تكلف أو ابتذال.
- سرعة الكلام أعلى بدرجة واحدة فقط من المحادثة العادية؛ لا تسرعي كثيرًا، وحافظي على وضوح الأسماء والمواعيد والأرقام.
- اضحكي ضحكة قصيرة طبيعية عندما تكون هناك نكتة فعلًا، ولا تحوّلي كل جواب إلى استعراض فكاهي.
- لا تمزحي في مبلغ مالي أو خطر قانوني أو موعد نهائي أو التزام تعاقدي أو حقيقة غير متحققة؛ المزاح في طريقة التقديم لا في الحقيقة نفسها.
- في المواضيع الجدية، اخفضي المزاح لكن ابقي قريبة وغير رسمية: قولي الحقيقة مباشرة، ثم أعيدي الحماس إلى الخطوة التالية.
- لا تلقي نشرة طويلة كقطار. بين موضوع وآخر خذي وقفة قصيرة، أعطي عنوان الموضوع وزبدته، واتركي نافذة للأخذ والرد. إذا لم يقاطعك، تابعي بسلاسة.
- ابدئي التحية الأولى بتحية لبنانية قصيرة وفرحة تناسب الوقت، ثم لا تكرري الترحيب في كل دور.

حدود الدور الملزمة:
- سارة هي واجهة الحديث والاستماع والوصول السريع إلى معلومات COMO، وليست العقل التنفيذي البديل. دورك أن تقرئي العمل لعبد الرحمن، وتأخذي توجيهه بصوته، وتكتبيه مكانه داخل ملف الموضوع الصحيح.
- Manus هو العقل التنفيذي للأبحاث العميقة، قراءة الملفات الكبيرة، التحليل، إعداد التقارير، وبناء المخرجات. أداة direct_manus_in_work_file تمرر كلام عبد الرحمن إلى محرك Manus التنفيذي نفسه؛ بعد نجاحها اذكري باختصار ما سجّل وما بدأ أو أنجز.
- أنتِ قادرة على قراءة ما أنجزه Manus: عندما يسأل عبد الرحمن عن محتوى تحليل أو تقرير أو محضر أو تفاصيل اجتماع، حددي الملف من lookup_executive_workspace ثم استدعي read_executive_work_file بالفئة المناسبة. لا تجيبي «ليس من صلاحيتي» ولا تكتفي بعنوان التقرير أو حالته إذا كان محتواه متاحًا.
- أداة read_executive_work_file تعيد نص التقرير المحمي أو الجزء الأقرب للسؤال عند focus=analysis، وتعيد محاور الاجتماع وإجاباتها ومصادره وتحليله ومحضره عند focus=meetings. اشرحي الجواب من الدليل ثم اذكري إن كان النص مقتطعًا أو المعلومة غير مثبتة.
- كلام عبد الرحمن ليس ملاحظة جانبية: إذا أجّل أو حسم أو ألغى شيئًا، direct_manus_in_work_file يجعل Manus يغيّر السجل القديم المتعارض وحالة الأولوية. لا تعيدي تقديم قرار مؤجل قبل موعد عودته.
- المصدر التشغيلي الوحيد للحالة الحالية والمهام والاجتماعات هو COMO Next عبر lookup_executive_workspace. مركز القيادة القديم ومهامه واجتماعاته ومتابعاته ملغاة كمصدر لسارة ولا يجوز ذكرها أو الاستناد إليها.
- استخدمي أداة COMO Next عند السؤال عن الحالة الحالية أو الأرقام أو المشاريع. لا تخمّني ولا تستخدمي ذاكرة المحادثة بدل المصدر المتاح.
- إذا سأل عبد الرحمن «ما عندي اليوم؟» أو «ما المواعيد؟» أو طلب النشرة، يجب أن تستدعي lookup_executive_workspace للحالة الحالية في نفس الدور، وتشمل فئة meetings صراحة؛ ممنوع الإجابة من ذاكرة الجلسة حتى لو بدا السؤال مكررًا.
- مع عبد الرحمن، ابدئي التفاعل العملي بعد التحية بموجز قصير عن أهم المستجدات الموثقة عندما تكون بيانات COMO Next متاحة؛ لا تملئي الموجز بمعلومات قديمة أو غير مؤكدة، ولا تكرريه إذا لم يطلبه.
- عند السؤال عن خلفية مشروع أو ما الذي حدث سابقًا، استخدمي فئة project_memory من مكتب COMO Next؛ فهي الذاكرة المراجعة المرتبطة بالمصادر، وليست مجرد ملخص محادثة.
- project_memory للفهرس والخلفية العامة فقط. إذا كان السؤال عن داخل ملف أو تقرير أو تحليل أو اجتماع، لا تتوقفي عند الفهرس: افتحي الدوسييه بأداة read_executive_work_file.
- جميع حقول التاريخ المنتهية بـ Dubai في نتائج أدواتك هي الوقت المحلي الصحيح بتوقيت Asia/Dubai؛ اقرئي منها فقط عند ذكر موعد أو ساعة. الحقول الأصلية المنتهية بـ At صارت ISO UTC بتوقيت Z، فلا تقرئي 06:00 UTC للمستخدم على أنه 06:00 صباحًا بدبي. الاجتماع المكتمل أو الماضي ذو نتيجة ليس موعدًا قادمًا.
- عند السؤال عمّا وصل من عرض أو عقد أو مرفق، اقرئي communications للوارد الحديث ثم افتحي ملفه بـ read_executive_work_file، ولا تكتفي بفهرس المسودات أو ذاكرة محادثتك. اميزي بين مسودة اتفاقية واردة وعرض معتمد أو عقد موقّع.
- إذا كان mailSync.state يساوي stale، تستطيعين الإجابة عن الرسائل المستوردة فعلًا مع ذكر تاريخ آخر نجاح، لكن لا تقولي إن كل البريد محدث أو إنه لم يصل شيء جديد منذ ذلك الوقت؛ أبلغي عبد الرحمن أن مزامنة البريد المجدولة متوقفة وتحتاج إصلاحًا.
- لا ترسلي بريدًا أو واتساب أو تيليغرام، ولا تقبلي عرضًا أو تعيّني طرفًا أو تنشئي دفعًا أو التزامًا خارجيًا. التوجيه المباشر يسمح فقط بما يستطيع Manus تنفيذه داخليًا بأمان؛ أي أثر خارجي يبقى مسودة أو قرارًا واضحًا لعبد الرحمن.
- إذا قال عبد الرحمن «اكتبي لManus»، «تابعي»، «اعملي»، «حضّري»، «ذكّري وائل»، أو أعطاك الخطوة التالية: حددي ملف الموضوع من مصدر COMO ثم استخدمي direct_manus_in_work_file. لا تحفظي كلامه كمقترح منفصل، ولا تطلبي منه فتح المطبخ أو تعبئة حقول.
- استخدمي action_id فقط عندما يكون كلام عبد الرحمن هو النتيجة المطلوبة لإغلاق تدخل بشري ظاهر مثل «أخبر Manus بما حدث». استخدمي current_decision_id فقط إذا حسم القرار صراحة. إذا كان يوجّه Manus للعمل من دون حسم القرار، اتركيهما null.
- بعد نجاح الأداة لا تقولي فقط «سجلته». قولي: «كتبته داخل ملف [اسم الموضوع]»، ثم لخّصي executionSummary في جملة واحدة. إذا أعادت الأداة nextActionId فمعناه أن Manus بدأ خطوة داخلية؛ وإذا أعادت workProductId فمعناه أن Manus أنجز مخرجًا داخليًا.
- القرار ليس تنفيذًا، والمسودة ليست إرسالًا، والتحليل ليس اعتمادًا.
- عند عدم وجود دليل كافٍ قولي ذلك مباشرة واسألي عن المصدر أو الخطوة المطلوبة.
- لا تقرئي القوائم الطويلة حرفيًا؛ حوّلي مخرجات Manus إلى كلام لبناني حي، أعطي الزبدة، ثم اقترحي خطوة واحدة تالية.
- لا تذكري تفاصيل تقنية مثل أسماء النماذج أو الرموز أو أدوات النظام إلا إذا سأل المستخدم عنها مباشرة.
- إذا قاطعك المستخدم توقفي فورًا واستمعي.
- صوتك هو صوت سارة في OpenAI Realtime. صورة LiveAvatar طبقة مرئية اختيارية لا تغيّر مصدر الحقيقة أو صلاحياتك.`;
}

export function buildSaraRealtimeSession(member: SaraMember) {
  return {
    type: "realtime" as const,
    model: SARA_REALTIME_MODEL,
    instructions: buildSaraRealtimeInstructions(member),
    output_modalities: ["audio"] as const,
    max_output_tokens: 1200,
    tool_choice: "auto" as const,
    tools: saraRealtimeTools,
    audio: {
      input: {
        noise_reduction: { type: "far_field" as const },
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "ar",
          prompt: "محادثة عربية عن مشاريع COMO والتطوير العقاري وأسماء الشركات والاستشاريين.",
        },
        turn_detection: {
          type: "semantic_vad" as const,
          eagerness: "medium" as const,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice: SARA_REALTIME_VOICE },
    },
  };
}

export async function createSaraRealtimeClientSecret(apiKey: string, member: SaraMember) {
  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لم يتم ربط OpenAI Realtime بالتطبيق" });
  }
  const safetyIdentifier = createHash("sha256").update(`como-sara:${member.memberId}`).digest("hex");
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${normalizedApiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": safetyIdentifier,
    },
    body: JSON.stringify({ session: buildSaraRealtimeSession(member) }),
  });
  const payload = await response.json().catch(() => null) as {
    value?: string;
    expires_at?: number;
    session?: { id?: string; model?: string };
    error?: { message?: string; code?: string };
  } | null;
  if (!response.ok || !payload?.value) {
    const detail = payload?.error?.message || payload?.error?.code || `HTTP ${response.status}`;
    throw new TRPCError({ code: "BAD_GATEWAY", message: `تعذر تجهيز جلسة سارة الصوتية: ${detail}` });
  }
  return {
    clientSecret: payload.value,
    expiresAt: payload.expires_at ?? null,
    sessionId: payload.session?.id ?? null,
    model: payload.session?.model ?? SARA_REALTIME_MODEL,
  };
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0] as T[];
  return result as T[];
}

function normalizeToolArgs(rawArguments: string) {
  try {
    const parsed = JSON.parse(rawArguments || "{}") as { category?: string; project_name?: string };
    return { category: parsed.category || "overview", projectName: parsed.project_name?.trim() || null };
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة طلب سارة للمصدر غير صالحة" });
  }
}

export async function lookupExecutiveWorkspace(member: SaraMember, rawArguments: string) {
  if (member.memberId !== "abdulrahman") {
    return { found: false, reason: "مكتب COMO Next التنفيذي خاص بعبد الرحمن." };
  }
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const userId = await resolveOwnerUserIdForSara(member.memberId);
  const { category, projectName } = normalizeToolArgs(rawArguments);
  const filter = projectName ? `%${projectName}%` : "%";
  const [syncSettings] = await db.select({
    isEnabled: comoNextEmailSyncSettings.isEnabled,
    lastSuccessAt: comoNextEmailSyncSettings.lastSuccessAt,
    lastRunAt: comoNextEmailSyncSettings.lastRunAt,
    lastStatus: comoNextEmailSyncSettings.lastStatus,
  }).from(comoNextEmailSyncSettings).where(eq(comoNextEmailSyncSettings.userId, userId)).limit(1);
  const lastSuccess = saraDubaiTimestamp(syncSettings?.lastSuccessAt);
  const lastRun = saraDubaiTimestamp(syncSettings?.lastRunAt);
  const runStuck = syncSettings?.lastStatus === "running" && (!lastRun || Date.now() - Date.parse(lastRun.utc) > 2 * 60_000);
  const syncStale = !syncSettings?.isEnabled || !lastSuccess || Date.now() - Date.parse(lastSuccess.utc) > 15 * 60 * 60_000
    || syncSettings?.lastStatus === "failed" || runStuck;
  const mailSync = {
    state: syncStale ? "stale" : "current",
    lastSuccessAt: lastSuccess?.utc || null,
    lastSuccessAtDubai: lastSuccess?.dubai || null,
    note: syncStale ? "البريد المستورد قد لا يشمل الرسائل الجديدة؛ لا تؤكدي أنه محدث أو خالٍ من وارد جديد." : null,
  };
  if (category === "project_memory") {
    const [dossiersResult, memoryResult] = await Promise.all([
      db.execute(sql`
        SELECT p.id AS projectId, p.name AS project, dossier.executive_context AS executiveContext,
          dossier.current_position AS currentPosition, dossier.lifecycle_phases_json AS lifecyclePhases,
          dossier.key_parties_json AS keyParties, dossier.dependencies_json AS dependencies,
          dossier.open_threads_json AS openThreads, dossier.reviewed_at AS reviewedAt
        FROM como_next_project_dossiers dossier
        JOIN projects p ON p.id = dossier.project_id AND p.is_test_project = 0
        WHERE dossier.brief_status = 'reviewed' AND p.userId = ${userId} AND p.name LIKE ${filter}
        ORDER BY dossier.updated_at DESC LIMIT 8
      `),
      db.execute(sql`
        SELECT p.name AS project, wf.title AS workFile, memory.title, memory.body,
          memory.entry_type AS entryType, annotation.confidence,
          annotation.evidence_refs_json AS evidenceRefs
        FROM como_next_work_memory memory
        JOIN como_next_memory_annotations annotation ON annotation.memory_id = memory.id
        JOIN como_next_work_files wf ON wf.id = memory.work_file_id AND wf.project_id = memory.project_id
        JOIN projects p ON p.id = memory.project_id AND p.is_test_project = 0
        WHERE memory.is_current = 1 AND wf.user_id = ${userId}
          AND wf.work_file_status NOT IN ('closed','cancelled') AND p.name LIKE ${filter}
        ORDER BY annotation.reviewed_at DESC, memory.id DESC LIMIT 40
      `),
    ]);
    const parseList = (value: unknown) => {
      try { const parsed = JSON.parse(String(value || "[]")); return Array.isArray(parsed) ? parsed : []; }
      catch { return []; }
    };
    return presentSaraDubaiTimes({
      found: rows<any>(dossiersResult).length > 0,
      source: "COMO Next reviewed project memory",
      generatedAt: new Date().toISOString(),
      mailSync,
      dossiers: rows<any>(dossiersResult).map(item => ({
        ...item,
        lifecyclePhases: parseList(item.lifecyclePhases),
        keyParties: parseList(item.keyParties),
        dependencies: parseList(item.dependencies),
        openThreads: parseList(item.openThreads),
      })),
      reviewedMemory: rows<any>(memoryResult).map(item => ({
        ...item,
        evidenceRefs: parseList(item.evidenceRefs),
      })),
    });
  }
  const [workFilesResult, actionsResult, decisionsResult, communicationsResult, meetingsResult, proposalsResult] = await Promise.all([
    db.execute(sql`
      SELECT wf.id, p.name AS project, wf.title, wf.governing_question AS governingQuestion,
        wf.work_file_status AS status, wf.priority, wf.updated_at AS updatedAt
      FROM como_next_work_files wf JOIN projects p ON p.id = wf.project_id AND p.is_test_project = 0
      LEFT JOIN como_next_import_batches b ON b.batch_id = wf.import_batch_id
      WHERE wf.user_id = ${userId} AND wf.work_file_status NOT IN ('closed','cancelled') AND p.name LIKE ${filter}
        AND (wf.import_batch_id IS NULL OR b.batch_status = 'promoted')
      ORDER BY CASE wf.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END, wf.updated_at DESC LIMIT 25
    `),
    db.execute(sql`
      SELECT a.id, wf.id AS workFileId, p.name AS project, wf.title AS workFile, a.title, a.action_status AS status,
        a.priority, a.owner_type AS ownerType, a.due_at AS dueAt, a.follow_up_at AS followUpAt
      FROM como_next_actions a JOIN como_next_work_files wf ON wf.id = a.work_file_id
      JOIN projects p ON p.id = a.project_id AND p.is_test_project = 0
      WHERE a.user_id = ${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND a.action_status NOT IN ('verified','cancelled') AND p.name LIKE ${filter}
        AND (a.attention_at IS NULL OR a.attention_at <= UTC_TIMESTAMP())
      ORDER BY CASE a.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC LIMIT 30
    `),
    db.execute(sql`
      SELECT d.id, wf.id AS workFileId, p.name AS project, wf.title AS workFile, d.title, d.question,
        d.decision_status AS status, d.decision_authority AS authority, d.due_at AS dueAt
      FROM como_next_decisions d JOIN como_next_work_files wf ON wf.id = d.work_file_id
      JOIN projects p ON p.id = d.project_id AND p.is_test_project = 0
      WHERE d.user_id = ${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND (d.decision_status = 'required'
          OR (d.decision_status = 'deferred' AND d.due_at IS NOT NULL AND d.due_at <= UTC_TIMESTAMP()))
        AND p.name LIKE ${filter}
      ORDER BY d.due_at ASC, d.id ASC LIMIT 25
    `),
    db.execute(sql`
      SELECT c.id, wf.id AS workFileId, p.name AS project, wf.title AS workFile, c.subject, c.channel,
        c.communication_status AS status, c.approval_status AS approvalStatus, c.occurred_at AS occurredAt
      FROM como_next_communications c JOIN como_next_work_files wf ON wf.id = c.work_file_id
      JOIN projects p ON p.id = c.project_id AND p.is_test_project = 0
      WHERE c.user_id = ${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND c.communication_status IN ('received','draft','approved_for_send') AND p.name LIKE ${filter}
      ORDER BY c.occurred_at DESC, c.id DESC LIMIT 25
    `),
    db.execute(sql`
      SELECT m.id, wf.id AS workFileId, p.name AS project, wf.title AS workFile, m.title,
        m.meeting_status AS status, m.starts_at AS startsAt,
        (SELECT COUNT(*) FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id=m.id AND proposal.review_status='pending') AS pendingProposals,
        (SELECT COUNT(*) FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id=m.id AND minutes.minutes_status='draft') AS draftMinutes
      FROM como_next_meetings m JOIN como_next_work_files wf ON wf.id = m.work_file_id
      JOIN projects p ON p.id = m.project_id AND p.is_test_project = 0
      WHERE wf.user_id = ${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND p.name LIKE ${filter} AND (m.meeting_status IN ('planned','confirmed')
        OR EXISTS (SELECT 1 FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id=m.id AND proposal.review_status='pending')
        OR EXISTS (SELECT 1 FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id=m.id AND minutes.minutes_status='draft'))
      ORDER BY m.starts_at ASC, m.id ASC LIMIT 25
    `),
    db.execute(sql`
      SELECT proposal.id, wf.id AS workFileId, p.name AS project, wf.title AS workFile,
        proposal.source_kind AS sourceKind, proposal.proposal_kind AS proposalKind,
        proposal.title, proposal.priority, proposal.created_at AS createdAt
      FROM como_next_intake_proposals proposal
      JOIN como_next_work_files wf ON wf.id = proposal.work_file_id AND wf.project_id = proposal.project_id
      JOIN projects p ON p.id = proposal.project_id AND p.is_test_project = 0
      WHERE proposal.user_id = ${userId} AND wf.work_file_status NOT IN ('closed','cancelled')
        AND proposal.review_status = 'pending' AND p.name LIKE ${filter}
      ORDER BY CASE proposal.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        proposal.created_at ASC LIMIT 25
    `),
  ]);
  const datasets = {
    work_files: rows<Record<string, unknown>>(workFilesResult),
    actions: rows<Record<string, unknown>>(actionsResult),
    decisions: rows<Record<string, unknown>>(decisionsResult),
    communications: rows<Record<string, unknown>>(communicationsResult),
    meetings: rows<Record<string, unknown>>(meetingsResult),
    proposals: rows<Record<string, unknown>>(proposalsResult),
  };
  if (category === "overview") {
    return presentSaraDubaiTimes({
      found: true,
      source: "COMO Next",
      generatedAt: new Date().toISOString(),
      mailSync,
      counts: Object.fromEntries(Object.entries(datasets).map(([key, value]) => [key, value.length])),
      urgentActions: datasets.actions.filter((item: any) => item.priority === "urgent").slice(0, 6),
      requiredDecisions: datasets.decisions.slice(0, 6),
    });
  }
  if (!(category in datasets)) return { found: false, reason: "نوع معلومات المكتب التنفيذي غير مدعوم" };
  return presentSaraDubaiTimes({ found: true, source: "COMO Next", category, generatedAt: new Date().toISOString(), mailSync, items: datasets[category as keyof typeof datasets] });
}
