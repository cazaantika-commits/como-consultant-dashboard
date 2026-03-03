import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { stageItems, stageDocuments, projects, tasks, agents, agentActivityLog } from "../../drizzle/schema";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { storagePut } from "../storage";

// ═══════════════════════════════════════════════════════════════
// Agent mapping per phase/section - which agent handles what
// ═══════════════════════════════════════════════════════════════

// Map each section to the responsible agent(s)
export const SECTION_AGENT_MAP: Record<string, { primary: string; secondary?: string; category: string }> = {
  // Phase 2: Legal Setup - فاروق (المحامي)
  "2.1": { primary: "فاروق", category: "قانوني" },
  "2.2": { primary: "فاروق", category: "قانوني" },
  "2.3": { primary: "فاروق", category: "قانوني" },
  "2.4": { primary: "فاروق", secondary: "خالد", category: "امتثال" },
  // Phase 3: Design & Permits - خالد (الجودة) + باز (الاستراتيجي)
  "3.1": { primary: "خالد", secondary: "باز", category: "تصميم" },
  "3.2": { primary: "خالد", category: "هندسة" },
  "3.3": { primary: "خالد", secondary: "فاروق", category: "تصاريح" },
  "3.4": { primary: "خالد", secondary: "ألينا", category: "مواصفات" },
  // Phase 4: Financing & Marketing - ألينا (المالية) + جويل (الجدوى)
  "4.1": { primary: "ألينا", secondary: "جويل", category: "تمويل" },
  "4.2": { primary: "باز", category: "تسويق" },
  "4.3": { primary: "ألينا", category: "مبيعات" },
  // Phase 5: Construction - براق (مراقب التنفيذ)
  "5.1": { primary: "براق", category: "بناء" },
  "5.2": { primary: "براق", secondary: "خالد", category: "إنشاءات" },
  "5.3": { primary: "براق", secondary: "خالد", category: "تشطيبات" },
  "5.4": { primary: "خالد", secondary: "براق", category: "جودة" },
  // Phase 6: Handover - خالد (الجودة) + براق
  "6.1": { primary: "براق", secondary: "فاروق", category: "تسليم" },
  "6.2": { primary: "خالد", category: "إدارة مرافق" },
  "6.3": { primary: "سلوى", secondary: "خالد", category: "خدمة عملاء" },
};

// Helper: Create a task in the tasks system when a stage item status changes
async function createLinkedTask(
  db: any,
  stageItem: { id: number; title: string; sectionKey: string; phaseNumber: number; projectId: number },
  newStatus: string,
  projectName: string
): Promise<number | null> {
  const mapping = SECTION_AGENT_MAP[stageItem.sectionKey];
  if (!mapping) return null;

  // Determine task details based on status change
  let taskTitle = "";
  let taskDescription = "";
  let taskPriority: "high" | "medium" | "low" = "medium";
  let taskStatus: "new" | "progress" = "new";

  const phaseData = DEFAULT_STAGES[stageItem.phaseNumber as keyof typeof DEFAULT_STAGES];
  const phaseName = phaseData?.title || `المرحلة ${stageItem.phaseNumber}`;
  const sectionData = phaseData?.sections[stageItem.sectionKey as keyof typeof phaseData.sections];
  const sectionName = sectionData?.title || stageItem.sectionKey;

  if (newStatus === "in_progress") {
    taskTitle = `⚡ متابعة: ${stageItem.title}`;
    taskDescription = `تم بدء العمل على "${stageItem.title}" في ${sectionName} (${phaseName}).\n\n` +
      `المطلوب من ${mapping.primary}:\n` +
      `- متابعة تنفيذ هذه المهمة\n` +
      `- التأكد من استيفاء جميع المتطلبات\n` +
      `- الإبلاغ عن أي عوائق أو تأخيرات`;
    taskPriority = "high";
    taskStatus = "progress";
  } else if (newStatus === "completed") {
    taskTitle = `✅ مراجعة اكتمال: ${stageItem.title}`;
    taskDescription = `تم إكمال "${stageItem.title}" في ${sectionName} (${phaseName}).\n\n` +
      `المطلوب من ${mapping.primary}:\n` +
      `- مراجعة والتحقق من اكتمال المهمة\n` +
      `- التأكد من توفر جميع المستندات المطلوبة\n` +
      `- تحديث السجلات وإغلاق الملف`;
    taskPriority = "medium";
    taskStatus = "new";
  } else {
    return null; // No task for not_started
  }

  // Create the task
  const result = await db.insert(tasks).values({
    title: taskTitle,
    description: taskDescription,
    project: projectName,
    category: mapping.category,
    owner: mapping.primary,
    priority: taskPriority,
    status: taskStatus,
    progress: newStatus === "in_progress" ? 10 : 0,
    source: "agent" as const,
    sourceAgent: "سلوى",
  });

  const taskId = Number(result[0].insertId);

  // Log agent activity
  try {
    await db.insert(agentActivityLog).values({
      agentName: "سلوى",
      agentModel: "System",
      actionType: "task_execution" as const,
      toolName: "stage_task_link",
      inputSummary: `ربط مرحلة التطوير: ${stageItem.title} → ${newStatus}`,
      outputSummary: `تم إنشاء مهمة #${taskId} وتعيينها لـ ${mapping.primary}`,
      status: "success" as const,
      triggerSource: "stage_update",
      relatedEntityType: "task",
      relatedEntityId: taskId,
    });
  } catch (e) {
    // Don't fail if activity log fails
    console.error("Failed to log agent activity:", e);
  }

  // If there's a secondary agent, create a notification task for them too
  if (mapping.secondary && newStatus === "in_progress") {
    try {
      await db.insert(tasks).values({
        title: `📋 إشعار: ${stageItem.title} - بدأ التنفيذ`,
        description: `تنبيه: تم بدء العمل على "${stageItem.title}" في ${sectionName}.\n` +
          `الوكيل الرئيسي: ${mapping.primary}\n` +
          `دورك: المتابعة والدعم حسب تخصصك.`,
        project: projectName,
        category: mapping.category,
        owner: mapping.secondary,
        priority: "low",
        status: "new",
        progress: 0,
        source: "agent" as const,
        sourceAgent: "سلوى",
      });
    } catch (e) {
      console.error("Failed to create secondary task:", e);
    }
  }

  return taskId;
}

// ═══════════════════════════════════════════════════════════════
// Default stages data - 5 phases (2-6), 18 sections, 97 tasks
// Based on AURA project reference
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_STAGES = {
  2: {
    title: "الإعداد القانوني والتسجيل",
    titleEn: "Legal Setup & Registration",
    sections: {
      "2.1": {
        title: "تأسيس الشركة",
        titleEn: "Company Formation",
        items: [
          "تأسيس شركة ذات مسؤولية محدودة (SPV)",
          "فتح حساب بنكي للشركة",
          "تعيين مدقق حسابات",
          "إعداد النظام الأساسي وعقد التأسيس",
          "تسجيل الشركة في دائرة التنمية الاقتصادية",
          "الحصول على الرخصة التجارية",
        ],
      },
      "2.2": {
        title: "تسجيل المشروع",
        titleEn: "Project Registration",
        items: [
          "تسجيل المشروع في دائرة الأراضي والأملاك",
          "الحصول على رقم مشروع من RERA",
          "فتح حساب ضمان المشروع (Escrow Account)",
          "تعيين أمين حساب الضمان (Escrow Agent)",
          "إعداد وتقديم خطة المشروع لـ RERA",
          "الحصول على شهادة عدم ممانعة من المطور الرئيسي",
        ],
      },
      "2.3": {
        title: "الاتفاقيات القانونية",
        titleEn: "Legal Agreements",
        items: [
          "إعداد عقد البيع والشراء (SPA)",
          "إعداد اتفاقية إدارة المشروع",
          "إعداد اتفاقية التطوير المشترك (إن وجدت)",
          "مراجعة واعتماد جميع العقود من المستشار القانوني",
          "إعداد اتفاقية الوساطة العقارية",
          "توثيق العقود لدى كاتب العدل",
        ],
      },
      "2.4": {
        title: "التأمين والامتثال",
        titleEn: "Insurance & Compliance",
        items: [
          "الحصول على تأمين المسؤولية المهنية",
          "الحصول على تأمين أعمال البناء (CAR)",
          "الحصول على تأمين مسؤولية تجاه الغير",
          "التسجيل في ضريبة القيمة المضافة (VAT)",
          "إعداد نظام مكافحة غسيل الأموال (AML)",
          "الامتثال لمتطلبات حماية البيانات",
        ],
      },
    },
  },
  3: {
    title: "التصميم والتصاريح",
    titleEn: "Design & Permits",
    sections: {
      "3.1": {
        title: "التصميم المعماري",
        titleEn: "Architectural Design",
        items: [
          "تعيين المكتب الاستشاري المعماري",
          "إعداد التصميم المبدئي (Concept Design)",
          "إعداد التصميم التفصيلي (Detailed Design)",
          "إعداد مخططات الواجهات والمقاطع",
          "إعداد مخططات المناظر الطبيعية (Landscape)",
          "اعتماد التصميم من المطور الرئيسي",
        ],
      },
      "3.2": {
        title: "التصميم الهندسي",
        titleEn: "Engineering Design",
        items: [
          "تعيين مكتب التصميم الإنشائي",
          "إعداد التصميم الإنشائي والحسابات",
          "تعيين مكتب التصميم الكهروميكانيكي (MEP)",
          "إعداد تصميم أنظمة التكييف والتهوية",
          "إعداد تصميم الأنظمة الكهربائية",
          "إعداد تصميم أنظمة السباكة والصرف",
        ],
      },
      "3.3": {
        title: "التصاريح والموافقات",
        titleEn: "Permits & Approvals",
        items: [
          "تقديم طلب رخصة البناء لبلدية دبي",
          "الحصول على موافقة الدفاع المدني",
          "الحصول على موافقة هيئة كهرباء ومياه دبي (DEWA)",
          "الحصول على موافقة هيئة الطرق والمواصلات (RTA)",
          "الحصول على موافقة الاتصالات (Etisalat/du)",
          "استلام رخصة البناء النهائية",
        ],
      },
      "3.4": {
        title: "المواصفات والمقايسات",
        titleEn: "Specifications & BOQ",
        items: [
          "إعداد المواصفات الفنية التفصيلية",
          "إعداد جداول الكميات (BOQ)",
          "إعداد وثائق المناقصة",
          "تقييم عروض المقاولين",
          "التفاوض واختيار المقاول الرئيسي",
        ],
      },
    },
  },
  4: {
    title: "التمويل والتسويق",
    titleEn: "Financing & Marketing",
    sections: {
      "4.1": {
        title: "التمويل",
        titleEn: "Financing",
        items: [
          "إعداد دراسة الجدوى المالية التفصيلية",
          "التقدم للحصول على تمويل بنكي",
          "التفاوض على شروط التمويل",
          "توقيع اتفاقية التمويل",
          "ترتيب خطابات الضمان المطلوبة",
        ],
      },
      "4.2": {
        title: "التسويق والمبيعات",
        titleEn: "Marketing & Sales",
        items: [
          "تعيين شركة التسويق والعلاقات العامة",
          "إعداد الهوية البصرية للمشروع (Branding)",
          "إنشاء الموقع الإلكتروني للمشروع",
          "إعداد المواد التسويقية (كتيبات، فيديو، 3D)",
          "إعداد نموذج الشقة (Show Apartment)",
          "إطلاق حملة التسويق والمبيعات",
        ],
      },
      "4.3": {
        title: "إدارة المبيعات",
        titleEn: "Sales Management",
        items: [
          "تعيين فريق المبيعات أو وكلاء البيع",
          "إعداد نظام إدارة علاقات العملاء (CRM)",
          "إعداد خطط السداد للمشترين",
          "بدء عمليات البيع وتسجيل الحجوزات",
        ],
      },
    },
  },
  5: {
    title: "البناء والتنفيذ",
    titleEn: "Construction",
    sections: {
      "5.1": {
        title: "التحضير للبناء",
        titleEn: "Pre-Construction",
        items: [
          "توقيع عقد المقاولة الرئيسي",
          "تعيين مكتب الإشراف الهندسي",
          "إعداد خطة إدارة المشروع التفصيلية",
          "إعداد الجدول الزمني التفصيلي للتنفيذ",
          "تجهيز الموقع وأعمال الحفر",
          "إنشاء مكتب الموقع ومرافق العمال",
        ],
      },
      "5.2": {
        title: "الأعمال الإنشائية",
        titleEn: "Structural Works",
        items: [
          "أعمال الأساسات والخوازيق",
          "أعمال الهيكل الخرساني (الأعمدة والبلاطات)",
          "أعمال البناء بالطوب والجدران",
          "أعمال العزل المائي والحراري",
          "اختبارات الجودة الدورية",
        ],
      },
      "5.3": {
        title: "أعمال التشطيبات",
        titleEn: "Finishing Works",
        items: [
          "أعمال التشطيبات الداخلية (أرضيات، جدران، أسقف)",
          "تركيب الأنظمة الكهروميكانيكية",
          "تركيب المصاعد",
          "أعمال الواجهات الخارجية",
          "أعمال المناظر الطبيعية والمسطحات الخضراء",
        ],
      },
      "5.4": {
        title: "مراقبة الجودة والتسليم",
        titleEn: "Quality Control & Handover",
        items: [
          "فحص الجودة النهائي (Snagging)",
          "اختبار الأنظمة الكهروميكانيكية",
          "الحصول على شهادة الإنجاز من البلدية",
          "الحصول على شهادة الدفاع المدني",
          "توصيل خدمات DEWA النهائية",
        ],
      },
    },
  },
  6: {
    title: "التسليم وخدمات ما بعد البيع",
    titleEn: "Handover & After-sales",
    sections: {
      "6.1": {
        title: "تسليم الوحدات",
        titleEn: "Unit Handover",
        items: [
          "إعداد جدول التسليم للمشترين",
          "فحص الوحدات مع المشترين (Inspection)",
          "معالجة الملاحظات والإصلاحات (Defects)",
          "تسليم المفاتيح وتوقيع محاضر التسليم",
          "تسجيل الوحدات في دائرة الأراضي باسم المشترين",
        ],
      },
      "6.2": {
        title: "إدارة المرافق",
        titleEn: "Facility Management",
        items: [
          "تعيين شركة إدارة المرافق",
          "تأسيس جمعية الملاك (Owners Association)",
          "إعداد ميزانية رسوم الخدمات",
          "تشغيل أنظمة المبنى والصيانة الدورية",
        ],
      },
      "6.3": {
        title: "خدمات ما بعد البيع",
        titleEn: "After-sales Services",
        items: [
          "إنشاء مكتب خدمة العملاء",
          "إدارة فترة الضمان (Defects Liability Period)",
          "معالجة شكاوى وطلبات المشترين",
          "إعداد التقرير النهائي للمشروع",
          "إغلاق حساب الضمان وتسوية الحسابات",
        ],
      },
    },
  },
} as const;

// Count total tasks
function countTotalTasks(): number {
  let count = 0;
  for (const phase of Object.values(DEFAULT_STAGES)) {
    for (const section of Object.values(phase.sections)) {
      count += section.items.length;
    }
  }
  return count;
}

export const stagesRouter = router({
  // Initialize default tasks for a project (if not already initialized)
  initializeProject: publicProcedure
    .input(z.number())
    .mutation(async ({ input: projectId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if already initialized
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(stageItems)
        .where(eq(stageItems.projectId, projectId));

      if (existing[0]?.count > 0) {
        return { initialized: false, message: "Already initialized" };
      }

      // Insert all default tasks
      const inserts: Array<{
        projectId: number;
        phaseNumber: number;
        sectionKey: string;
        itemIndex: number;
        title: string;
        status: "not_started";
        isCustom: boolean;
      }> = [];

      for (const [phaseNum, phase] of Object.entries(DEFAULT_STAGES)) {
        for (const [sectionKey, section] of Object.entries(phase.sections)) {
          section.items.forEach((title, idx) => {
            inserts.push({
              projectId,
              phaseNumber: parseInt(phaseNum),
              sectionKey,
              itemIndex: idx,
              title,
              status: "not_started" as const,
              isCustom: false,
            });
          });
        }
      }

      // Batch insert
      if (inserts.length > 0) {
        await db.insert(stageItems).values(inserts);
      }

      return { initialized: true, count: inserts.length };
    }),

  // Get all stage items for a project
  getByProject: publicProcedure
    .input(z.number())
    .query(async ({ input: projectId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const items = await db
        .select()
        .from(stageItems)
        .where(eq(stageItems.projectId, projectId))
        .orderBy(asc(stageItems.phaseNumber), asc(stageItems.sectionKey), asc(stageItems.itemIndex));

      // Also get documents for all items
      const docs = await db
        .select()
        .from(stageDocuments)
        .where(eq(stageDocuments.projectId, projectId));

      // Group documents by stageItemId
      const docsByItem: Record<number, typeof docs> = {};
      for (const doc of docs) {
        if (!docsByItem[doc.stageItemId]) docsByItem[doc.stageItemId] = [];
        docsByItem[doc.stageItemId].push(doc);
      }

      return { items, documents: docsByItem };
    }),

  // Update task status - with automatic task creation for agents
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["not_started", "in_progress", "completed"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the stage item details first
      const [item] = await db
        .select()
        .from(stageItems)
        .where(eq(stageItems.id, input.id));

      if (!item) throw new Error("Stage item not found");

      // Get project name
      const [project] = await db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, item.projectId));

      const projectName = project?.name || `مشروع #${item.projectId}`;

      // Update the status
      await db
        .update(stageItems)
        .set({ status: input.status })
        .where(eq(stageItems.id, input.id));

      // Create linked task if status changed to in_progress or completed
      let linkedTaskId: number | null = null;
      let agentName: string | null = null;

      if (input.status !== "not_started") {
        try {
          linkedTaskId = await createLinkedTask(
            db,
            { id: item.id, title: item.title, sectionKey: item.sectionKey, phaseNumber: item.phaseNumber, projectId: item.projectId },
            input.status,
            projectName
          );

          if (linkedTaskId) {
            // Update the stage item with the linked task ID
            await db
              .update(stageItems)
              .set({ linkedTaskId })
              .where(eq(stageItems.id, input.id));
          }

          agentName = SECTION_AGENT_MAP[item.sectionKey]?.primary || null;
        } catch (e) {
          console.error("Failed to create linked task:", e);
        }
      } else {
        // If reverting to not_started, clear linked task
        await db
          .update(stageItems)
          .set({ linkedTaskId: null })
          .where(eq(stageItems.id, input.id));
      }

      return {
        success: true,
        linkedTaskId,
        agentName,
        agentSecondary: SECTION_AGENT_MAP[item.sectionKey]?.secondary || null,
      };
    }),

  // Get linked tasks for a project's stage items
  getLinkedTasks: publicProcedure
    .input(z.number())
    .query(async ({ input: projectId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all stage items with linked tasks
      const itemsWithTasks = await db
        .select({
          stageItemId: stageItems.id,
          linkedTaskId: stageItems.linkedTaskId,
          sectionKey: stageItems.sectionKey,
        })
        .from(stageItems)
        .where(
          and(
            eq(stageItems.projectId, projectId),
            sql`${stageItems.linkedTaskId} IS NOT NULL`
          )
        );

      if (itemsWithTasks.length === 0) return { linkedTasks: {}, taskDetails: {} };

      // Get the actual task details
      const taskIds = itemsWithTasks.map(i => i.linkedTaskId!).filter(Boolean);
      const taskList = taskIds.length > 0
        ? await db.select().from(tasks).where(inArray(tasks.id, taskIds))
        : [];

      // Map by stageItemId
      const linkedTasks: Record<number, number> = {};
      for (const item of itemsWithTasks) {
        if (item.linkedTaskId) linkedTasks[item.stageItemId] = item.linkedTaskId;
      }

      // Map task details by task ID
      const taskDetails: Record<number, typeof taskList[0]> = {};
      for (const task of taskList) {
        taskDetails[task.id] = task;
      }

      return { linkedTasks, taskDetails };
    }),

  // Get agent mapping info (for UI display)
  getAgentMapping: publicProcedure.query(() => {
    return SECTION_AGENT_MAP;
  }),

  // Add custom task
  addCustomTask: publicProcedure
    .input(
      z.object({
        projectId: z.number(),
        phaseNumber: z.number(),
        sectionKey: z.string(),
        title: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the max itemIndex for this section
      const maxIdx = await db
        .select({ maxIdx: sql<number>`COALESCE(MAX(${stageItems.itemIndex}), -1)` })
        .from(stageItems)
        .where(
          and(
            eq(stageItems.projectId, input.projectId),
            eq(stageItems.sectionKey, input.sectionKey)
          )
        );

      const newIndex = (maxIdx[0]?.maxIdx ?? -1) + 1;

      const result = await db.insert(stageItems).values({
        projectId: input.projectId,
        phaseNumber: input.phaseNumber,
        sectionKey: input.sectionKey,
        itemIndex: newIndex,
        title: input.title,
        status: "not_started",
        isCustom: true,
      });

      return { success: true, id: Number(result[0].insertId) };
    }),

  // Delete custom task (only custom tasks can be deleted)
  deleteTask: publicProcedure
    .input(z.number())
    .mutation(async ({ input: taskId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify it's a custom task
      const task = await db
        .select()
        .from(stageItems)
        .where(eq(stageItems.id, taskId));

      if (!task[0]) throw new Error("Task not found");
      if (!task[0].isCustom) throw new Error("Cannot delete default tasks");

      // Delete associated documents first
      await db
        .delete(stageDocuments)
        .where(eq(stageDocuments.stageItemId, taskId));

      // Delete the task
      await db.delete(stageItems).where(eq(stageItems.id, taskId));

      return { success: true };
    }),

  // Upload document for a task
  uploadDocument: publicProcedure
    .input(
      z.object({
        stageItemId: z.number(),
        projectId: z.number(),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Upload to S3
      const buffer = Buffer.from(input.fileBase64, "base64");
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `stages/${input.projectId}/${input.stageItemId}/${randomSuffix}-${input.fileName}`;

      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      // Save to database
      const result = await db.insert(stageDocuments).values({
        stageItemId: input.stageItemId,
        projectId: input.projectId,
        fileName: input.fileName,
        fileUrl: url,
        fileKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });

      return {
        success: true,
        id: Number(result[0].insertId),
        url,
        fileName: input.fileName,
      };
    }),

  // Delete document
  deleteDocument: publicProcedure
    .input(z.number())
    .mutation(async ({ input: docId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(stageDocuments).where(eq(stageDocuments.id, docId));

      return { success: true };
    }),

  // Get progress statistics for a project
  getProgress: publicProcedure
    .input(z.number())
    .query(async ({ input: projectId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const items = await db
        .select({
          phaseNumber: stageItems.phaseNumber,
          sectionKey: stageItems.sectionKey,
          status: stageItems.status,
        })
        .from(stageItems)
        .where(eq(stageItems.projectId, projectId));

      // Calculate progress per section and per phase
      const sectionProgress: Record<string, { total: number; completed: number; inProgress: number }> = {};
      const phaseProgress: Record<number, { total: number; completed: number; inProgress: number }> = {};

      for (const item of items) {
        // Section level
        if (!sectionProgress[item.sectionKey]) {
          sectionProgress[item.sectionKey] = { total: 0, completed: 0, inProgress: 0 };
        }
        sectionProgress[item.sectionKey].total++;
        if (item.status === "completed") sectionProgress[item.sectionKey].completed++;
        if (item.status === "in_progress") sectionProgress[item.sectionKey].inProgress++;

        // Phase level
        if (!phaseProgress[item.phaseNumber]) {
          phaseProgress[item.phaseNumber] = { total: 0, completed: 0, inProgress: 0 };
        }
        phaseProgress[item.phaseNumber].total++;
        if (item.status === "completed") phaseProgress[item.phaseNumber].completed++;
        if (item.status === "in_progress") phaseProgress[item.phaseNumber].inProgress++;
      }

      // Overall
      const overall = {
        total: items.length,
        completed: items.filter((i) => i.status === "completed").length,
        inProgress: items.filter((i) => i.status === "in_progress").length,
        notStarted: items.filter((i) => i.status === "not_started").length,
      };

      return { sectionProgress, phaseProgress, overall };
    }),

  // Get critical path (in-progress tasks)
  getCriticalPath: publicProcedure
    .input(z.number())
    .query(async ({ input: projectId }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const inProgressItems = await db
        .select()
        .from(stageItems)
        .where(
          and(
            eq(stageItems.projectId, projectId),
            eq(stageItems.status, "in_progress")
          )
        )
        .orderBy(asc(stageItems.phaseNumber), asc(stageItems.sectionKey), asc(stageItems.itemIndex));

      return inProgressItems;
    }),
});
