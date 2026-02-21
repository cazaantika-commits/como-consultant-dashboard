/**
 * Agent Tools - أدوات الوكلاء للتفاعل مع بيانات المنصة
 * 
 * يمكّن الوكلاء من قراءة وكتابة البيانات في قاعدة البيانات
 * عبر OpenAI/Claude function calling
 */

import { getDb } from "./db";
import {
  consultants, projects, projectConsultants, financialData,
  evaluationScores, evaluatorScores, committeeDecisions,
  consultantDetails, consultantProfiles, consultantNotes,
  tasks, feasibilityStudies, agents, agentAssignments
} from "../drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

// ═══════════════════════════════════════════════════
// Tool Definitions (OpenAI function calling format)
// ═══════════════════════════════════════════════════

export const AGENT_TOOLS = [
  // ─── READ TOOLS ───
  {
    type: "function" as const,
    function: {
      name: "list_projects",
      description: "عرض جميع المشاريع المسجلة في المنصة مع تفاصيلها (الاسم، الوصف، مساحة البناء، سعر القدم المربع)",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_consultants",
      description: "عرض جميع الاستشاريين المسجلين في المنصة مع بياناتهم الأساسية (الاسم، الإيميل، الهاتف، التخصص)",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_project_consultants",
      description: "عرض الاستشاريين المرتبطين بمشروع معين",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_evaluation_scores",
      description: "عرض درجات التقييم الفني لمشروع معين - يشمل درجات كل استشاري في كل معيار من المعايير العشرة",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_evaluator_scores",
      description: "عرض درجات المقيّمين الثلاثة (الشيخ عيسى، وائل، عبدالرحمن) لمشروع معين - تقييم كل مقيّم لكل استشاري في كل معيار",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_financial_data",
      description: "عرض البيانات المالية (أتعاب التصميم والإشراف) لاستشاريي مشروع معين",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_consultant_profile",
      description: "عرض البروفايل التفصيلي لاستشاري معين (الموقع، التصنيف، سنوات الخبرة، عدد المهندسين، العملاء البارزون، نقاط القوة والضعف)",
      parameters: {
        type: "object",
        properties: {
          consultantId: { type: "number", description: "رقم الاستشاري" },
        },
        required: ["consultantId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_committee_decision",
      description: "عرض قرار اللجنة لمشروع معين (الاستشاري المختار، نوع القرار، ملاحظات اللجنة، تحليل وتوصية الذكاء الاصطناعي)",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_feasibility_study",
      description: "عرض دراسة الجدوى لمشروع معين (المساحات، التكاليف، أسعار البيع، الأرباح المتوقعة)",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم دراسة الجدوى" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_tasks",
      description: "عرض المهام المسجلة في المنصة مع حالتها (جديدة، قيد التنفيذ، معلقة، مكتملة)",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["new", "progress", "hold", "done", "cancelled"], description: "فلترة حسب الحالة (اختياري)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_evaluation_criteria",
      description: "عرض معايير التقييم الفني العشرة مع أوزانها ونظام النقاط لكل معيار",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },

  // ─── WRITE TOOLS ───
  {
    type: "function" as const,
    function: {
      name: "add_consultant",
      description: "إضافة استشاري جديد إلى القائمة الرئيسية",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "اسم الاستشاري أو الشركة الاستشارية" },
          email: { type: "string", description: "البريد الإلكتروني (اختياري)" },
          phone: { type: "string", description: "رقم الهاتف (اختياري)" },
          specialization: { type: "string", description: "التخصص (اختياري)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_consultant",
      description: "تحديث بيانات استشاري موجود",
      parameters: {
        type: "object",
        properties: {
          consultantId: { type: "number", description: "رقم الاستشاري" },
          name: { type: "string", description: "الاسم الجديد (اختياري)" },
          email: { type: "string", description: "البريد الإلكتروني الجديد (اختياري)" },
          phone: { type: "string", description: "رقم الهاتف الجديد (اختياري)" },
          specialization: { type: "string", description: "التخصص الجديد (اختياري)" },
        },
        required: ["consultantId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_consultant_to_project",
      description: "ربط استشاري بمشروع معين لتقييمه",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
          consultantId: { type: "number", description: "رقم الاستشاري" },
        },
        required: ["projectId", "consultantId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "remove_consultant_from_project",
      description: "إزالة استشاري من مشروع معين (لا يحذفه من القائمة الرئيسية)",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
          consultantId: { type: "number", description: "رقم الاستشاري" },
        },
        required: ["projectId", "consultantId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_evaluation_score",
      description: "تعيين درجة تقييم لاستشاري في معيار معين لمشروع محدد. المعايير: 0=الهوية المعمارية، 1=القدرات التقنية وBIM، 2=الأتعاب، 3=كفاءة التخطيط، 4=التحكم بالتكاليف، 5=الخبرة، 6=قوة الفريق، 7=إدارة الوقت، 8=الاهتمام بالمشروع، 9=مرونة التعاقد. الدرجات: 2,4,6,8,10",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
          consultantId: { type: "number", description: "رقم الاستشاري" },
          criterionId: { type: "number", description: "رقم المعيار (0-9)" },
          score: { type: "number", description: "الدرجة (2, 4, 6, 8, أو 10)" },
        },
        required: ["projectId", "consultantId", "criterionId", "score"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_financial_data",
      description: "تعيين البيانات المالية (أتعاب التصميم والإشراف) لاستشاري في مشروع معين",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "رقم المشروع" },
          consultantId: { type: "number", description: "رقم الاستشاري" },
          designType: { type: "string", enum: ["pct", "lump"], description: "نوع أتعاب التصميم: pct=نسبة مئوية، lump=مبلغ مقطوع" },
          designValue: { type: "number", description: "قيمة أتعاب التصميم" },
          supervisionType: { type: "string", enum: ["pct", "lump"], description: "نوع أتعاب الإشراف: pct=نسبة مئوية، lump=مبلغ مقطوع" },
          supervisionValue: { type: "number", description: "قيمة أتعاب الإشراف" },
        },
        required: ["projectId", "consultantId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_project",
      description: "إضافة مشروع جديد",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "اسم المشروع" },
          description: { type: "string", description: "وصف المشروع (اختياري)" },
          bua: { type: "number", description: "مساحة البناء بالقدم المربع (اختياري)" },
          pricePerSqft: { type: "number", description: "سعر القدم المربع بالدرهم (اختياري)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_task",
      description: "إضافة مهمة جديدة لمتابعتها",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المهمة" },
          description: { type: "string", description: "وصف المهمة (اختياري)" },
          project: { type: "string", description: "اسم المشروع المرتبط" },
          owner: { type: "string", description: "المسؤول عن المهمة" },
          priority: { type: "string", enum: ["high", "medium", "low"], description: "الأولوية" },
          dueDate: { type: "string", description: "تاريخ الاستحقاق (YYYY-MM-DD)" },
        },
        required: ["title", "project", "owner"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task_status",
      description: "تحديث حالة مهمة (جديدة، قيد التنفيذ، معلقة، مكتملة، ملغاة)",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "رقم المهمة" },
          status: { type: "string", enum: ["new", "progress", "hold", "done", "cancelled"], description: "الحالة الجديدة" },
          progress: { type: "number", description: "نسبة الإنجاز (0-100)" },
        },
        required: ["taskId", "status"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_consultant_profile",
      description: "تحديث البروفايل التفصيلي لاستشاري (الموقع، التصنيف، سنوات الخبرة، نقاط القوة، إلخ)",
      parameters: {
        type: "object",
        properties: {
          consultantId: { type: "number", description: "رقم الاستشاري" },
          companyNameAr: { type: "string", description: "اسم الشركة بالعربي" },
          website: { type: "string", description: "الموقع الإلكتروني" },
          headquarters: { type: "string", description: "المقر الرئيسي" },
          employeeCount: { type: "string", description: "عدد الموظفين" },
          specializations: { type: "string", description: "التخصصات (مفصولة بفواصل)" },
          overview: { type: "string", description: "نبذة عامة عن الشركة" },
          strengths: { type: "string", description: "نقاط القوة" },
          weaknesses: { type: "string", description: "نقاط الضعف" },
        },
        required: ["consultantId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_consultant_note",
      description: "إضافة ملاحظة خاصة على استشاري (ملاحظة اجتماع، تقييم، ملاحظة عامة)",
      parameters: {
        type: "object",
        properties: {
          consultantId: { type: "number", description: "رقم الاستشاري" },
          title: { type: "string", description: "عنوان الملاحظة" },
          content: { type: "string", description: "محتوى الملاحظة" },
          category: { type: "string", enum: ["meeting", "feedback", "general"], description: "تصنيف الملاحظة" },
        },
        required: ["consultantId", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_institutional_memory",
      description: "البحث في الذاكرة المؤسسية للمنظمة - استرجاع القرارات السابقة، التقييمات، الأنماط، والدروس المستفادة من التاريخ. استخدم هذه الأداة للتعلم من التجارب السابقة والحصول على سياق تاريخي قبل اتخاذ قرارات جديدة.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "سؤال أو كلمات بحث للبحث في الذاكرة المؤسسية" },
          type: { 
            type: "string", 
            enum: ["decision", "evaluation", "pattern", "insight", "lesson", "all"],
            description: "نوع المعرفة المطلوبة (اختياري - افتراضياً: all)" 
          },
          limit: { type: "number", description: "عدد النتائج المطلوبة (افتراضياً: 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ask_another_agent",
      description: "طلب مساعدة من وكيل آخر - استخدم هذه الأداة عندما تحتاج معلومات أو مساعدة من وكيل متخصص آخر. مثلاً: سلوى تسأل خالد عن معايير التقييم، أو ألينا تسأل فاروق عن تحليل مالي. الوكلاء المتاحون: salwa (المنسقة), farouq (المحلل القانوني والمالي), khazen (مدير الأرشفة), buraq (مراقب التنفيذ), khaled (مدقق الجودة), alina (المديرة المالية), baz (المستشار الاستراتيجي), joelle (محللة دراسات الجدوى)",
      parameters: {
        type: "object",
        properties: {
          targetAgent: { 
            type: "string", 
            enum: ["salwa", "farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"],
            description: "الوكيل المستهدف" 
          },
          question: { type: "string", description: "السؤال أو الطلب الموجه للوكيل الآخر" },
        },
        required: ["targetAgent", "question"],
      },
    },
  },
];

// ═══════════════════════════════════════════════════
// Evaluation Criteria (shared with frontend)
// ═══════════════════════════════════════════════════

const EVALUATION_CRITERIA = [
  { id: 0, name: 'الهوية المعمارية وجودة التصميم', weight: 12.75 },
  { id: 1, name: 'القدرات التقنية والتكامل مع BIM', weight: 12.75 },
  { id: 2, name: 'الأتعاب المهنية', weight: 12.75 },
  { id: 3, name: 'كفاءة التخطيط وتحسين المساحات', weight: 11.9 },
  { id: 4, name: 'التحكم في التكاليف والوعي بالميزانية', weight: 9.35 },
  { id: 5, name: 'الخبرة في مشاريع مشابهة', weight: 8.5 },
  { id: 6, name: 'قوة فريق المشروع', weight: 8.5 },
  { id: 7, name: 'إدارة الوقت والتحكم في البرنامج', weight: 8.5 },
  { id: 8, name: 'الاهتمام الخاص بالمشروع ومرونة التعامل', weight: 8 },
  { id: 9, name: 'مرونة التعاقد', weight: 7 },
];

// ═══════════════════════════════════════════════════
// Tool Execution Functions
// ═══════════════════════════════════════════════════

// Write tools that should be logged as assignments
const WRITE_TOOL_NAMES = new Set([
  "add_consultant", "update_consultant", "add_consultant_to_project",
  "remove_consultant_from_project", "set_evaluation_score", "set_financial_data",
  "add_project", "add_task", "update_task_status", "update_consultant_profile",
  "add_consultant_note"
]);

// Current agent context for assignment logging
let _currentAgent: string = "";
let _currentUserMessage: string = "";

export function setAgentContext(agent: string, userMessage: string) {
  _currentAgent = agent;
  _currentUserMessage = userMessage;
}

export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>,
  userId: number
): Promise<string> {
  const db = await getDb();
  if (!db) return JSON.stringify({ error: "قاعدة البيانات غير متاحة" });

  try {
    // Auto-log write operations as assignments
    let assignmentId: number | null = null;
    if (WRITE_TOOL_NAMES.has(toolName)) {
      try {
        const [inserted] = await db.insert(agentAssignments).values({
          userId,
          agent: _currentAgent || "unknown",
          userMessage: _currentUserMessage || "(direct tool call)",
          toolUsed: toolName,
          toolArgs: JSON.stringify(args),
          status: "executing",
        });
        assignmentId = inserted.insertId;
        console.log(`[AgentAssignment] Created #${assignmentId}: ${toolName} by ${_currentAgent}`);
      } catch (e) {
        console.error("[AgentAssignment] Failed to create:", e);
      }
    }

    const result = await _executeToolInternal(db, toolName, args, userId);

    // Update assignment status
    if (assignmentId) {
      try {
        const parsed = JSON.parse(result);
        const status = parsed.error ? "failed" : "completed";
        await db.update(agentAssignments)
          .set({ 
            toolResult: result.substring(0, 2000),
            status,
            completedAt: new Date(),
          })
          .where(eq(agentAssignments.id, assignmentId));
      } catch (e) {
        console.error("[AgentAssignment] Failed to update:", e);
      }
    }

    return result;
  } catch (error: any) {
    console.error(`[AgentTools] Error executing ${toolName}:`, error);
    return JSON.stringify({ error: `خطأ في تنفيذ الأداة: ${error.message}` });
  }
}

async function _executeToolInternal(
  db: any,
  toolName: string,
  args: Record<string, any>,
  userId: number
): Promise<string> {
  try {
    switch (toolName) {
      // ─── READ ───
      case "list_projects": {
        const result = await db.select().from(projects);
        if (result.length === 0) return JSON.stringify({ message: "لا توجد مشاريع مسجلة", data: [] });
        return JSON.stringify({
          message: `${result.length} مشروع مسجل`,
          data: result.map((p: any) => ({
            id: p.id, name: p.name, description: p.description,
            bua: p.bua, pricePerSqft: p.pricePerSqft, notes: p.notes
          }))
        });
      }

      case "list_consultants": {
        const result = await db.select().from(consultants);
        if (result.length === 0) return JSON.stringify({ message: "لا يوجد استشاريون مسجلون", data: [] });
        return JSON.stringify({
          message: `${result.length} استشاري مسجل`,
          data: result.map((c: any) => ({
            id: c.id, name: c.name, email: c.email,
            phone: c.phone, specialization: c.specialization
          }))
        });
      }

      case "get_project_consultants": {
        const { projectId } = args;
        const relations = await db.select().from(projectConsultants).where(eq(projectConsultants.projectId, projectId));
        if (relations.length === 0) return JSON.stringify({ message: "لا يوجد استشاريون مرتبطون بهذا المشروع", data: [] });
        const ids: number[] = relations.map((r: any) => r.consultantId);
        const result = await db.select().from(consultants).where(inArray(consultants.id, ids));
        return JSON.stringify({
          message: `${result.length} استشاري مرتبط بالمشروع`,
          data: result.map((c: any) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, specialization: c.specialization }))
        });
      }

      case "get_evaluation_scores": {
        const { projectId } = args;
        const scores = await db.select().from(evaluationScores).where(eq(evaluationScores.projectId, projectId));
        if (scores.length === 0) return JSON.stringify({ message: "لا توجد تقييمات لهذا المشروع", data: [] });
        
        // Get consultant names
        const consultantIds: number[] = Array.from(new Set(scores.map((s: any) => s.consultantId)));
        const consultantList = await db.select().from(consultants).where(inArray(consultants.id, consultantIds));
        const consultantMap = Object.fromEntries(consultantList.map((c: any) => [c.id, c.name]));
        
        return JSON.stringify({
          message: `${scores.length} تقييم لـ ${consultantIds.length} استشاري`,
          criteria: EVALUATION_CRITERIA,
          data: scores.map((s: any) => ({
            consultantId: s.consultantId,
            consultantName: consultantMap[s.consultantId] || "غير معروف",
            criterionId: s.criterionId,
            criterionName: EVALUATION_CRITERIA[s.criterionId]?.name || "غير معروف",
            weight: EVALUATION_CRITERIA[s.criterionId]?.weight || 0,
            score: s.score,
          }))
        });
      }

      case "get_evaluator_scores": {
        const { projectId } = args;
        const scores = await db.select().from(evaluatorScores).where(eq(evaluatorScores.projectId, projectId));
        if (scores.length === 0) return JSON.stringify({ message: "لا توجد تقييمات للمقيّمين لهذا المشروع", data: [] });
        
        const consultantIds: number[] = Array.from(new Set(scores.map((s: any) => s.consultantId)));
        const consultantList = await db.select().from(consultants).where(inArray(consultants.id, consultantIds));
        const consultantMap = Object.fromEntries(consultantList.map((c: any) => [c.id, c.name]));
        
        return JSON.stringify({
          message: `${scores.length} تقييم من المقيّمين`,
          data: scores.map((s: any) => ({
            consultantId: s.consultantId,
            consultantName: consultantMap[s.consultantId] || "غير معروف",
            criterionId: s.criterionId,
            criterionName: EVALUATION_CRITERIA[s.criterionId]?.name || "غير معروف",
            evaluatorName: s.evaluatorName,
            score: s.score,
          }))
        });
      }

      case "get_financial_data": {
        const { projectId } = args;
        const fees = await db.select().from(financialData).where(eq(financialData.projectId, projectId));
        if (fees.length === 0) return JSON.stringify({ message: "لا توجد بيانات مالية لهذا المشروع", data: [] });
        
        const consultantIds: number[] = Array.from(new Set(fees.map((f: any) => f.consultantId)));
        const consultantList = await db.select().from(consultants).where(inArray(consultants.id, consultantIds));
        const consultantMap = Object.fromEntries(consultantList.map((c: any) => [c.id, c.name]));
        
        return JSON.stringify({
          message: `بيانات مالية لـ ${fees.length} استشاري`,
          data: fees.map((f: any) => ({
            consultantId: f.consultantId,
            consultantName: consultantMap[f.consultantId] || "غير معروف",
            designType: f.designType === "pct" ? "نسبة مئوية" : "مبلغ مقطوع",
            designValue: f.designValue,
            supervisionType: f.supervisionType === "pct" ? "نسبة مئوية" : "مبلغ مقطوع",
            supervisionValue: f.supervisionValue,
            proposalLink: f.proposalLink,
          }))
        });
      }

      case "get_consultant_profile": {
        const { consultantId } = args;
        // Get basic info
        const basic = await db.select().from(consultants).where(eq(consultants.id, consultantId)).limit(1);
        if (basic.length === 0) return JSON.stringify({ error: "الاستشاري غير موجود" });
        
        // Get details
        const details = await db.select().from(consultantDetails).where(eq(consultantDetails.consultantId, consultantId)).limit(1);
        const profile = await db.select().from(consultantProfiles).where(eq(consultantProfiles.consultantId, consultantId)).limit(1);
        const notes = await db.select().from(consultantNotes).where(eq(consultantNotes.consultantId, consultantId)).orderBy(desc(consultantNotes.createdAt)).limit(5);
        
        return JSON.stringify({
          basic: { id: basic[0].id, name: basic[0].name, email: basic[0].email, phone: basic[0].phone, specialization: basic[0].specialization },
          details: details[0] || null,
          profile: profile[0] ? {
            companyNameAr: profile[0].companyNameAr,
            founded: profile[0].founded,
            headquarters: profile[0].headquarters,
            website: profile[0].website,
            employeeCount: profile[0].employeeCount,
            specializations: profile[0].specializations,
            overview: profile[0].overview,
            strengths: profile[0].strengths,
            weaknesses: profile[0].weaknesses,
          } : null,
          recentNotes: notes.map((n: any) => ({ title: n.title, content: n.content, category: n.category, date: n.createdAt })),
        });
      }

      case "get_committee_decision": {
        const { projectId } = args;
        const decision = await db.select().from(committeeDecisions).where(eq(committeeDecisions.projectId, projectId)).limit(1);
        if (decision.length === 0) return JSON.stringify({ message: "لا يوجد قرار للجنة لهذا المشروع" });
        
        let consultantName = "غير محدد";
        if (decision[0].selectedConsultantId) {
          const c = await db.select().from(consultants).where(eq(consultants.id, decision[0].selectedConsultantId)).limit(1);
          if (c.length > 0) consultantName = c[0].name;
        }
        
        return JSON.stringify({
          selectedConsultant: consultantName,
          decisionType: decision[0].decisionType,
          negotiationTarget: decision[0].negotiationTarget,
          committeeNotes: decision[0].committeeNotes,
          aiAnalysis: decision[0].aiAnalysis,
          aiRecommendation: decision[0].aiRecommendation,
        });
      }

      case "get_feasibility_study": {
        const { projectId } = args;
        const study = await db.select().from(feasibilityStudies).where(eq(feasibilityStudies.id, projectId)).limit(1);
        if (study.length === 0) return JSON.stringify({ message: "لا توجد دراسة جدوى بهذا الرقم" });
        const s = study[0];
        return JSON.stringify({
          projectName: s.projectName, community: s.community, plotNumber: s.plotNumber,
          plotArea: s.plotArea, totalGfa: s.totalGfa, estimatedBua: s.estimatedBua,
          numberOfUnits: s.numberOfUnits, landPrice: s.landPrice,
          constructionCostPerSqft: s.constructionCostPerSqft,
          residentialSalePrice: s.residentialSalePrice, retailSalePrice: s.retailSalePrice,
          notes: s.notes,
        });
      }

      case "list_tasks": {
        const { status } = args;
        let query = db.select().from(tasks);
        if (status) {
          query = db.select().from(tasks).where(eq(tasks.status, status)) as any;
        }
        const result = await query.orderBy(desc(tasks.createdAt)).limit(30);
        return JSON.stringify({
          message: `${result.length} مهمة`,
          data: result.map((t: any) => ({
            id: t.id, title: t.title, project: t.project, owner: t.owner,
            priority: t.priority, status: t.status, progress: t.progress,
            dueDate: t.dueDate, source: t.source, sourceAgent: t.sourceAgent,
          }))
        });
      }

      case "get_evaluation_criteria": {
        return JSON.stringify({
          message: "معايير التقييم الفني العشرة",
          totalWeight: 100,
          criteria: EVALUATION_CRITERIA.map((c: any) => ({
            id: c.id, name: c.name, weight: c.weight,
            scoreOptions: "2 (ضعيف جداً), 4 (ضعيف), 6 (متوسط), 8 (جيد), 10 (ممتاز)"
          }))
        });
      }

      // ─── WRITE ───
      case "add_consultant": {
        const { name, email, phone, specialization } = args;
        const result = await db.insert(consultants).values({
          userId, name, email: email || null, phone: phone || null, specialization: specialization || null
        });
        return JSON.stringify({ success: true, message: `تم إضافة الاستشاري "${name}" بنجاح`, consultantId: (result as any)[0]?.insertId });
      }

      case "update_consultant": {
        const { consultantId, ...updates } = args;
        const existing = await db.select().from(consultants).where(eq(consultants.id, consultantId)).limit(1);
        if (existing.length === 0) return JSON.stringify({ error: "الاستشاري غير موجود" });
        
        const updateData: any = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.email !== undefined) updateData.email = updates.email;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.specialization !== undefined) updateData.specialization = updates.specialization;
        
        if (Object.keys(updateData).length > 0) {
          await db.update(consultants).set(updateData).where(eq(consultants.id, consultantId));
        }
        return JSON.stringify({ success: true, message: `تم تحديث بيانات "${existing[0].name}" بنجاح` });
      }

      case "add_consultant_to_project": {
        const { projectId, consultantId } = args;
        // Check if already linked
        const existing = await db.select().from(projectConsultants)
          .where(and(eq(projectConsultants.projectId, projectId), eq(projectConsultants.consultantId, consultantId))).limit(1);
        if (existing.length > 0) return JSON.stringify({ message: "الاستشاري مرتبط بالمشروع مسبقاً" });
        
        await db.insert(projectConsultants).values({ projectId, consultantId });
        return JSON.stringify({ success: true, message: "تم ربط الاستشاري بالمشروع بنجاح" });
      }

      case "remove_consultant_from_project": {
        const { projectId, consultantId } = args;
        await db.delete(projectConsultants)
          .where(and(eq(projectConsultants.projectId, projectId), eq(projectConsultants.consultantId, consultantId)));
        return JSON.stringify({ success: true, message: "تم إزالة الاستشاري من المشروع" });
      }

      case "set_evaluation_score": {
        const { projectId, consultantId, criterionId, score } = args;
        if (criterionId < 0 || criterionId > 9) return JSON.stringify({ error: "رقم المعيار يجب أن يكون بين 0 و 9" });
        if (![2, 4, 6, 8, 10].includes(score)) return JSON.stringify({ error: "الدرجة يجب أن تكون 2, 4, 6, 8, أو 10" });
        
        const existing = await db.select().from(evaluationScores)
          .where(and(eq(evaluationScores.projectId, projectId), eq(evaluationScores.consultantId, consultantId), eq(evaluationScores.criterionId, criterionId)))
          .limit(1);
        
        if (existing.length > 0) {
          await db.update(evaluationScores).set({ score })
            .where(and(eq(evaluationScores.projectId, projectId), eq(evaluationScores.consultantId, consultantId), eq(evaluationScores.criterionId, criterionId)));
        } else {
          await db.insert(evaluationScores).values({ projectId, consultantId, criterionId, score });
        }
        
        return JSON.stringify({
          success: true,
          message: `تم تعيين ${score} نقاط لمعيار "${EVALUATION_CRITERIA[criterionId]?.name}" بنجاح`
        });
      }

      case "set_financial_data": {
        const { projectId, consultantId, designType, designValue, supervisionType, supervisionValue } = args;
        const existing = await db.select().from(financialData)
          .where(and(eq(financialData.projectId, projectId), eq(financialData.consultantId, consultantId)))
          .limit(1);
        
        const data: any = {};
        if (designType) data.designType = designType;
        if (designValue !== undefined) data.designValue = designValue;
        if (supervisionType) data.supervisionType = supervisionType;
        if (supervisionValue !== undefined) data.supervisionValue = supervisionValue;
        
        if (existing.length > 0) {
          await db.update(financialData).set(data)
            .where(and(eq(financialData.projectId, projectId), eq(financialData.consultantId, consultantId)));
        } else {
          await db.insert(financialData).values({ projectId, consultantId, ...data });
        }
        return JSON.stringify({ success: true, message: "تم تحديث البيانات المالية بنجاح" });
      }

      case "add_project": {
        const { name, description, bua, pricePerSqft } = args;
        const result = await db.insert(projects).values({
          userId, name, description: description || null,
          bua: bua || null, pricePerSqft: pricePerSqft || null
        });
        return JSON.stringify({ success: true, message: `تم إضافة المشروع "${name}" بنجاح`, projectId: (result as any)[0]?.insertId });
      }

      case "add_task": {
        const { title, description, project, owner, priority, dueDate } = args;
        const result = await db.insert(tasks).values({
          title, description: description || null, project, owner,
          priority: priority || "medium", dueDate: dueDate || null,
          source: "agent", sourceAgent: "agent-tool",
        });
        return JSON.stringify({ success: true, message: `تم إضافة المهمة "${title}" بنجاح` });
      }

      case "update_task_status": {
        const { taskId, status, progress } = args;
        const updateData: any = { status };
        if (progress !== undefined) updateData.progress = progress;
        await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));
        return JSON.stringify({ success: true, message: `تم تحديث حالة المهمة إلى "${status}"` });
      }

      case "update_consultant_profile": {
        const { consultantId, ...profileData } = args;
        const existing = await db.select().from(consultantProfiles).where(eq(consultantProfiles.consultantId, consultantId)).limit(1);
        
        if (existing.length > 0) {
          await db.update(consultantProfiles).set(profileData).where(eq(consultantProfiles.consultantId, consultantId));
        } else {
          await db.insert(consultantProfiles).values({ consultantId, ...profileData });
        }
        return JSON.stringify({ success: true, message: "تم تحديث بروفايل الاستشاري بنجاح" });
      }

      case "add_consultant_note": {
        const { consultantId, title, content, category } = args;
        await db.insert(consultantNotes).values({
          consultantId, userId, title: title || null, content,
          category: category || "general"
        });
        return JSON.stringify({ success: true, message: "تم إضافة الملاحظة بنجاح" });
      }

      case "query_institutional_memory": {
        // Query institutional memory
        const { query, type, limit } = args;
        const { searchKnowledgeBase } = await import("./db");
        
        const results = await searchKnowledgeBase(userId, query, limit || 10);
        
        if (results.length === 0) {
          return JSON.stringify({ 
            message: "لم يتم العثور على نتائج في الذاكرة المؤسسية",
            results: [] 
          });
        }
        
        // Filter by type if specified
        const filteredResults = type && type !== 'all' 
          ? results.filter((r: any) => r.type === type)
          : results;
        
        // Format results for agent
        const formattedResults = filteredResults.map((item: any) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          summary: item.summary || item.content.substring(0, 200) + "...",
          importance: item.importance,
          sourceAgent: item.sourceAgent,
          createdAt: item.createdAt,
          tags: item.tags,
        }));
        
        return JSON.stringify({
          success: true,
          count: formattedResults.length,
          results: formattedResults,
          message: `تم العثور على ${formattedResults.length} نتيجة في الذاكرة المؤسسية`
        });
      }

      case "ask_another_agent": {
        // Agent-to-agent communication - import agentChat and call it
        const { targetAgent, question } = args;
        const { agentChat } = await import("./agentChat");
        const response = await agentChat({
          agent: targetAgent,
          message: `[طلب من ${_currentAgent || "unknown"}] ${question}`,
          conversationHistory: [],
          userId,
        });
        return JSON.stringify({ 
          success: true, 
          agent: targetAgent, 
          question, 
          response: response.response 
        });
      }

      default:
        return JSON.stringify({ error: `أداة غير معروفة: ${toolName}` });
    }
  } catch (error: any) {
    console.error(`[AgentTools] Error in tool ${toolName}:`, error);
    return JSON.stringify({ error: `خطأ في تنفيذ الأداة: ${error.message}` });
  }
}

// ═══════════════════════════════════════════════════
// Assignment query helpers
// ═══════════════════════════════════════════════════

export async function getAgentAssignments(filters?: { agent?: string; status?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(agentAssignments).orderBy(desc(agentAssignments.createdAt));
  
  if (filters?.agent) {
    query = query.where(eq(agentAssignments.agent, filters.agent)) as any;
  }
  
  const limit = filters?.limit || 50;
  const results = await query.limit(limit);
  
  if (filters?.status) {
    return results.filter((r: any) => r.status === filters.status);
  }
  
  return results;
}

export async function getAssignmentStats() {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, failed: 0, executing: 0, byAgent: {} };
  
  const rawResult = await db.select().from(agentAssignments);
  const all = Array.isArray(rawResult) ? rawResult : [];
  const byAgent: Record<string, number> = {};
  let completed = 0, failed = 0, executing = 0;
  
  for (const a of all) {
    byAgent[a.agent] = (byAgent[a.agent] || 0) + 1;
    if (a.status === "completed") completed++;
    else if (a.status === "failed") failed++;
    else executing++;
  }
  
  return { total: all.length, completed, failed, executing, byAgent };
}

// ═══════════════════════════════════════════════════
// Agent-specific tool access control
// ═══════════════════════════════════════════════════

type AgentType = "salwa" | "farouq" | "khazen" | "buraq" | "khaled" | "alina" | "baz" | "joelle";

const AGENT_ALLOWED_TOOLS: Record<AgentType, string[]> = {
  salwa: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_evaluation_scores", "get_financial_data", "get_evaluation_criteria",
    "list_tasks", "add_consultant", "add_consultant_to_project",
    "add_project", "add_task", "update_task_status",
    "get_consultant_profile", "get_committee_decision", "ask_another_agent",
  ],
  farouq: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_evaluation_scores", "get_evaluator_scores", "get_financial_data",
    "get_evaluation_criteria", "get_consultant_profile", "get_committee_decision",
    "set_evaluation_score", "set_financial_data", "add_consultant_note",
    "update_consultant_profile", "add_consultant", "ask_another_agent",
  ],
  khaled: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_evaluation_scores", "get_evaluator_scores", "get_financial_data",
    "get_evaluation_criteria", "get_consultant_profile",
    "set_evaluation_score", "add_consultant_note", "ask_another_agent",
  ],
  alina: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_financial_data", "get_evaluation_scores", "get_evaluation_criteria",
    "get_feasibility_study", "set_financial_data", "get_consultant_profile", "ask_another_agent",
  ],
  joelle: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_financial_data", "get_evaluation_scores", "get_evaluation_criteria",
    "get_feasibility_study", "get_consultant_profile", "get_committee_decision", "ask_another_agent",
  ],
  baz: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_evaluation_scores", "get_financial_data", "get_evaluation_criteria",
    "get_consultant_profile", "get_committee_decision", "list_tasks",
    "add_task", "ask_another_agent",
  ],
  buraq: [
    "list_projects", "list_consultants", "list_tasks",
    "add_task", "update_task_status", "get_project_consultants", "ask_another_agent",
  ],
  khazen: [
    "list_projects", "list_consultants", "get_consultant_profile",
    "add_consultant_note", "list_tasks", "ask_another_agent",
  ],
};

export function getToolsForAgent(agent: AgentType) {
  const allowedNames = AGENT_ALLOWED_TOOLS[agent] || [];
  return AGENT_TOOLS.filter(t => allowedNames.includes(t.function.name));
}
