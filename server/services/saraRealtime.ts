import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

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
    name: "lookup_command_center",
    description: "اقرئي المعلومات الحالية الموثقة من مركز القيادة: القرارات والاعتمادات وطلبات الصرف والطلبات والمهام والاجتماعات والتقييمات وحالة المشاريع والتحديثات. هذه أداة قراءة فقط ولا تنفذ أي إجراء.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["overview", "decisions", "approvals", "payment_requests", "requests", "tasks", "meetings", "evaluations", "project_status", "updates"],
        },
        project_name: { type: "string", description: "اسم المشروع عند السؤال عن مشروع محدد" },
      },
      required: ["category"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    name: "lookup_executive_workspace",
    description: "اقرئي مكتب COMO Next التنفيذي: ملفات العمل والإجراءات والقرارات ومسودات المراسلات والاجتماعات التي تحتاج انتباهًا. متاحة لعبدالرحمن فقط، ولا ترسل أو تعدل أي شيء.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["overview", "work_files", "actions", "decisions", "communications", "meetings"],
        },
        project_name: { type: "string", description: "اسم المشروع اختياري لتضييق النتيجة" },
      },
      required: ["category"],
      additionalProperties: false,
    },
  },
] as const;

export function buildSaraRealtimeInstructions(member: SaraMember) {
  const address = member.memberId === "abdulrahman" ? "عبدالرحمن" : member.nameAr;
  return `أنتِ سارة، الواجهة الصوتية والمرئية الوحيدة في تطبيق COMO أمام ${address}. تحدثي بالعربية الطبيعية بلهجة لبنانية خفيفة وواضحة، بجمل قصيرة ومهنية وودودة. ابدئي التحية الأولى فقط بـ«أهلين يا ${address}» ثم لا تكرري الترحيب في كل دور.

حدود الدور الملزمة:
- سارة هي واجهة الحديث والاستماع والوصول السريع إلى معلومات COMO، وليست العقل التنفيذي البديل.
- Manus هو العقل التنفيذي للأبحاث العميقة، قراءة الملفات الكبيرة، التحليل، إعداد التقارير، وبناء المخرجات. إذا طلب المستخدم عملاً من هذا النوع فقولي بوضوح إنه يحتاج تكليف Manus داخل ملف العمل، ولا تدّعي أن التنفيذ بدأ ما لم توجد أداة صريحة أعادت نتيجة نجاح.
- استخدمي أدوات القراءة عند السؤال عن الحالة الحالية أو الأرقام أو المشاريع. لا تخمّني ولا تستخدمي ذاكرة المحادثة بدل المصدر المتاح.
- لا ترسلي بريدًا أو واتساب أو تيليغرام، ولا تعتمدي قرارًا أو محضرًا، ولا تنشئي التزامًا خارجيًا. لا توجد في هذه الجلسة أي أداة كتابة أو إرسال.
- القرار ليس تنفيذًا، والمسودة ليست إرسالًا، والتحليل ليس اعتمادًا.
- عند عدم وجود دليل كافٍ قولي ذلك مباشرة واسألي عن المصدر أو الخطوة المطلوبة.
- لا تقرئي القوائم الطويلة حرفيًا؛ أعطي الزبدة ثم اقترحي خطوة واحدة تالية.
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
    return { found: false, reason: "مكتب COMO Next التنفيذي خاص بعبدالرحمن." };
  }
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
  const { category, projectName } = normalizeToolArgs(rawArguments);
  const filter = projectName ? `%${projectName}%` : "%";
  const [workFilesResult, actionsResult, decisionsResult, communicationsResult, meetingsResult] = await Promise.all([
    db.execute(sql`
      SELECT wf.id, p.name AS project, wf.title, wf.governing_question AS governingQuestion,
        wf.work_file_status AS status, wf.priority, wf.updated_at AS updatedAt
      FROM como_next_work_files wf JOIN projects p ON p.id = wf.project_id AND p.is_test_project = 0
      LEFT JOIN como_next_import_batches b ON b.batch_id = wf.import_batch_id
      WHERE wf.work_file_status NOT IN ('closed','cancelled') AND p.name LIKE ${filter}
        AND (wf.import_batch_id IS NULL OR b.batch_status = 'promoted')
      ORDER BY CASE wf.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END, wf.updated_at DESC LIMIT 25
    `),
    db.execute(sql`
      SELECT a.id, p.name AS project, wf.title AS workFile, a.title, a.action_status AS status,
        a.priority, a.owner_type AS ownerType, a.due_at AS dueAt, a.follow_up_at AS followUpAt
      FROM como_next_actions a JOIN como_next_work_files wf ON wf.id = a.work_file_id
      JOIN projects p ON p.id = a.project_id AND p.is_test_project = 0
      WHERE a.action_status NOT IN ('verified','cancelled') AND p.name LIKE ${filter}
      ORDER BY CASE a.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
        CASE WHEN a.attention_at IS NULL THEN 1 ELSE 0 END, a.attention_at ASC LIMIT 30
    `),
    db.execute(sql`
      SELECT d.id, p.name AS project, wf.title AS workFile, d.title, d.question,
        d.decision_status AS status, d.decision_authority AS authority, d.due_at AS dueAt
      FROM como_next_decisions d JOIN como_next_work_files wf ON wf.id = d.work_file_id
      JOIN projects p ON p.id = d.project_id AND p.is_test_project = 0
      WHERE d.decision_status IN ('required','deferred') AND p.name LIKE ${filter}
      ORDER BY d.due_at ASC, d.id ASC LIMIT 25
    `),
    db.execute(sql`
      SELECT c.id, p.name AS project, wf.title AS workFile, c.subject, c.channel,
        c.communication_status AS status, c.approval_status AS approvalStatus
      FROM como_next_communications c JOIN como_next_work_files wf ON wf.id = c.work_file_id
      JOIN projects p ON p.id = c.project_id AND p.is_test_project = 0
      WHERE c.communication_status IN ('draft','approved_for_send') AND p.name LIKE ${filter}
      ORDER BY c.created_at ASC LIMIT 25
    `),
    db.execute(sql`
      SELECT m.id, p.name AS project, wf.title AS workFile, m.title,
        m.meeting_status AS status, m.starts_at AS startsAt,
        (SELECT COUNT(*) FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id=m.id AND proposal.review_status='pending') AS pendingProposals,
        (SELECT COUNT(*) FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id=m.id AND minutes.minutes_status='draft') AS draftMinutes
      FROM como_next_meetings m JOIN como_next_work_files wf ON wf.id = m.work_file_id
      JOIN projects p ON p.id = m.project_id AND p.is_test_project = 0
      WHERE p.name LIKE ${filter} AND (m.meeting_status IN ('planned','confirmed')
        OR EXISTS (SELECT 1 FROM como_next_meeting_proposals proposal WHERE proposal.meeting_id=m.id AND proposal.review_status='pending')
        OR EXISTS (SELECT 1 FROM como_next_meeting_minutes minutes WHERE minutes.meeting_id=m.id AND minutes.minutes_status='draft'))
      ORDER BY m.starts_at ASC, m.id ASC LIMIT 25
    `),
  ]);
  const datasets = {
    work_files: rows<Record<string, unknown>>(workFilesResult),
    actions: rows<Record<string, unknown>>(actionsResult),
    decisions: rows<Record<string, unknown>>(decisionsResult),
    communications: rows<Record<string, unknown>>(communicationsResult),
    meetings: rows<Record<string, unknown>>(meetingsResult),
  };
  if (category === "overview") {
    return {
      found: true,
      source: "COMO Next",
      generatedAt: new Date().toISOString(),
      counts: Object.fromEntries(Object.entries(datasets).map(([key, value]) => [key, value.length])),
      urgentActions: datasets.actions.filter((item: any) => item.priority === "urgent").slice(0, 6),
      requiredDecisions: datasets.decisions.slice(0, 6),
    };
  }
  if (!(category in datasets)) return { found: false, reason: "نوع معلومات المكتب التنفيذي غير مدعوم" };
  return { found: true, source: "COMO Next", category, generatedAt: new Date().toISOString(), items: datasets[category as keyof typeof datasets] };
}
