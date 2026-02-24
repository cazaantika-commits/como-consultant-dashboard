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
  tasks, feasibilityStudies, agents, agentAssignments,
  meetings, meetingParticipants, meetingFiles, meetingMessages,
  knowledgeBase, contractTypes, projectContracts
} from "../drizzle/schema";
import {
  listSharedDrives, listFilesInFolder, searchFiles as searchDriveFiles,
  copyFile, createFolder, getFileMetadata, readFileContent,
  uploadTextFile, createGoogleDoc, createGoogleSheet, updateFileContent,
  renameFile, moveFile, deleteFile, uploadBinaryFile
} from "./googleDrive";
import { getOAuthClientForUser } from "./googleOAuthClient";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { fetchEmailsSince, fetchEmailByUID, fetchRecentEmails, sendReply } from "./emailMonitor";
import nodemailer from "nodemailer";

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
      name: "create_feasibility_study",
      description: "إنشاء دراسة جدوى جديدة لمشروع - تتضمن المساحات والتكاليف والإيرادات والأرباح المتوقعة",
      parameters: {
        type: "object",
        properties: {
          projectName: { type: "string", description: "اسم المشروع" },
          community: { type: "string", description: "المنطقة/المجتمع" },
          plotNumber: { type: "string", description: "رقم القطعة" },
          projectDescription: { type: "string", description: "وصف المشروع" },
          plotArea: { type: "number", description: "مساحة الأرض بالقدم المربع" },
          plotAreaM2: { type: "number", description: "مساحة الأرض بالمتر المربع" },
          gfaResidential: { type: "number", description: "GFA السكني بالقدم المربع" },
          gfaRetail: { type: "number", description: "GFA التجاري بالقدم المربع" },
          gfaOffices: { type: "number", description: "GFA المكاتب بالقدم المربع" },
          estimatedBua: { type: "number", description: "BUA التقديري بالقدم المربع" },
          numberOfUnits: { type: "number", description: "عدد الوحدات" },
          landPrice: { type: "number", description: "سعر الأرض بالدرهم" },
          constructionCostPerSqft: { type: "number", description: "تكلفة البناء لكل قدم مربع" },
          residentialSalePrice: { type: "number", description: "سعر بيع القدم السكني" },
          retailSalePrice: { type: "number", description: "سعر بيع القدم التجاري" },
          officesSalePrice: { type: "number", description: "سعر بيع القدم المكتبي" },
          notes: { type: "string", description: "ملاحظات" },
        },
        required: ["projectName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_feasibility_study",
      description: "تحديث دراسة جدوى موجودة - تعديل أي حقل من حقول الدراسة",
      parameters: {
        type: "object",
        properties: {
          studyId: { type: "number", description: "رقم دراسة الجدوى" },
          projectName: { type: "string", description: "اسم المشروع" },
          community: { type: "string", description: "المنطقة/المجتمع" },
          plotNumber: { type: "string", description: "رقم القطعة" },
          projectDescription: { type: "string", description: "وصف المشروع" },
          plotArea: { type: "number", description: "مساحة الأرض بالقدم المربع" },
          plotAreaM2: { type: "number", description: "مساحة الأرض بالمتر المربع" },
          gfaResidential: { type: "number", description: "GFA السكني" },
          gfaRetail: { type: "number", description: "GFA التجاري" },
          gfaOffices: { type: "number", description: "GFA المكاتب" },
          estimatedBua: { type: "number", description: "BUA التقديري" },
          numberOfUnits: { type: "number", description: "عدد الوحدات" },
          landPrice: { type: "number", description: "سعر الأرض" },
          constructionCostPerSqft: { type: "number", description: "تكلفة البناء لكل قدم" },
          designFeePct: { type: "number", description: "نسبة أتعاب التصميم %" },
          supervisionFeePct: { type: "number", description: "نسبة أتعاب الإشراف %" },
          developerFeePct: { type: "number", description: "نسبة أتعاب المطور %" },
          residentialSalePrice: { type: "number", description: "سعر بيع القدم السكني" },
          retailSalePrice: { type: "number", description: "سعر بيع القدم التجاري" },
          officesSalePrice: { type: "number", description: "سعر بيع القدم المكتبي" },
          comoProfitSharePct: { type: "number", description: "نسبة حصة كومو من الأرباح %" },
          notes: { type: "string", description: "ملاحظات" },
        },
        required: ["studyId"],
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
      name: "list_meetings",
      description: "عرض جميع الاجتماعات المسجلة في المنصة مع تفاصيلها (العنوان، الحالة، المشاركون، التاريخ). استخدم هذه الأداة للإجابة عن أي سؤال يتعلق بالاجتماعات السابقة أو الحالية.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "ended", "all"], description: "حالة الاجتماعات (افتراضياً: all)" },
          limit: { type: "number", description: "عدد النتائج (افتراضياً: 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_meeting_details",
      description: "عرض تفاصيل اجتماع محدد بما في ذلك المشاركون، الملفات المرفقة، الرسائل، المخرجات (محضر، قرارات، مهام)، والمعرفة المستخرجة. استخدم هذه الأداة عند السؤال عن اجتماع معين أو ما تم مناقشته فيه.",
      parameters: {
        type: "object",
        properties: {
          meetingId: { type: "number", description: "رقم الاجتماع" },
        },
        required: ["meetingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_meeting_tasks_status",
      description: "عرض حالة تنفيذ المهام المستخرجة من اجتماع معين - هل تم تنفيذها أم لا، ومن المسؤول عن كل مهمة ونتيجة التنفيذ.",
      parameters: {
        type: "object",
        properties: {
          meetingId: { type: "number", description: "رقم الاجتماع" },
        },
        required: ["meetingId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_all_data",
      description: "بحث شامل في جميع بيانات المنصة - المشاريع، الاستشاريين، المهام، الاجتماعات، قاعدة المعرفة، القرارات، الأتعاب. استخدم هذه الأداة عندما لا تعرف أين تبحث أو تحتاج نظرة شاملة.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "كلمات البحث" },
        },
        required: ["query"],
      },
    },
  },
  // ─── GOOGLE DRIVE TOOLS ───
  {
    type: "function" as const,
    function: {
      name: "list_drive_folders",
      description: "عرض المجلدات الرئيسية المشتركة في Google Drive - استخدم هذه الأداة أولاً لمعرفة المجلدات المتاحة قبل استعراض محتوياتها",
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
      name: "list_drive_files",
      description: "عرض الملفات والمجلدات داخل مجلد معين في Google Drive - أدخل معرف المجلد (folderId) لاستعراض محتوياته",
      parameters: {
        type: "object",
        properties: {
          folderId: { type: "string", description: "معرف المجلد في Google Drive" },
        },
        required: ["folderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_drive_files",
      description: "بحث عن ملفات في Google Drive بالاسم - يبحث في جميع المجلدات المشتركة أو في مجلد محدد",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "نص البحث (اسم الملف أو جزء منه)" },
          folderId: { type: "string", description: "معرف المجلد للبحث فيه فقط (اختياري - إذا لم يُحدد يبحث في الكل)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_drive_file_info",
      description: "الحصول على معلومات تفصيلية عن ملف أو مجلد في Google Drive (الاسم، النوع، الحجم، تاريخ التعديل، رابط المشاهدة)",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف في Google Drive" },
        },
        required: ["fileId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "copy_drive_file",
      description: "نسخ ملف من مكان لآخر في Google Drive - مفيد لتنظيم الملفات ونقلها بين المجلدات",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف المراد نسخه" },
          destinationFolderId: { type: "string", description: "معرف المجلد الهدف" },
          newName: { type: "string", description: "اسم جديد للملف (اختياري)" },
        },
        required: ["fileId", "destinationFolderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_drive_folder",
      description: "إنشاء مجلد جديد داخل مجلد موجود في Google Drive - مفيد لتنظيم الملفات في هيكل مجلدات منظم",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "اسم المجلد الجديد" },
          parentFolderId: { type: "string", description: "معرف المجلد الأب" },
        },
        required: ["name", "parentFolderId"],
      },
    },
  },
  // ─── BATCH COPY ───
  {
    type: "function" as const,
    function: {
      name: "batch_copy_drive_file",
      description: "نسخ ملف واحد إلى عدة مجلدات (مشاريع) بأسماء مختلفة دفعة واحدة - مثالي لما يكون عرض استشاري واحد يخص عدة مشاريع. استخدم هذه الأداة بدل من نسخ كل ملف على حدة.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف الأصلي المراد نسخه" },
          destinations: {
            type: "array",
            description: "قائمة الوجهات - كل وجهة فيها معرف المجلد والاسم الجديد",
            items: {
              type: "object",
              properties: {
                folderId: { type: "string", description: "معرف مجلد المشروع الهدف" },
                fileName: { type: "string", description: "اسم الملف الجديد حسب دستور الأرشفة" },
              },
              required: ["folderId", "fileName"],
            },
          },
        },
        required: ["fileId", "destinations"],
      },
    },
  },
  // ─── FILE CONTENT READING ───
  {
    type: "function" as const,
    function: {
      name: "read_drive_file_content",
      description: "قراءة محتوى ملف من Google Drive - يدعم Google Docs (نص)، Google Sheets (CSV)، PDF حتى 50 MB (استخراج نص ذكي)، وملفات نصية (txt, csv, json, xml, html, md). استخدم هذه الأداة عندما تحتاج فعلياً لقراءة ما بداخل ملف وليس فقط معرفة اسمه. يقدر يقرأ ملفات كبيرة مثل عروض الاستشاريين والعقود. مثال: قراءة عرض سعر PDF، أو جدول بيانات Sheet، أو مستند Doc.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف في Google Drive (يمكن الحصول عليه من list_drive_files أو search_drive_files)" },
        },
        required: ["fileId"],
      },
    },
  },
  // ─── FILE CREATION & UPLOAD ───
  {
    type: "function" as const,
    function: {
      name: "create_drive_document",
      description: "إنشاء مستند Google Doc جديد في Google Drive - استخدم هذه الأداة لإنشاء تقارير، ملخصات، محاضر اجتماعات، أو أي مستند نصي. المحتوى يمكن أن يكون نص عادي أو HTML لتنسيق أفضل.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان المستند" },
          content: { type: "string", description: "محتوى المستند (نص عادي أو HTML)" },
          parentFolderId: { type: "string", description: "معرف المجلد الذي سيُحفظ فيه المستند" },
          contentType: { type: "string", enum: ["text", "html"], description: "نوع المحتوى - text لنص عادي، html لتنسيق غني" },
        },
        required: ["title", "content", "parentFolderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_drive_spreadsheet",
      description: "إنشاء جدول بيانات Google Sheet جديد - استخدم هذه الأداة لإنشاء جداول مقارنة، تقارير مالية، أو أي بيانات مهيكلة. أرسل البيانات بصيغة CSV.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "عنوان جدول البيانات" },
          csvContent: { type: "string", description: "البيانات بصيغة CSV - السطر الأول عناوين الأعمدة" },
          parentFolderId: { type: "string", description: "معرف المجلد الذي سيُحفظ فيه الجدول" },
        },
        required: ["title", "csvContent", "parentFolderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "upload_text_file",
      description: "رفع ملف نصي عادي إلى Google Drive - لرفع ملفات txt, csv, json, xml, html, md وغيرها. استخدم create_drive_document لإنشاء Google Docs بدلاً.",
      parameters: {
        type: "object",
        properties: {
          fileName: { type: "string", description: "اسم الملف مع الامتداد (مثل: report.txt, data.csv, config.json)" },
          content: { type: "string", description: "محتوى الملف" },
          parentFolderId: { type: "string", description: "معرف المجلد الذي سيُحفظ فيه الملف" },
          mimeType: { type: "string", description: "نوع الملف (text/plain, text/csv, application/json, text/html, text/markdown). افتراضي: text/plain" },
        },
        required: ["fileName", "content", "parentFolderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_drive_file",
      description: "تحديث محتوى ملف موجود في Google Drive - استبدل محتوى ملف نصي موجود بمحتوى جديد.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف المراد تحديثه" },
          content: { type: "string", description: "المحتوى الجديد" },
          mimeType: { type: "string", description: "نوع المحتوى (text/plain, text/csv, text/html). افتراضي: text/plain" },
        },
        required: ["fileId", "content"],
      },
    },
  },
  // ─── FILE MANAGEMENT (rename, move, delete) ───
  {
    type: "function" as const,
    function: {
      name: "rename_drive_file",
      description: "تغيير اسم ملف أو مجلد في Google Drive",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف أو المجلد المراد تغيير اسمه" },
          newName: { type: "string", description: "الاسم الجديد" },
        },
        required: ["fileId", "newName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "move_drive_file",
      description: "نقل ملف أو مجلد إلى مجلد آخر في Google Drive",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف أو المجلد المراد نقله" },
          newParentFolderId: { type: "string", description: "معرف المجلد الجديد (الوجهة)" },
        },
        required: ["fileId", "newParentFolderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_drive_file",
      description: "حذف ملف أو مجلد من Google Drive - ⚠️ هذه العملية تتطلب موافقة المالك. سيتم إرسال طلب موافقة عبر تيليجرام وانتظار الرد قبل التنفيذ.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "معرف الملف أو المجلد المراد حذفه" },
          reason: { type: "string", description: "سبب الحذف - سيُعرض على المالك في طلب الموافقة" },
        },
        required: ["fileId", "reason"],
      },
    },
  },
  // ─── FACT SHEET UPDATE ───
  {
    type: "function" as const,
    function: {
      name: "update_project_fact_sheet",
      description: "تحديث بيانات Fact Sheet لمشروع - استخدم هذه الأداة بعد قراءة مستندات الأرض (Affection Plan, Title Deed, Plots Guidelines, Site Plan, SPA) لتعبئة بيانات المشروع تلقائياً. أرسل فقط الحقول التي استخرجتها من المستند.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "معرف المشروع" },
          // البيانات الأساسية
          plotNumber: { type: "string", description: "رقم القطعة" },
          areaCode: { type: "string", description: "كود المنطقة" },
          bua: { type: "number", description: "مساحة البناء (قدم²)" },
          // أرقام التعريف
          titleDeedNumber: { type: "string", description: "رقم سند الملكية" },
          ddaNumber: { type: "string", description: "رقم DDA" },
          masterDevRef: { type: "string", description: "الرقم المرجعي للمطور الرئيسي" },
          // المساحات
          plotAreaSqm: { type: "string", description: "مساحة الأرض (م²)" },
          plotAreaSqft: { type: "string", description: "مساحة الأرض (قدم²)" },
          gfaSqm: { type: "string", description: "المساحة الإجمالية GFA (م²)" },
          gfaSqft: { type: "string", description: "المساحة الإجمالية GFA (قدم²)" },
          // الاستخدام والملكية
          permittedUse: { type: "string", description: "الاستخدام المسموح" },
          ownershipType: { type: "string", description: "نوع الملكية" },
          subdivisionRestrictions: { type: "string", description: "قيود التجزئة" },
          // الأطراف
          masterDevName: { type: "string", description: "اسم المطور الرئيسي" },
          masterDevAddress: { type: "string", description: "عنوان المطور" },
          sellerName: { type: "string", description: "اسم البائع" },
          buyerName: { type: "string", description: "اسم المشتري" },
          buyerNationality: { type: "string", description: "جنسية المشتري" },
          buyerPassport: { type: "string", description: "رقم جواز المشتري" },
          buyerPhone: { type: "string", description: "هاتف المشتري" },
          buyerEmail: { type: "string", description: "بريد المشتري" },
          // البنية التحتية
          electricityAllocation: { type: "string", description: "تخصيص الكهرباء" },
          waterAllocation: { type: "string", description: "تخصيص المياه" },
          sewageAllocation: { type: "string", description: "تخصيص الصرف الصحي" },
          tripAM: { type: "string", description: "رحلات صباحية" },
          tripLT: { type: "string", description: "رحلات نهارية" },
          tripPM: { type: "string", description: "رحلات مسائية" },
          // الجدول الزمني
          effectiveDate: { type: "string", description: "تاريخ السريان" },
          constructionPeriod: { type: "string", description: "فترة البناء" },
          constructionStartDate: { type: "string", description: "تاريخ بدء الإنشاء" },
          completionDate: { type: "string", description: "تاريخ الإنجاز" },
          constructionConditions: { type: "string", description: "شروط بدء الإنشاء" },
          // الالتزامات
          saleRestrictions: { type: "string", description: "قيود البيع" },
          resaleConditions: { type: "string", description: "شروط إعادة البيع" },
          communityCharges: { type: "string", description: "رسوم المجتمع" },
          // التسجيل
          registrationAuthority: { type: "string", description: "جهة التسجيل" },
          adminFee: { type: "number", description: "رسوم إدارية" },
          clearanceFee: { type: "number", description: "رسوم شهادة التخليص" },
          compensationAmount: { type: "number", description: "مبلغ تعويض" },
          // القانون
          governingLaw: { type: "string", description: "القانون الساري" },
          disputeResolution: { type: "string", description: "تسوية النزاعات" },
        },
        required: ["projectId"],
      },
    },
  },
  // ─── CONTRACT REGISTRY ───
  {
    type: "function" as const,
    function: {
      name: "list_contract_types",
      description: "عرض أنواع العقود المتاحة في سجل العقود - يعرض قائمة بجميع أنواع العقود (31 نوع افتراضي + أي أنواع مخصصة) مع التصنيف والكود.",
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
      name: "list_project_contracts",
      description: "عرض عقود مشروع معين - يعرض جميع العقود المرتبطة بمشروع محدد مع حالة التحليل والتفاصيل.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "number", description: "معرف المشروع" },
        },
        required: ["projectId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_contract_details",
      description: "عرض تفاصيل عقد محدد - يعرض كل بيانات العقد بما في ذلك تحليل فاروق إن وجد (الملخص، المواعيد، الغرامات، الالتزامات، المخاطر).",
      parameters: {
        type: "object",
        properties: {
          contractId: { type: "number", description: "معرف العقد" },
        },
        required: ["contractId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_contract_analysis",
      description: "حفظ تحليل عقد في قاعدة البيانات - استخدم هذه الأداة بعد تحليل عقد لحفظ النتائج (الملخص، المواعيد، الغرامات، الالتزامات، المخاطر، شروط الإنهاء، الملاحظات).",
      parameters: {
        type: "object",
        properties: {
          contractId: { type: "number", description: "معرف العقد" },
          summary: { type: "string", description: "ملخص شامل للعقد" },
          keyDates: { type: "string", description: "JSON array للمواعيد المهمة [{date, description, importance}]" },
          penalties: { type: "string", description: "JSON array للغرامات [{type, amount, condition, severity}]" },
          obligations: { type: "string", description: "JSON array للالتزامات [{party, obligation, deadline}]" },
          risks: { type: "string", description: "JSON array للمخاطر [{risk, severity, recommendation}]" },
          parties: { type: "string", description: "JSON array للأطراف [{name, role, responsibilities}]" },
          terminationClauses: { type: "string", description: "شروط الإنهاء والفسخ" },
          notes: { type: "string", description: "ملاحظات وتوصيات فاروق" },
        },
        required: ["contractId", "summary"],
      },
    },
  },
  // ─── EMAIL TOOLS (Salwa) ───
  {
    type: "function" as const,
    function: {
      name: "check_email",
      description: "فحص الإيميل وعرض قائمة بالرسائل الأخيرة مع أرقام UID. استخدميها لفحص البريد أو لإيجاد UID رسالة شخص معين قبل استخدام read_email. ترجع قائمة بالإيميلات مع المرسل والموضوع والتاريخ وحالة القراءة وعدد المرفقات وأسمائها.",
      parameters: {
        type: "object",
        properties: {
          hours: { type: "number", description: "عدد الساعات للبحث فيها (افتراضياً 48 ساعة)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_email",
      description: "قراءة المحتوى الكامل لإيميل محدد بما فيه النص والمرفقات. يجب استخدامها دائماً بعد check_email عندما يطلب المستخدم محتوى أو تفاصيل رسالة معينة. ترجع: المرسل، الموضوع، النص الكامل، وقائمة المرفقات (اسم الملف ونوعه وحجمه). تحتاجين UID (من check_email).",
      parameters: {
        type: "object",
        properties: {
          uid: { type: "number", description: "رقم UID الخاص بالرسالة" },
        },
        required: ["uid"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reply_email",
      description: "إرسال رد على إيميل محدد - استخدمي هذه الأداة للرد على رسالة بريد إلكتروني. تحتاجين عنوان المرسل الأصلي والموضوع ونص الرد.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "عنوان البريد الإلكتروني للمستلم" },
          subject: { type: "string", description: "موضوع الرسالة (سيُضاف Re: تلقائياً)" },
          body: { type: "string", description: "نص الرد (يدعم HTML)" },
          inReplyTo: { type: "string", description: "معرف الرسالة الأصلية (Message-ID) للربط بالمحادثة" },
          cc: { type: "string", description: "عناوين النسخة (CC) مفصولة بفاصلة" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compose_email",
      description: "كتابة وإرسال إيميل جديد - استخدمي هذه الأداة لإرسال رسالة بريد إلكتروني جديدة (ليست رداً على رسالة سابقة).",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "عنوان البريد الإلكتروني للمستلم" },
          subject: { type: "string", description: "موضوع الرسالة" },
          body: { type: "string", description: "نص الرسالة (يدعم HTML)" },
          cc: { type: "string", description: "عناوين النسخة (CC) مفصولة بفاصلة" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "download_email_attachments",
      description: "تنزيل مرفقات إيميل محدد وحفظها في Google Drive - استخدمي هذه الأداة لتنزيل مرفقات رسالة بريد إلكتروني ورفعها على Google Drive في مجلد 00_Inbox/Emails/. تحتاجين رقم UID الخاص بالرسالة (من check_email). يمكنك تحديد مجلد مخصص أو تركه للمجلد الافتراضي.",
      parameters: {
        type: "object",
        properties: {
          uid: { type: "number", description: "رقم UID الخاص بالرسالة التي تحتوي على المرفقات" },
          targetFolderId: { type: "string", description: "معرف مجلد Google Drive المستهدف (اختياري - افتراضياً 00_Inbox/Emails/)" },
          renamePattern: { type: "string", description: "نمط إعادة تسمية الملفات حسب دستور الأرشفة (اختياري - مثال: Nas-R_6185392_Pro-Eng_20260209_Lac_V1)" },
        },
        required: ["uid"],
      },
    },
  },
  // ─── INTER-AGENT ───
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
  // ─── SALWA: VIEW OTHER AGENTS' CONVERSATIONS ───
  {
    type: "function" as const,
    function: {
      name: "view_agent_conversations",
      description: "عرض محادثات المستخدم مع وكيل آخر - استخدمي هذه الأداة للاطلاع على ما دار بين المستخدم وأي وكيل آخر (فاروق، خازن، براق، خالد، ألينا، باز، جويل). يمكنك رؤية آخر الرسائل ومعرفة ما طلبه المستخدم وما رد عليه الوكيل.",
      parameters: {
        type: "object",
        properties: {
          targetAgent: {
            type: "string",
            enum: ["farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle", "all"],
            description: "الوكيل المطلوب عرض محادثاته - استخدم 'all' لعرض آخر رسائل جميع الوكلاء"
          },
          limit: {
            type: "number",
            description: "عدد الرسائل المطلوب عرضها (افتراضياً: 20)"
          },
        },
        required: ["targetAgent"],
      },
    },
  },
];
// ═══════════════════════════════════════════════════
// Evaluation Criteria (shared with frontend))
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
  "add_consultant_note", "copy_drive_file", "create_drive_folder",
  "create_drive_document", "create_drive_spreadsheet", "upload_text_file", "update_drive_file",
  "rename_drive_file", "move_drive_file", "delete_drive_file",
  "reply_email", "compose_email",
  "download_email_attachments"
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

      // ─── FEASIBILITY STUDY WRITE TOOLS ───
      case "create_feasibility_study": {
        const { projectName: fsName, ...fsData } = args;
        if (!fsName) return JSON.stringify({ error: "يجب تحديد اسم المشروع" });
        const insertData: Record<string, any> = { projectName: fsName, userId: userId || 1 };
        const fsAllowedFields = [
          'community', 'plotNumber', 'projectDescription', 'landUse',
          'plotArea', 'plotAreaM2', 'gfaResidential', 'gfaRetail', 'gfaOffices', 'totalGfa',
          'saleableResidentialPct', 'saleableRetailPct', 'saleableOfficesPct',
          'estimatedBua', 'numberOfUnits', 'landPrice', 'agentCommissionLandPct',
          'soilInvestigation', 'topographySurvey', 'authoritiesFee',
          'constructionCostPerSqft', 'communityFee', 'designFeePct', 'supervisionFeePct',
          'separationFeePerM2', 'contingenciesPct', 'developerFeePct',
          'agentCommissionSalePct', 'marketingPct', 'reraOffplanFee', 'reraUnitFee',
          'nocFee', 'escrowFee', 'bankCharges', 'surveyorFees', 'reraAuditFees', 'reraInspectionFees',
          'residentialSalePrice', 'retailSalePrice', 'officesSalePrice',
          'comoProfitSharePct', 'notes'
        ];
        for (const key of fsAllowedFields) {
          if (fsData[key] !== undefined && fsData[key] !== null) {
            insertData[key] = fsData[key];
          }
        }
        const fsResult = await db.insert(feasibilityStudies).values(insertData);
        return JSON.stringify({ success: true, studyId: Number(fsResult[0].insertId), message: `تم إنشاء دراسة الجدوى لمشروع ${fsName}` });
      }

      case "update_feasibility_study": {
        const { studyId: fsUpdateId, ...fsUpdateData } = args;
        if (!fsUpdateId) return JSON.stringify({ error: "يجب تحديد رقم دراسة الجدوى" });
        const updateFields: Record<string, any> = {};
        const fsUpdateAllowed = [
          'projectName', 'community', 'plotNumber', 'projectDescription', 'landUse',
          'plotArea', 'plotAreaM2', 'gfaResidential', 'gfaRetail', 'gfaOffices', 'totalGfa',
          'saleableResidentialPct', 'saleableRetailPct', 'saleableOfficesPct',
          'estimatedBua', 'numberOfUnits', 'landPrice', 'agentCommissionLandPct',
          'soilInvestigation', 'topographySurvey', 'authoritiesFee',
          'constructionCostPerSqft', 'communityFee', 'designFeePct', 'supervisionFeePct',
          'separationFeePerM2', 'contingenciesPct', 'developerFeePct',
          'agentCommissionSalePct', 'marketingPct', 'reraOffplanFee', 'reraUnitFee',
          'nocFee', 'escrowFee', 'bankCharges', 'surveyorFees', 'reraAuditFees', 'reraInspectionFees',
          'residentialSalePrice', 'retailSalePrice', 'officesSalePrice',
          'comoProfitSharePct', 'notes'
        ];
        for (const key of fsUpdateAllowed) {
          if (fsUpdateData[key] !== undefined) {
            updateFields[key] = fsUpdateData[key];
          }
        }
        if (Object.keys(updateFields).length === 0) return JSON.stringify({ error: "لم يتم تحديد حقول للتحديث" });
        await db.update(feasibilityStudies).set(updateFields).where(eq(feasibilityStudies.id, fsUpdateId));
        return JSON.stringify({ success: true, message: `تم تحديث ${Object.keys(updateFields).length} حقل في دراسة الجدوى`, updatedFields: Object.keys(updateFields) });
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

      case "list_meetings": {
        const db = await getDb();
        if (!db) return JSON.stringify({ error: "قاعدة البيانات غير متاحة" });
        const statusFilter = args.status || "all";
        const limitNum = args.limit || 20;
        let meetingsList;
        if (statusFilter === "all") {
          meetingsList = await db.select().from(meetings).orderBy(desc(meetings.createdAt)).limit(limitNum);
        } else {
          meetingsList = await db.select().from(meetings).where(eq(meetings.status, statusFilter)).orderBy(desc(meetings.createdAt)).limit(limitNum);
        }
        // Get participants for each meeting
        const results = [];
        for (const m of meetingsList) {
          const participants = await db.select().from(meetingParticipants).where(eq(meetingParticipants.meetingId, m.id));
          results.push({
            id: m.id,
            title: m.title,
            agenda: m.agenda,
            status: m.status,
            participants: participants.map(p => p.agentId).join(", "),
            createdAt: m.createdAt,
            endedAt: m.endedAt,
          });
        }
        return JSON.stringify({ success: true, count: results.length, meetings: results });
      }

      case "get_meeting_details": {
        const db = await getDb();
        if (!db) return JSON.stringify({ error: "قاعدة البيانات غير متاحة" });
        const { meetingId } = args;
        const [meeting] = await db.select().from(meetings).where(eq(meetings.id, meetingId));
        if (!meeting) return JSON.stringify({ error: "الاجتماع غير موجود" });
        const participants = await db.select().from(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId));
        const files = await db.select().from(meetingFiles).where(eq(meetingFiles.meetingId, meetingId));
        const msgs = await db.select().from(meetingMessages).where(eq(meetingMessages.meetingId, meetingId)).orderBy(meetingMessages.createdAt).limit(100);
        // Get related tasks
        const relatedTasks = await db.select().from(tasks).where(eq(tasks.source, `meeting-${meetingId}`));
        return JSON.stringify({
          success: true,
          meeting: {
            id: meeting.id,
            title: meeting.title,
            agenda: meeting.agenda,
            status: meeting.status,
            minutes: meeting.minutes,
            decisions: meeting.decisions,
            createdAt: meeting.createdAt,
            endedAt: meeting.endedAt,
          },
          participants: participants.map(p => ({ agent: p.agentId, role: p.role })),
          files: files.map(f => ({ name: f.fileName, type: f.fileType, analysis: f.aiAnalysis })),
          messages: msgs.map(m => ({ sender: m.senderType === "user" ? "المدير" : m.senderAgent || "unknown", content: m.content, time: m.createdAt })),
          tasks: relatedTasks.map(t => ({ id: t.id, title: t.title, status: t.status, assignedTo: t.assignedTo })),
          totalMessages: msgs.length,
        });
      }

      case "get_meeting_tasks_status": {
        const db = await getDb();
        if (!db) return JSON.stringify({ error: "قاعدة البيانات غير متاحة" });
        const relatedTasks = await db.select().from(tasks).where(eq(tasks.source, `meeting-${args.meetingId}`));
        if (relatedTasks.length === 0) {
          return JSON.stringify({ success: true, message: "لا توجد مهام مرتبطة بهذا الاجتماع", tasks: [] });
        }
        const completed = relatedTasks.filter(t => t.status === "completed").length;
        const pending = relatedTasks.filter(t => t.status === "pending").length;
        const inProgress = relatedTasks.filter(t => t.status === "in_progress").length;
        return JSON.stringify({
          success: true,
          summary: { total: relatedTasks.length, completed, pending, inProgress, completionRate: Math.round((completed / relatedTasks.length) * 100) + "%" },
          tasks: relatedTasks.map(t => ({ id: t.id, title: t.title, status: t.status, assignedTo: t.assignedTo, description: t.description })),
        });
      }

      case "search_all_data": {
        const db = await getDb();
        if (!db) return JSON.stringify({ error: "قاعدة البيانات غير متاحة" });
        const q = args.query;
        const searchResults: any = { query: q };
        // Search projects
        const matchedProjects = await db.select().from(projects).where(sql`${projects.name} LIKE ${`%${q}%`} OR ${projects.description} LIKE ${`%${q}%`}`).limit(5);
        if (matchedProjects.length > 0) searchResults.projects = matchedProjects.map(p => ({ id: p.id, name: p.name, description: p.description }));
        // Search consultants
        const matchedConsultants = await db.select().from(consultants).where(sql`${consultants.name} LIKE ${`%${q}%`} OR ${consultants.email} LIKE ${`%${q}%`}`).limit(5);
        if (matchedConsultants.length > 0) searchResults.consultants = matchedConsultants.map(c => ({ id: c.id, name: c.name, email: c.email }));
        // Search tasks
        const matchedTasks = await db.select().from(tasks).where(sql`${tasks.title} LIKE ${`%${q}%`} OR ${tasks.description} LIKE ${`%${q}%`}`).limit(5);
        if (matchedTasks.length > 0) searchResults.tasks = matchedTasks.map(t => ({ id: t.id, title: t.title, status: t.status, assignedTo: t.assignedTo }));
        // Search meetings
        const matchedMeetings = await db.select().from(meetings).where(sql`${meetings.title} LIKE ${`%${q}%`} OR ${meetings.agenda} LIKE ${`%${q}%`} OR ${meetings.minutes} LIKE ${`%${q}%`}`).limit(5);
        if (matchedMeetings.length > 0) searchResults.meetings = matchedMeetings.map(m => ({ id: m.id, title: m.title, status: m.status }));
        // Search knowledge base
        const matchedKnowledge = await db.select().from(knowledgeBase).where(sql`${knowledgeBase.title} LIKE ${`%${q}%`} OR ${knowledgeBase.content} LIKE ${`%${q}%`}`).limit(5);
        if (matchedKnowledge.length > 0) searchResults.knowledge = matchedKnowledge.map(k => ({ id: k.id, title: k.title, type: k.type, summary: k.summary }));
        // Search financial data
        const matchedFees = await db.select().from(financialData).limit(10);
        if (matchedFees.length > 0) searchResults.financialRecords = matchedFees.length + " سجل مالي متاح";
        const totalResults = (searchResults.projects?.length || 0) + (searchResults.consultants?.length || 0) + (searchResults.tasks?.length || 0) + (searchResults.meetings?.length || 0) + (searchResults.knowledge?.length || 0);
        searchResults.totalResults = totalResults;
        return JSON.stringify({ success: true, ...searchResults });
      }

      // ─── GOOGLE DRIVE ───
      case "list_drive_folders": {
        const folders = await listSharedDrives();
        if (folders.length === 0) return JSON.stringify({ message: "لا توجد مجلدات مشتركة", data: [] });
        return JSON.stringify({
          message: `${folders.length} مجلد مشترك في Google Drive`,
          data: folders.map(f => ({ id: f.id, name: f.name, type: f.mimeType === 'application/vnd.google-apps.folder' ? 'مجلد' : 'ملف' }))
        });
      }

      case "list_drive_files": {
        const { folderId } = args;
        if (!folderId) return JSON.stringify({ error: "يجب تحديد معرف المجلد (folderId)" });
        const result = await listFilesInFolder(folderId);
        if (result.files.length === 0) return JSON.stringify({ message: "المجلد فارغ", data: [] });
        return JSON.stringify({
          message: `${result.files.length} ملف/مجلد`,
          data: result.files.map(f => ({
            id: f.id, name: f.name,
            type: f.mimeType === 'application/vnd.google-apps.folder' ? 'مجلد' : f.mimeType,
            size: f.size ? `${Math.round(parseInt(f.size) / 1024)} KB` : undefined,
            modified: f.modifiedTime,
            link: f.webViewLink,
          })),
          hasMore: !!result.nextPageToken,
        });
      }

      case "search_drive_files": {
        const { query, folderId } = args;
        if (!query) return JSON.stringify({ error: "يجب تحديد نص البحث (query)" });
        const files = await searchDriveFiles(query, folderId);
        if (files.length === 0) return JSON.stringify({ message: `لم يتم العثور على ملفات تطابق "${query}"`, data: [] });
        return JSON.stringify({
          message: `${files.length} نتيجة للبحث عن "${query}"`,
          data: files.map(f => ({
            id: f.id, name: f.name,
            type: f.mimeType === 'application/vnd.google-apps.folder' ? 'مجلد' : f.mimeType,
            size: f.size ? `${Math.round(parseInt(f.size) / 1024)} KB` : undefined,
            modified: f.modifiedTime,
            link: f.webViewLink,
          }))
        });
      }

      case "get_drive_file_info": {
        const { fileId } = args;
        if (!fileId) return JSON.stringify({ error: "يجب تحديد معرف الملف (fileId)" });
        const file = await getFileMetadata(fileId);
        return JSON.stringify({
          message: `معلومات الملف: ${file.name}`,
          data: {
            id: file.id, name: file.name,
            type: file.mimeType === 'application/vnd.google-apps.folder' ? 'مجلد' : file.mimeType,
            size: file.size ? `${Math.round(parseInt(file.size) / 1024)} KB` : undefined,
            created: file.createdTime,
            modified: file.modifiedTime,
            link: file.webViewLink,
          }
        });
      }

      case "copy_drive_file": {
        const { fileId, destinationFolderId, newName } = args;
        if (!fileId || !destinationFolderId) return JSON.stringify({ error: "يجب تحديد معرف الملف ومعرف المجلد الهدف" });
        
        // Try to use OAuth client for user delegation
        const oauthClient = await getOAuthClientForUser(userId);
        const copied = await copyFile(fileId, destinationFolderId, newName, oauthClient || undefined);
        
        return JSON.stringify({
          message: `تم نسخ الملف بنجاح: ${copied.name}`,
          data: { id: copied.id, name: copied.name, link: copied.webViewLink }
        });
      }

      case "batch_copy_drive_file": {
        const { fileId: batchFileId, destinations } = args;
        if (!batchFileId || !destinations || !Array.isArray(destinations) || destinations.length === 0) {
          return JSON.stringify({ error: "يجب تحديد معرف الملف وقائمة الوجهات (destinations)" });
        }
        const results: any[] = [];
        const errors: any[] = [];
        // Try to use OAuth client for user delegation
        const oauthClient = await getOAuthClientForUser(userId);
        
        for (const dest of destinations) {
          try {
            const copied = await copyFile(batchFileId, dest.folderId, dest.fileName, oauthClient || undefined);
            results.push({ fileName: copied.name, folderId: dest.folderId, id: copied.id, link: copied.webViewLink });
          } catch (e: any) {
            errors.push({ fileName: dest.fileName, folderId: dest.folderId, error: e.message });
          }
        }
        return JSON.stringify({
          message: `تم نسخ الملف إلى ${results.length} مجلد بنجاح${errors.length > 0 ? ` (${errors.length} أخطاء)` : ''}`,
          copied: results,
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      case "create_drive_folder": {
        const { name, parentFolderId } = args;
        if (!name || !parentFolderId) return JSON.stringify({ error: "يجب تحديد اسم المجلد ومعرف المجلد الأب" });
        const folder = await createFolder(name, parentFolderId);
        return JSON.stringify({
          message: `تم إنشاء المجلد بنجاح: ${folder.name}`,
          data: { id: folder.id, name: folder.name }
        });
      }

      // ─── FILE CONTENT READING ───
      case "read_drive_file_content": {
        const { fileId: readFileId } = args;
        if (!readFileId) return JSON.stringify({ error: "يجب تحديد معرف الملف (fileId)" });
        try {
          const result = await readFileContent(readFileId);
          if (result.error) {
            return JSON.stringify({
              success: false,
              fileName: result.fileName,
              mimeType: result.mimeType,
              error: result.error,
            });
          }
          return JSON.stringify({
            success: true,
            fileName: result.fileName,
            mimeType: result.mimeType,
            contentType: result.contentType,
            truncated: result.truncated,
            totalChars: result.totalChars,
            content: result.content,
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل قراءة الملف: ${e.message}` });
        }
      }

      // ─── FILE CREATION & UPLOAD ───
      case "create_drive_document": {
        const { title: docTitle, content: docContent, parentFolderId: docParent, contentType: docType } = args;
        if (!docTitle || !docContent || !docParent) return JSON.stringify({ error: "يجب تحديد العنوان والمحتوى ومعرف المجلد" });
        try {
          const doc = await createGoogleDoc(docTitle, docContent, docParent, docType || "text");
          return JSON.stringify({
            success: true,
            message: `تم إنشاء المستند بنجاح: ${doc.name}`,
            data: { id: doc.id, name: doc.name, webViewLink: doc.webViewLink }
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل إنشاء المستند: ${e.message}` });
        }
      }

      case "create_drive_spreadsheet": {
        const { title: sheetTitle, csvContent: sheetCsv, parentFolderId: sheetParent } = args;
        if (!sheetTitle || !sheetCsv || !sheetParent) return JSON.stringify({ error: "يجب تحديد العنوان والبيانات ومعرف المجلد" });
        try {
          const sheet = await createGoogleSheet(sheetTitle, sheetCsv, sheetParent);
          return JSON.stringify({
            success: true,
            message: `تم إنشاء جدول البيانات بنجاح: ${sheet.name}`,
            data: { id: sheet.id, name: sheet.name, webViewLink: sheet.webViewLink }
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل إنشاء جدول البيانات: ${e.message}` });
        }
      }

      case "upload_text_file": {
        const { fileName: uploadName, content: uploadContent, parentFolderId: uploadParent, mimeType: uploadMime } = args;
        if (!uploadName || !uploadContent || !uploadParent) return JSON.stringify({ error: "يجب تحديد اسم الملف والمحتوى ومعرف المجلد" });
        try {
          const file = await uploadTextFile(uploadName, uploadContent, uploadParent, uploadMime || "text/plain");
          return JSON.stringify({
            success: true,
            message: `تم رفع الملف بنجاح: ${file.name}`,
            data: { id: file.id, name: file.name, webViewLink: file.webViewLink }
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل رفع الملف: ${e.message}` });
        }
      }

      case "update_drive_file": {
        const { fileId: updateFileId, content: updateContent, mimeType: updateMime } = args;
        if (!updateFileId || !updateContent) return JSON.stringify({ error: "يجب تحديد معرف الملف والمحتوى الجديد" });
        try {
          const file = await updateFileContent(updateFileId, updateContent, updateMime || "text/plain");
          return JSON.stringify({
            success: true,
            message: `تم تحديث الملف بنجاح: ${file.name}`,
            data: { id: file.id, name: file.name, webViewLink: file.webViewLink }
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل تحديث الملف: ${e.message}` });
        }
      }

      // ─── FILE MANAGEMENT (rename, move, delete) ───
      case "rename_drive_file": {
        const { fileId: renameFileId, newName: renameNewName } = args;
        if (!renameFileId || !renameNewName) return JSON.stringify({ error: "يجب تحديد معرف الملف والاسم الجديد" });
        try {
          const file = await renameFile(renameFileId, renameNewName);
          return JSON.stringify({
            success: true,
            message: `تم تغيير الاسم بنجاح إلى: ${file.name}`,
            data: { id: file.id, name: file.name, webViewLink: file.webViewLink }
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل تغيير الاسم: ${e.message}` });
        }
      }

      case "move_drive_file": {
        const { fileId: moveFileId, newParentFolderId: moveTarget } = args;
        if (!moveFileId || !moveTarget) return JSON.stringify({ error: "يجب تحديد معرف الملف ومعرف المجلد الجديد" });
        try {
          const file = await moveFile(moveFileId, moveTarget);
          return JSON.stringify({
            success: true,
            message: `تم نقل "${file.name}" بنجاح`,
            data: { id: file.id, name: file.name, newParents: file.parents, webViewLink: file.webViewLink }
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل نقل الملف: ${e.message}` });
        }
      }

      case "delete_drive_file": {
        const { fileId: delFileId, reason: delReason } = args;
        if (!delFileId || !delReason) return JSON.stringify({ error: "يجب تحديد معرف الملف وسبب الحذف" });
        try {
          // Get file info first
          const fileMeta = await getFileMetadata(delFileId);
          
          // Request approval from owner via Telegram
          const { requestDeleteApproval } = await import("./telegramBot");
          const approved = await requestDeleteApproval(
            delFileId,
            fileMeta.name,
            delReason,
            _currentAgent || "unknown"
          );

          if (!approved) {
            return JSON.stringify({
              success: false,
              message: `❌ تم رفض طلب حذف "${fileMeta.name}" من قبل المالك (أو انتهت المهلة)`
            });
          }

          // Approved - proceed with deletion
          await deleteFile(delFileId);
          return JSON.stringify({
            success: true,
            message: `✅ تم حذف "${fileMeta.name}" بعد موافقة المالك`
          });
        } catch (e: any) {
          return JSON.stringify({ error: `فشل عملية الحذف: ${e.message}` });
        }
      }

      // ─── SALWA: VIEW AGENT CONVERSATIONS ───
      case "view_agent_conversations": {
        const { targetAgent: viewTarget, limit: msgLimit } = args;
        const chatLimit = msgLimit || 20;
        const db = await getDb();
        if (!db) return JSON.stringify({ error: "قاعدة البيانات غير متاحة" });
        
        const { chatHistory } = await import("../drizzle/schema");
        
        if (viewTarget === "all") {
          // Get last 5 messages from each agent
          const allAgents = ["farouq", "khazen", "buraq", "khaled", "alina", "baz", "joelle"];
          const results: Record<string, any[]> = {};
          for (const ag of allAgents) {
            const msgs = await db.select()
              .from(chatHistory)
              .where(and(eq(chatHistory.userId, userId), eq(chatHistory.agent, ag)))
              .orderBy(desc(chatHistory.createdAt))
              .limit(5);
            if (msgs.length > 0) {
              results[ag] = msgs.reverse().map((m: any) => ({
                role: m.role,
                content: m.content.substring(0, 300),
                time: m.createdAt,
              }));
            }
          }
          return JSON.stringify({ 
            success: true, 
            summary: "آخر المحادثات مع جميع الوكلاء",
            conversations: results 
          });
        } else {
          const msgs = await db.select()
            .from(chatHistory)
            .where(and(eq(chatHistory.userId, userId), eq(chatHistory.agent, viewTarget)))
            .orderBy(desc(chatHistory.createdAt))
            .limit(chatLimit);
          return JSON.stringify({
            success: true,
            agent: viewTarget,
            messageCount: msgs.length,
            messages: msgs.reverse().map((m: any) => ({
              role: m.role,
              content: m.content,
              time: m.createdAt,
            })),
          });
        }
      }

      // ─── INTER-AGENT ───
      case "ask_another_agent": {
        // Agent-to-agent communication - use handleAgentChat
        const { targetAgent, question } = args;
        if (targetAgent === _currentAgent) {
          return JSON.stringify({ error: "لا يمكنك التواصل مع نفسك" });
        }
        console.log(`[InterAgent] ${_currentAgent} → ${targetAgent}: ${question.substring(0, 100)}`);
        const { handleAgentChat } = await import("./agentChat");
        const response = await handleAgentChat({
          agent: targetAgent,
          message: `[طلب من ${_currentAgent || "unknown"}] ${question}`,
          conversationHistory: [],
          userId,
        });
        console.log(`[InterAgent] ${targetAgent} responded (${response.text.length} chars)`);
        
        // Log to knowledge base so Salwa can see past agent interactions
        try {
          const { saveToKnowledgeBase } = await import("./knowledgeBase");
          await saveToKnowledgeBase({
            category: "agent_interactions",
            title: `${_currentAgent} → ${targetAgent}: ${question.slice(0, 100)}`,
            content: `**السؤال من ${_currentAgent}:**\n${question}\n\n**رد ${targetAgent}:**\n${response.text}`,
            tags: [_currentAgent || "unknown", targetAgent, "inter_agent"],
            userId,
          });
        } catch (kbError) {
          console.warn("[ask_another_agent] Failed to log to KB:", kbError);
        }
        
        return JSON.stringify({ 
          success: true, 
          agent: targetAgent, 
          question, 
          response: response.text 
        });
      }

      // ─── FACT SHEET UPDATE TOOL ───
      case "update_project_fact_sheet": {
        const { projectId: fsProjectId, ...fsFields } = args;
        if (!fsProjectId) return JSON.stringify({ error: "يجب تحديد معرف المشروع" });
        // Build update object with only provided fields
        const updateData: Record<string, any> = {};
        const allowedFields = [
          'plotNumber', 'areaCode', 'bua', 'titleDeedNumber', 'ddaNumber', 'masterDevRef',
          'plotAreaSqm', 'plotAreaSqft', 'gfaSqm', 'gfaSqft',
          'permittedUse', 'ownershipType', 'subdivisionRestrictions',
          'masterDevName', 'masterDevAddress', 'sellerName', 'sellerAddress',
          'buyerName', 'buyerNationality', 'buyerPassport', 'buyerAddress', 'buyerPhone', 'buyerEmail',
          'electricityAllocation', 'waterAllocation', 'sewageAllocation',
          'tripAM', 'tripLT', 'tripPM',
          'effectiveDate', 'constructionPeriod', 'constructionStartDate', 'completionDate', 'constructionConditions',
          'saleRestrictions', 'resaleConditions', 'communityCharges',
          'registrationAuthority', 'adminFee', 'clearanceFee', 'compensationAmount',
          'governingLaw', 'disputeResolution'
        ];
        for (const key of allowedFields) {
          if (fsFields[key] !== undefined && fsFields[key] !== null && fsFields[key] !== '') {
            updateData[key] = fsFields[key];
          }
        }
        if (Object.keys(updateData).length === 0) return JSON.stringify({ error: "لم يتم تقديم أي حقول للتحديث" });
        await db.update(projects).set(updateData).where(eq(projects.id, fsProjectId));
        return JSON.stringify({ 
          success: true, 
          message: `تم تحديث ${Object.keys(updateData).length} حقل في Fact Sheet`,
          updatedFields: Object.keys(updateData)
        });
      }

      // ─── CONTRACT REGISTRY TOOLS ───
      case "list_contract_types": {
        const types = await db.select().from(contractTypes).orderBy(contractTypes.category, contractTypes.sortOrder);
        return JSON.stringify({ contractTypes: types.map((t: any) => ({ id: t.id, name: t.name, nameEn: t.nameEn, code: t.code, category: t.category, description: t.description })) });
      }

      case "list_project_contracts": {
        const { projectId: pcProjectId } = args;
        if (!pcProjectId) return JSON.stringify({ error: "يجب تحديد معرف المشروع" });
        const pContracts = await db.select()
          .from(projectContracts)
          .leftJoin(contractTypes, eq(projectContracts.contractTypeId, contractTypes.id))
          .leftJoin(projects, eq(projectContracts.projectId, projects.id))
          .where(eq(projectContracts.projectId, pcProjectId));
        return JSON.stringify({ contracts: pContracts.map((r: any) => ({
          id: r.project_contracts.id,
          title: r.project_contracts.title,
          contractNumber: r.project_contracts.contractNumber,
          status: r.project_contracts.status,
          analysisStatus: r.project_contracts.analysisStatus,
          partyA: r.project_contracts.partyA,
          partyB: r.project_contracts.partyB,
          contractValue: r.project_contracts.contractValue,
          signDate: r.project_contracts.signDate,
          endDate: r.project_contracts.endDate,
          contractType: r.contract_types?.name,
          projectName: r.projects?.name,
        })) });
      }

      case "get_contract_details": {
        const { contractId: cdId } = args;
        if (!cdId) return JSON.stringify({ error: "يجب تحديد معرف العقد" });
        const [cDetail] = await db.select()
          .from(projectContracts)
          .leftJoin(contractTypes, eq(projectContracts.contractTypeId, contractTypes.id))
          .leftJoin(projects, eq(projectContracts.projectId, projects.id))
          .where(eq(projectContracts.id, cdId));
        if (!cDetail) return JSON.stringify({ error: "العقد غير موجود" });
        return JSON.stringify({
          contract: {
            ...cDetail.project_contracts,
            contractType: cDetail.contract_types?.name,
            contractTypeCode: cDetail.contract_types?.code,
            projectName: cDetail.projects?.name,
          }
        });
      }

      case "save_contract_analysis": {
        const { contractId: saId, summary: saSummary, keyDates, penalties, obligations, risks, parties, terminationClauses, notes: saNotes } = args;
        if (!saId || !saSummary) return JSON.stringify({ error: "يجب تحديد معرف العقد والملخص" });
        await db.update(projectContracts).set({
          analysisStatus: "completed",
          analysisSummary: saSummary,
          analysisKeyDates: keyDates || null,
          analysisPenalties: penalties || null,
          analysisObligations: obligations || null,
          analysisRisks: risks || null,
          analysisParties: parties || null,
          analysisTermination: terminationClauses || null,
          analysisNotes: saNotes || null,
          analyzedAt: Date.now(),
        }).where(eq(projectContracts.id, saId));
        return JSON.stringify({ success: true, message: "تم حفظ تحليل العقد بنجاح" });
      }

      // ─── EMAIL TOOLS ───
      case "check_email": {
        const hours = args.hours || 48;
        try {
          const emails = await fetchEmailsSince(hours);
          if (emails.length === 0) {
            return JSON.stringify({ message: `لا توجد رسائل في آخر ${hours} ساعة`, data: [] });
          }
          const readCount = emails.filter(e => e.isRead).length;
          const unreadCount = emails.filter(e => !e.isRead).length;
          const withAttachments = emails.filter(e => e.attachments.length > 0).length;
          return JSON.stringify({
            message: `وجدت ${emails.length} رسالة في آخر ${hours} ساعة (غير مقروء: ${unreadCount}, مقروء: ${readCount}, مع مرفقات: ${withAttachments})`,
            data: emails.slice(0, 20).map(e => ({
              uid: e.uid,
              from: e.from,
              fromName: e.fromName,
              subject: e.subject,
              date: e.date.toISOString(),
              isRead: e.isRead,
              hasAttachments: e.attachments.length > 0,
              attachmentCount: e.attachments.length,
              attachmentNames: e.attachments.map(a => a.filename).join(", "),
            }))
          });
        } catch (error: any) {
          return JSON.stringify({ error: `خطأ في فحص الإيميل: ${error.message}` });
        }
      }

      case "read_email": {
        const { uid } = args;
        try {
          const email = await fetchEmailByUID(uid);
          if (!email) {
            return JSON.stringify({ error: `لم يتم العثور على رسالة برقم UID: ${uid}` });
          }
          const attachmentList = email.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
            sizeFormatted: a.size > 1048576 ? `${(a.size / 1048576).toFixed(1)} MB` : a.size > 1024 ? `${(a.size / 1024).toFixed(0)} KB` : `${a.size} bytes`,
          }));
          const hasAttachments = attachmentList.length > 0;
          return JSON.stringify({
            message: `تفاصيل الرسالة من ${email.fromName} (${email.from})${hasAttachments ? ` - فيها ${attachmentList.length} مرفق` : ' - بدون مرفقات'}`,
            data: {
              uid: email.uid,
              messageId: email.messageId,
              from: email.from,
              fromName: email.fromName,
              to: email.to,
              cc: email.cc,
              subject: email.subject,
              date: email.date.toISOString(),
              body: email.textBody ? email.textBody.substring(0, 3000) : (email.htmlBody ? "الرسالة بصيغة HTML فقط - المحتوى موجود لكن بدون نص عادي" : "(لا يوجد نص)"),
              isRead: email.isRead,
              hasAttachments: hasAttachments,
              attachmentCount: attachmentList.length,
              attachments: attachmentList,
              attachmentSummary: hasAttachments 
                ? `📎 المرفقات (${attachmentList.length}): ${attachmentList.map(a => `${a.filename} (${a.sizeFormatted})`).join(', ')}`
                : "لا توجد مرفقات",
            }
          });
        } catch (error: any) {
          return JSON.stringify({ error: `خطأ في قراءة الرسالة: ${error.message}` });
        }
      }

      case "reply_email": {
        const { to, subject, body, inReplyTo, cc } = args;
        try {
          const success = await sendReply(to, subject, body, inReplyTo, cc);
          if (success) {
            return JSON.stringify({ success: true, message: `تم إرسال الرد بنجاح إلى ${to}` });
          } else {
            return JSON.stringify({ error: "فشل إرسال الرد" });
          }
        } catch (error: any) {
          return JSON.stringify({ error: `خطأ في إرسال الرد: ${error.message}` });
        }
      }

      case "compose_email": {
        const { to: cTo, subject: cSubject, body: cBody, cc: cCc } = args;
        try {
          const EMAIL_HOST = process.env.EMAIL_HOST || "mail.privateemail.com";
          const EMAIL_USER = process.env.EMAIL_USER || "a.zaqout@comodevelopments.com";
          const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || "";
          
          if (!EMAIL_PASSWORD) {
            return JSON.stringify({ error: "كلمة مرور الإيميل غير مهيأة" });
          }
          
          const transporter = nodemailer.createTransport({
            host: EMAIL_HOST,
            port: 465,
            secure: true,
            auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
          });
          
          await transporter.sendMail({
            from: `"Como Developments" <${EMAIL_USER}>`,
            to: cTo,
            subject: cSubject,
            html: cBody,
            ...(cCc ? { cc: cCc } : {}),
          });
          
          console.log(`[AgentTools] Email sent to ${cTo}: ${cSubject}`);
          return JSON.stringify({ success: true, message: `تم إرسال الإيميل بنجاح إلى ${cTo}` });
        } catch (error: any) {
          return JSON.stringify({ error: `خطأ في إرسال الإيميل: ${error.message}` });
        }
      }

      case "download_email_attachments": {
        const { uid: dlUid, targetFolderId, renamePattern } = args;
        try {
          // 1. Fetch the email with full attachment content
          const email = await fetchEmailByUID(dlUid);
          if (!email) {
            return JSON.stringify({ error: `لم يتم العثور على رسالة برقم UID: ${dlUid}` });
          }
          
          if (!email.attachments || email.attachments.length === 0) {
            return JSON.stringify({ error: "هذه الرسالة لا تحتوي على مرفقات" });
          }
          
          // 2. Find or create the target folder
          let folderId = targetFolderId;
          if (!folderId) {
            // Search for 00_Inbox/Emails folder
            try {
              const searchResult = await searchDriveFiles("00_Inbox");
              const inboxFolder = searchResult.find(f => f.name === "00_Inbox" && f.mimeType === "application/vnd.google-apps.folder");
              if (inboxFolder) {
                // Look for Emails subfolder inside 00_Inbox
                const subfolders = await listFilesInFolder(inboxFolder.id);
                const emailsFolder = subfolders.find(f => f.name === "Emails" && f.mimeType === "application/vnd.google-apps.folder");
                if (emailsFolder) {
                  folderId = emailsFolder.id;
                } else {
                  // Create Emails subfolder
                  const newFolder = await createFolder("Emails", inboxFolder.id);
                  folderId = newFolder.id;
                }
              }
            } catch (searchErr) {
              console.error("[AgentTools] Error finding 00_Inbox/Emails folder:", searchErr);
            }
          }
          
          if (!folderId) {
            return JSON.stringify({ error: "لم يتم العثور على مجلد 00_Inbox/Emails على Google Drive. يرجى تحديد targetFolderId يدوياً." });
          }
          
          // 3. Upload each attachment
          const uploadedFiles: any[] = [];
          const errors: string[] = [];
          const emailDate = email.date;
          const dateStr = `${emailDate.getFullYear()}${String(emailDate.getMonth()+1).padStart(2,'0')}${String(emailDate.getDate()).padStart(2,'0')}`;
          
          for (let i = 0; i < email.attachments.length; i++) {
            const att = email.attachments[i];
            if (!att.content) {
              errors.push(`${att.filename}: لا يوجد محتوى للتنزيل`);
              continue;
            }
            
            try {
              // Determine filename
              let fileName = att.filename;
              if (renamePattern) {
                // Use the rename pattern with index suffix if multiple
                const ext = att.filename.split('.').pop() || 'bin';
                fileName = email.attachments.length > 1 
                  ? `${renamePattern}_${i+1}.${ext}`
                  : `${renamePattern}.${ext}`;
              } else {
                // Add date prefix for traceability
                const senderName = email.fromName.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                const ext = att.filename.split('.').pop() || 'bin';
                const baseName = att.filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
                fileName = `${dateStr}_${senderName}_${baseName}.${ext}`;
              }
              
              const uploaded = await uploadBinaryFile(
                fileName,
                att.content,
                folderId,
                att.contentType
              );
              
              uploadedFiles.push({
                originalName: att.filename,
                uploadedName: fileName,
                driveFileId: uploaded.id,
                webViewLink: uploaded.webViewLink,
                size: att.size,
                contentType: att.contentType,
              });
              
              console.log(`[AgentTools] Uploaded attachment: ${fileName} -> Drive ID: ${uploaded.id}`);
            } catch (uploadErr: any) {
              errors.push(`${att.filename}: ${uploadErr.message}`);
              console.error(`[AgentTools] Failed to upload ${att.filename}:`, uploadErr);
            }
          }
          
          // 4. Return results
          const summary = uploadedFiles.length > 0
            ? `تم رفع ${uploadedFiles.length} مرفق بنجاح إلى Google Drive`
            : "لم يتم رفع أي مرفق";
          
          return JSON.stringify({
            success: uploadedFiles.length > 0,
            message: summary,
            emailSubject: email.subject,
            emailFrom: email.from,
            uploadedFiles,
            errors: errors.length > 0 ? errors : undefined,
          });
        } catch (error: any) {
          return JSON.stringify({ error: `خطأ في تنزيل المرفقات: ${error.message}` });
        }
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
    "get_consultant_profile", "get_committee_decision",
    "get_evaluator_scores", "get_feasibility_study",
    "list_meetings", "get_meeting_details", "get_meeting_tasks_status",
    "search_all_data", "query_institutional_memory",
    "list_drive_folders", "list_drive_files", "search_drive_files",
    "get_drive_file_info", "read_drive_file_content",
    "create_drive_document", "create_drive_spreadsheet",
    "ask_another_agent",
    "view_agent_conversations",
    "check_email", "read_email", "reply_email", "compose_email",
    "download_email_attachments",
  ],
  farouq: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_evaluation_scores", "get_evaluator_scores", "get_financial_data",
    "get_evaluation_criteria", "get_consultant_profile", "get_committee_decision",
    "set_evaluation_score", "set_financial_data", "add_consultant_note",
    "update_consultant_profile", "add_consultant",
    "list_meetings", "get_meeting_details", "query_institutional_memory",
    "list_drive_folders", "list_drive_files", "search_drive_files",
    "get_drive_file_info", "read_drive_file_content",
    "create_drive_document",
    "list_contract_types", "list_project_contracts", "get_contract_details", "save_contract_analysis",
    "ask_another_agent",
  ],
  khaled: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_evaluation_scores", "get_evaluator_scores", "get_financial_data",
    "get_evaluation_criteria", "get_consultant_profile",
    "set_evaluation_score", "add_consultant_note",
    "list_meetings", "get_meeting_details", "query_institutional_memory",
    "read_drive_file_content",
    "ask_another_agent",
  ],
  alina: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_financial_data", "get_evaluation_scores", "get_evaluation_criteria",
    "get_feasibility_study", "set_financial_data", "get_consultant_profile",
    "list_meetings", "get_meeting_details", "query_institutional_memory",
    "read_drive_file_content",
    "create_drive_document", "create_drive_spreadsheet",
    "ask_another_agent",
  ],
  joelle: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_financial_data", "get_evaluation_scores", "get_evaluation_criteria",
    "get_feasibility_study", "get_consultant_profile", "get_committee_decision",
    "list_meetings", "get_meeting_details", "query_institutional_memory",
    "browse_drive", "search_drive", "read_drive_file_content",
    "create_feasibility_study", "update_feasibility_study",
    "ask_another_agent",
  ],
  baz: [
    "list_projects", "list_consultants", "get_project_consultants",
    "get_evaluation_scores", "get_financial_data", "get_evaluation_criteria",
    "get_consultant_profile", "get_committee_decision", "list_tasks",
    "add_task",
    "list_meetings", "get_meeting_details", "query_institutional_memory",
    "ask_another_agent",
  ],
  buraq: [
    "list_projects", "list_consultants", "list_tasks",
    "add_task", "update_task_status", "get_project_consultants",
    "list_meetings", "get_meeting_tasks_status", "query_institutional_memory",
    "ask_another_agent",
  ],
  khazen: [
    "list_projects", "list_consultants", "get_consultant_profile",
    "add_consultant_note", "list_tasks",
    "list_meetings", "get_meeting_details", "query_institutional_memory",
    "list_drive_folders", "list_drive_files", "search_drive_files",
    "get_drive_file_info", "read_drive_file_content",
    "copy_drive_file", "batch_copy_drive_file", "create_drive_folder",
    "create_drive_document", "create_drive_spreadsheet",
    "upload_text_file", "update_drive_file",
    "rename_drive_file", "move_drive_file", "delete_drive_file",
    "update_project_fact_sheet",
    "ask_another_agent",
    "download_email_attachments",
  ],
};

export function getToolsForAgent(agent: AgentType) {
  const allowedNames = AGENT_ALLOWED_TOOLS[agent] || [];
  return AGENT_TOOLS.filter(t => allowedNames.includes(t.function.name));
}
