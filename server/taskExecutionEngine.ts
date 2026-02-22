/**
 * Task Execution Engine v2 - محرك تنفيذ المهام الذكي
 * 
 * البنية التحتية لغرفة العمليات - يضمن أن الوكلاء يستخدمون أدواتهم فعلياً
 * 
 * المراحل:
 * 1. تحليل المهمة وتحويلها لخطة عمل مهيكلة (Task Decomposition)
 * 2. توجيه ذكي للوكيل المناسب بناءً على الأدوات المطلوبة (Smart Routing)
 * 3. تنفيذ مع إجبار استخدام الأدوات (Forced Tool Execution)
 * 4. تحقق من النتائج الفعلية (Verification Loop)
 * 5. إعادة محاولة ذكية مع تصعيد (Smart Retry & Escalation)
 */

import { getDb } from "./db";
import { tasks, agents, meetings, meetingMessages, consultants, projects, projectConsultants, financialData, taskExecutionLogs } from "../drizzle/schema";
import { eq, like, and, desc, sql } from "drizzle-orm";
import { handleAgentChat, AgentType } from "./agentChat";
import { sendNotificationToOwner } from "./telegramBot";
import { invokeLLM } from "./_core/llm";

// ═══════════════════════════════════════════════════
// Types & Interfaces
// ═══════════════════════════════════════════════════

interface MeetingTask {
  task: string;
  assignee: string;
  deadline: string;
  priority: string;
}

interface ActionStep {
  stepNumber: number;
  description: string;
  toolName: string;
  toolParams: Record<string, any>;
  expectedOutcome: string;
  verificationTool?: string;
  verificationParams?: Record<string, any>;
}

interface ActionPlan {
  taskSummary: string;
  bestAgent: AgentType;
  reasoning: string;
  steps: ActionStep[];
  verificationQuery: string;
}

interface StepResult {
  stepNumber: number;
  toolName: string;
  success: boolean;
  toolOutput: string;
  verified: boolean;
  verificationResult?: string;
}

interface TaskExecutionResult {
  taskId: number;
  taskTitle: string;
  assignee: string;
  agentKey: AgentType | null;
  status: "created" | "executing" | "completed" | "partial" | "failed";
  actionPlan?: ActionPlan;
  stepResults?: StepResult[];
  result?: string;
  error?: string;
  toolsUsed: string[];
  dataChanges: string[];
}

// ═══════════════════════════════════════════════════
// Agent Capability Map - which agent can do what
// ═══════════════════════════════════════════════════

const AGENT_WRITE_CAPABILITIES: Record<AgentType, string[]> = {
  salwa: ["add_consultant", "add_consultant_to_project", "add_project", "add_task", "update_task_status"],
  farouq: ["set_evaluation_score", "set_financial_data", "add_consultant_note", "update_consultant_profile", "add_consultant"],
  khaled: ["set_evaluation_score", "add_consultant_note"],
  alina: ["set_financial_data"],
  buraq: ["add_task", "update_task_status"],
  khazen: ["add_consultant_note", "copy_drive_file", "create_drive_folder", "list_drive_files", "search_drive_files"],
  baz: ["add_task"],
  joelle: [],
};

const AGENT_READ_CAPABILITIES: Record<AgentType, string[]> = {
  salwa: ["list_projects", "list_consultants", "get_project_consultants", "get_evaluation_scores", "get_financial_data", "list_tasks", "get_consultant_profile", "get_committee_decision", "get_evaluator_scores", "get_feasibility_study", "list_meetings", "get_meeting_details", "get_meeting_tasks_status", "search_all_data", "query_institutional_memory", "read_drive_file_content"],
  farouq: ["list_projects", "list_consultants", "get_project_consultants", "get_evaluation_scores", "get_evaluator_scores", "get_financial_data", "get_evaluation_criteria", "get_consultant_profile", "get_committee_decision", "list_meetings", "get_meeting_details", "query_institutional_memory", "read_drive_file_content"],
  khaled: ["list_projects", "list_consultants", "get_project_consultants", "get_evaluation_scores", "get_evaluator_scores", "get_financial_data", "get_evaluation_criteria", "get_consultant_profile", "list_meetings", "get_meeting_details", "query_institutional_memory", "read_drive_file_content"],
  alina: ["list_projects", "list_consultants", "get_project_consultants", "get_financial_data", "get_evaluation_scores", "get_evaluation_criteria", "get_feasibility_study", "get_consultant_profile", "list_meetings", "get_meeting_details", "query_institutional_memory", "read_drive_file_content"],
  buraq: ["list_projects", "list_consultants", "list_tasks", "get_project_consultants", "list_meetings", "get_meeting_tasks_status", "query_institutional_memory"],
  khazen: ["list_projects", "list_consultants", "get_consultant_profile", "list_tasks", "list_meetings", "get_meeting_details", "query_institutional_memory", "list_drive_folders", "list_drive_files", "search_drive_files", "get_drive_file_info", "read_drive_file_content"],
  baz: ["list_projects", "list_consultants", "get_project_consultants", "get_evaluation_scores", "get_financial_data", "get_evaluation_criteria", "get_consultant_profile", "get_committee_decision", "list_tasks", "list_meetings", "get_meeting_details", "query_institutional_memory", "read_drive_file_content"],
  joelle: ["list_projects", "list_consultants", "get_project_consultants", "get_financial_data", "get_evaluation_scores", "get_evaluation_criteria", "get_feasibility_study", "get_consultant_profile", "get_committee_decision", "list_meetings", "get_meeting_details", "query_institutional_memory", "read_drive_file_content"],
};

// Task type → required tools mapping
const TASK_TYPE_TOOLS: Record<string, string[]> = {
  "register_consultant": ["add_consultant", "add_consultant_to_project"],
  "update_financial": ["set_financial_data", "get_financial_data"],
  "evaluate_consultant": ["set_evaluation_score", "get_evaluation_scores"],
  "update_profile": ["update_consultant_profile", "get_consultant_profile"],
  "add_note": ["add_consultant_note"],
  "create_task": ["add_task"],
  "update_task": ["update_task_status"],
  "add_project": ["add_project"],
  "general_review": ["search_all_data", "query_institutional_memory"],
};

// Arabic agent name → key mapping
const AGENT_NAME_MAP: Record<string, AgentType> = {
  "سلوى": "salwa", "salwa": "salwa",
  "فاروق": "farouq", "farouq": "farouq",
  "خازن": "khazen", "khazen": "khazen",
  "براق": "buraq", "buraq": "buraq",
  "خالد": "khaled", "khaled": "khaled",
  "ألينا": "alina", "الينا": "alina", "alina": "alina",
  "باز": "baz", "baz": "baz",
  "جويل": "joelle", "joelle": "joelle",
};

// ═══════════════════════════════════════════════════
// Phase 1: Task Analysis & Action Plan Generation
// ═══════════════════════════════════════════════════

/**
 * Analyze a task and generate a structured action plan using LLM
 */
async function generateActionPlan(
  task: MeetingTask,
  meetingContext: string,
  platformState: string
): Promise<ActionPlan> {
  const availableTools = [
    // Read tools
    { name: "list_projects", desc: "عرض جميع المشاريع", params: "{}" },
    { name: "list_consultants", desc: "عرض جميع الاستشاريين", params: "{}" },
    { name: "get_project_consultants", desc: "عرض استشاريي مشروع", params: '{"projectId": number}' },
    { name: "get_financial_data", desc: "عرض الأتعاب المالية لمشروع", params: '{"projectId": number}' },
    { name: "get_evaluation_scores", desc: "عرض درجات التقييم", params: '{"projectId": number}' },
    { name: "get_consultant_profile", desc: "عرض بروفايل استشاري", params: '{"consultantId": number}' },
    { name: "search_all_data", desc: "بحث شامل", params: '{"query": string}' },
    { name: "list_tasks", desc: "عرض المهام", params: '{"status?": string}' },
    // Write tools
    { name: "add_consultant", desc: "إضافة استشاري جديد", params: '{"name": string, "email?": string, "phone?": string, "specialization?": string}' },
    { name: "add_consultant_to_project", desc: "ربط استشاري بمشروع", params: '{"projectId": number, "consultantId": number}' },
    { name: "update_consultant", desc: "تحديث بيانات استشاري", params: '{"consultantId": number, "name?": string, "email?": string}' },
    { name: "set_financial_data", desc: "تعيين أتعاب استشاري", params: '{"projectId": number, "consultantId": number, "designType": "pct"|"lump", "designValue": number, "supervisionType": "pct"|"lump", "supervisionValue": number}' },
    { name: "set_evaluation_score", desc: "تعيين درجة تقييم", params: '{"projectId": number, "consultantId": number, "criterionId": 0-9, "score": 2|4|6|8|10}' },
    { name: "update_consultant_profile", desc: "تحديث بروفايل استشاري", params: '{"consultantId": number, ...fields}' },
    { name: "add_consultant_note", desc: "إضافة ملاحظة على استشاري", params: '{"consultantId": number, "content": string, "title?": string, "category?": "meeting"|"feedback"|"general"}' },
    { name: "add_task", desc: "إضافة مهمة", params: '{"title": string, "project": string, "owner": string, "description?": string, "priority?": "high"|"medium"|"low", "dueDate?": "YYYY-MM-DD"}' },
    { name: "update_task_status", desc: "تحديث حالة مهمة", params: '{"taskId": number, "status": "new"|"progress"|"hold"|"done"|"cancelled", "progress?": 0-100}' },
    { name: "add_project", desc: "إضافة مشروع", params: '{"name": string, "description?": string, "bua?": number, "pricePerSqft?": number}' },
  ];

  const agentCapabilities = Object.entries(AGENT_WRITE_CAPABILITIES)
    .filter(([_, tools]) => tools.length > 0)
    .map(([agent, tools]) => `${agent}: ${tools.join(", ")}`)
    .join("\n");

  const prompt = `أنت محلل مهام ذكي. مهمتك تحليل المهمة التالية وتحويلها لخطة عمل مهيكلة.

المهمة: "${task.task}"
المسؤول المقترح: ${task.assignee}
الأولوية: ${task.priority}
الموعد: ${task.deadline}

سياق الاجتماع:
${meetingContext.substring(0, 1500)}

حالة المنصة الحالية:
${platformState.substring(0, 2000)}

الأدوات المتاحة:
${availableTools.map(t => `- ${t.name}: ${t.desc} | المعاملات: ${t.params}`).join("\n")}

قدرات الوكلاء (أدوات الكتابة فقط):
${agentCapabilities}

أنشئ خطة عمل بصيغة JSON تتضمن:
1. ملخص المهمة
2. أفضل وكيل لتنفيذها (بناءً على الأدوات المطلوبة)
3. سبب اختيار هذا الوكيل
4. خطوات تنفيذية محددة - كل خطوة تحدد أداة معينة مع معاملاتها
5. استعلام تحقق للتأكد من التنفيذ

قواعد مهمة:
- كل خطوة يجب أن تحدد أداة محددة من القائمة أعلاه
- ابدأ بخطوات القراءة (جمع المعلومات) ثم خطوات الكتابة (التنفيذ)
- اختر الوكيل الذي لديه أدوات الكتابة المطلوبة
- إذا كانت المهمة تحتاج بيانات غير متوفرة في المنصة، أنشئ خطوة لإضافتها
- إذا كانت المهمة مراجعة أو تحليل فقط (بدون تغيير بيانات)، استخدم أدوات القراءة + add_consultant_note لتسجيل النتائج

أجب بـ JSON فقط بالصيغة التالية:
{
  "taskSummary": "ملخص واضح للمهمة",
  "bestAgent": "اسم الوكيل (salwa/farouq/khaled/alina/buraq/khazen/baz)",
  "reasoning": "لماذا هذا الوكيل",
  "steps": [
    {
      "stepNumber": 1,
      "description": "وصف الخطوة",
      "toolName": "اسم الأداة",
      "toolParams": {"param1": "value1"},
      "expectedOutcome": "النتيجة المتوقعة",
      "verificationTool": "أداة التحقق (اختياري)",
      "verificationParams": {"param1": "value1"}
    }
  ],
  "verificationQuery": "استعلام نهائي للتحقق من التنفيذ"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "أنت محلل مهام متخصص. أجب بـ JSON فقط بدون أي نص إضافي." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "action_plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              taskSummary: { type: "string" },
              bestAgent: { type: "string" },
              reasoning: { type: "string" },
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    stepNumber: { type: "integer" },
                    description: { type: "string" },
                    toolName: { type: "string" },
                    toolParams: { type: "object", additionalProperties: true },
                    expectedOutcome: { type: "string" },
                    verificationTool: { type: "string" },
                    verificationParams: { type: "object", additionalProperties: true },
                  },
                  required: ["stepNumber", "description", "toolName", "toolParams", "expectedOutcome"],
                  additionalProperties: false,
                },
              },
              verificationQuery: { type: "string" },
            },
            required: ["taskSummary", "bestAgent", "reasoning", "steps", "verificationQuery"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const plan = JSON.parse(content) as ActionPlan;
    
    // Validate and fix agent assignment
    const validAgents: AgentType[] = ["salwa", "farouq", "khaled", "alina", "buraq", "khazen", "baz", "joelle"];
    if (!validAgents.includes(plan.bestAgent as AgentType)) {
      plan.bestAgent = "salwa" as AgentType; // Default to coordinator
    }

    // Ensure agent has the required write tools
    const requiredWriteTools = plan.steps
      .filter(s => !s.toolName.startsWith("list_") && !s.toolName.startsWith("get_") && !s.toolName.startsWith("search_") && !s.toolName.startsWith("query_"))
      .map(s => s.toolName);
    
    const agentWriteTools = AGENT_WRITE_CAPABILITIES[plan.bestAgent as AgentType] || [];
    const missingTools = requiredWriteTools.filter(t => !agentWriteTools.includes(t));
    
    if (missingTools.length > 0) {
      // Find a better agent that has all required tools
      const betterAgent = findBestAgentForTools(requiredWriteTools);
      if (betterAgent) {
        console.log(`[TaskEngine] Rerouted task from ${plan.bestAgent} to ${betterAgent} (missing tools: ${missingTools.join(", ")})`);
        plan.bestAgent = betterAgent;
      }
    }

    return plan;
  } catch (err) {
    console.error("[TaskEngine] Action plan generation failed:", err);
    // Fallback: create a simple plan
    return createFallbackPlan(task);
  }
}

/**
 * Find the best agent that has all required write tools
 */
function findBestAgentForTools(requiredTools: string[]): AgentType | null {
  let bestAgent: AgentType | null = null;
  let bestScore = 0;

  for (const [agent, tools] of Object.entries(AGENT_WRITE_CAPABILITIES)) {
    const matchCount = requiredTools.filter(t => tools.includes(t)).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestAgent = agent as AgentType;
    }
  }

  return bestAgent;
}

/**
 * Create a fallback action plan when LLM fails
 */
function createFallbackPlan(task: MeetingTask): ActionPlan {
  const agentKey = resolveAgentFromName(task.assignee);
  return {
    taskSummary: task.task,
    bestAgent: agentKey || "salwa",
    reasoning: "خطة احتياطية - فشل التحليل التلقائي",
    steps: [
      {
        stepNumber: 1,
        description: "بحث شامل عن البيانات المتعلقة بالمهمة",
        toolName: "search_all_data",
        toolParams: { query: task.task },
        expectedOutcome: "جمع المعلومات اللازمة",
      },
      {
        stepNumber: 2,
        description: "تسجيل نتائج المراجعة كملاحظة",
        toolName: "add_task",
        toolParams: { title: task.task, project: "عام", owner: task.assignee, priority: "medium" },
        expectedOutcome: "إنشاء مهمة للمتابعة",
      },
    ],
    verificationQuery: "list_tasks",
  };
}

function resolveAgentFromName(assignee: string): AgentType | null {
  const lower = assignee.toLowerCase().trim();
  if (AGENT_NAME_MAP[lower]) return AGENT_NAME_MAP[lower];
  for (const [name, key] of Object.entries(AGENT_NAME_MAP)) {
    if (lower.includes(name) || name.includes(lower)) return key;
  }
  return null;
}

// ═══════════════════════════════════════════════════
// Phase 2: Get Platform State for Context
// ═══════════════════════════════════════════════════

async function getPlatformState(): Promise<string> {
  const db = await getDb();
  if (!db) return "قاعدة البيانات غير متاحة";

  let state = "";
  try {
    const projectList = await db.select().from(projects);
    state += `المشاريع (${projectList.length}):\n${projectList.map(p => `- ID:${p.id} ${p.name}`).join("\n")}\n\n`;
  } catch {}

  try {
    const consultantList = await db.select().from(consultants);
    state += `الاستشاريون (${consultantList.length}):\n${consultantList.map(c => `- ID:${c.id} ${c.name}`).join("\n")}\n\n`;
  } catch {}

  try {
    const pcList = await db.select().from(projectConsultants);
    state += `ربط المشاريع-الاستشاريين (${pcList.length} رابط):\n`;
    const byProject: Record<number, number[]> = {};
    for (const pc of pcList) {
      if (!byProject[pc.projectId]) byProject[pc.projectId] = [];
      byProject[pc.projectId].push(pc.consultantId);
    }
    for (const [pid, cids] of Object.entries(byProject)) {
      state += `- مشروع ${pid}: استشاريون [${cids.join(", ")}]\n`;
    }
    state += "\n";
  } catch {}

  try {
    const finData = await db.select().from(financialData);
    state += `البيانات المالية (${finData.length} سجل)\n\n`;
  } catch {}

  return state;
}

// ═══════════════════════════════════════════════════
// Phase 3: Execute with Forced Tool Usage
// ═══════════════════════════════════════════════════

/**
 * Execute a task using the action plan - forces the agent to use specific tools
 */
async function executeWithActionPlan(
  plan: ActionPlan,
  userId: number,
  meetingId: number,
  meetingTitle: string
): Promise<{ stepResults: StepResult[]; agentResponse: string; toolsUsed: string[]; dataChanges: string[] }> {
  const toolsUsed: string[] = [];
  const dataChanges: string[] = [];
  const stepResults: StepResult[] = [];

  // Build a very specific execution prompt that forces tool usage
  const stepsDescription = plan.steps.map(s => 
    `الخطوة ${s.stepNumber}: ${s.description}\n   الأداة: ${s.toolName}\n   المعاملات: ${JSON.stringify(s.toolParams)}\n   النتيجة المتوقعة: ${s.expectedOutcome}`
  ).join("\n\n");

  const executionPrompt = `⚡ [أمر تنفيذي مباشر - اجتماع "${meetingTitle}"]

المهمة: ${plan.taskSummary}

🔴 تعليمات إلزامية:
1. يجب أن تستخدم الأدوات المحددة أدناه بالترتيب
2. لا تكتفِ بالوصف - نفّذ كل خطوة فعلياً باستخدام الأداة المحددة
3. إذا فشلت خطوة، سجّل السبب وانتقل للخطوة التالية
4. في نهاية التنفيذ، أبلغ عن كل خطوة: هل نجحت أم فشلت ولماذا

خطة التنفيذ المطلوبة:
${stepsDescription}

🔴 مهم جداً: يجب أن تستدعي الأدوات فعلياً. إذا لم تستخدم أي أداة، سيُعتبر التنفيذ فاشلاً.

ابدأ التنفيذ الآن - الخطوة 1 أولاً.`;

  try {
    const agentResponse = await handleAgentChat({
      agent: plan.bestAgent,
      message: executionPrompt,
      userId,
      conversationHistory: [],
    });

    // Parse the response to check if tools were actually used
    // The agentChat system logs tool calls, so we check the assignment logs
    const db = await getDb();
    if (db) {
      try {
        const { agentAssignments } = await import("../drizzle/schema");
        const recentAssignments = await db.select()
          .from(agentAssignments)
          .where(eq(agentAssignments.agent, plan.bestAgent))
          .orderBy(desc(agentAssignments.createdAt))
          .limit(plan.steps.length + 5);

        // Check which tools were actually called in the last few minutes
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentCalls = recentAssignments.filter(a => 
          a.createdAt && new Date(a.createdAt) > fiveMinAgo
        );

        for (const call of recentCalls) {
          if (call.toolUsed) toolsUsed.push(call.toolUsed);
          if (call.status === "completed" && call.toolResult) {
            dataChanges.push(`${call.toolUsed}: ${call.toolResult.substring(0, 200)}`);
          }
        }

        // Create step results based on what we know
        for (const step of plan.steps) {
          const matchingCall = recentCalls.find(c => c.toolUsed === step.toolName);
          stepResults.push({
            stepNumber: step.stepNumber,
            toolName: step.toolName,
            success: matchingCall?.status === "completed",
            toolOutput: matchingCall?.toolResult || "لم يتم استدعاء الأداة",
            verified: false,
          });
        }
      } catch (e) {
        console.error("[TaskEngine] Failed to check assignments:", e);
      }
    }

    return {
      stepResults,
      agentResponse: agentResponse.text,
      toolsUsed,
      dataChanges,
    };
  } catch (err) {
    console.error(`[TaskEngine] Execution failed for agent ${plan.bestAgent}:`, err);
    return {
      stepResults: plan.steps.map(s => ({
        stepNumber: s.stepNumber,
        toolName: s.toolName,
        success: false,
        toolOutput: `خطأ: ${String(err)}`,
        verified: false,
      })),
      agentResponse: `فشل التنفيذ: ${String(err)}`,
      toolsUsed: [],
      dataChanges: [],
    };
  }
}

// ═══════════════════════════════════════════════════
// Phase 4: Verification
// ═══════════════════════════════════════════════════

/**
 * Verify that the task execution actually changed data
 */
async function verifyExecution(
  plan: ActionPlan,
  stepResults: StepResult[],
  toolsUsed: string[]
): Promise<{ verified: boolean; details: string }> {
  // Check 1: Were any write tools actually called?
  const writeToolNames = new Set([
    "add_consultant", "update_consultant", "add_consultant_to_project",
    "remove_consultant_from_project", "set_evaluation_score", "set_financial_data",
    "add_project", "add_task", "update_task_status", "update_consultant_profile",
    "add_consultant_note"
  ]);

  const writeToolsUsed = toolsUsed.filter(t => writeToolNames.has(t));
  
  if (writeToolsUsed.length === 0) {
    // Check if the task required write operations
    const requiredWriteSteps = plan.steps.filter(s => writeToolNames.has(s.toolName));
    if (requiredWriteSteps.length > 0) {
      return {
        verified: false,
        details: `المهمة تطلبت ${requiredWriteSteps.length} عمليات كتابة لكن لم يتم تنفيذ أي منها. الأدوات المطلوبة: ${requiredWriteSteps.map(s => s.toolName).join(", ")}`,
      };
    }
    // Read-only task, consider verified if any tools were used
    return {
      verified: toolsUsed.length > 0,
      details: toolsUsed.length > 0 
        ? `مهمة قراءة فقط - تم استخدام ${toolsUsed.length} أدوات`
        : "لم يتم استخدام أي أداة",
    };
  }

  // Check 2: Were the successful steps actually verified?
  const successfulSteps = stepResults.filter(s => s.success);
  
  return {
    verified: successfulSteps.length > 0,
    details: `تم تنفيذ ${successfulSteps.length}/${plan.steps.length} خطوات. أدوات الكتابة المستخدمة: ${writeToolsUsed.join(", ")}`,
  };
}

// ═══════════════════════════════════════════════════
// Main Entry Points
// ═══════════════════════════════════════════════════

/**
 * Create tasks in the task system from meeting outputs
 */
export async function createTasksFromMeeting(
  meetingId: number,
  userId: number,
  meetingTitle: string,
  extractedTasks: MeetingTask[]
): Promise<TaskExecutionResult[]> {
  const db = await getDb();
  if (!db) return [];

  const results: TaskExecutionResult[] = [];

  for (const task of extractedTasks) {
    try {
      const agentKey = resolveAgentFromName(task.assignee);
      const priorityMap: Record<string, "high" | "medium" | "low"> = {
        "عالي": "high", "عالية": "high", "high": "high", "مرتفع": "high", "مرتفعة": "high",
        "متوسط": "medium", "متوسطة": "medium", "medium": "medium",
        "منخفض": "low", "منخفضة": "low", "low": "low",
      };
      const priority = priorityMap[task.priority?.toLowerCase()] || "medium";

      const [inserted] = await db.insert(tasks).values({
        title: task.task,
        description: `مهمة مستخرجة من اجتماع: ${meetingTitle}\nالمسؤول: ${task.assignee}\nالموعد: ${task.deadline || "غير محدد"}`,
        project: meetingTitle,
        category: "meeting-task",
        owner: task.assignee,
        priority,
        status: "new",
        progress: 0,
        dueDate: task.deadline !== "غير محدد" && task.deadline !== "" ? task.deadline : undefined,
        source: "agent",
        sourceAgent: `meeting-${meetingId}`,
      });

      results.push({
        taskId: inserted.insertId,
        taskTitle: task.task,
        assignee: task.assignee,
        agentKey,
        status: "created",
        toolsUsed: [],
        dataChanges: [],
      });
    } catch (err) {
      console.error(`[TaskEngine] Failed to create task: ${task.task}`, err);
      results.push({
        taskId: 0,
        taskTitle: task.task,
        assignee: task.assignee,
        agentKey: null,
        status: "failed",
        error: String(err),
        toolsUsed: [],
        dataChanges: [],
      });
    }
  }

  return results;
}

/**
 * Execute tasks using the new engine with action plans, forced tools, and verification
 */
export async function executeTasksByAgents(
  meetingId: number,
  userId: number,
  meetingTitle: string,
  taskResults: TaskExecutionResult[],
  meetingContext: string
): Promise<TaskExecutionResult[]> {
  const db = await getDb();
  if (!db) return taskResults;

  // Get platform state once for all tasks
  const platformState = await getPlatformState();
  const executionResults: TaskExecutionResult[] = [];

  for (const taskResult of taskResults) {
    if (taskResult.status !== "created" || !taskResult.agentKey) {
      executionResults.push(taskResult);
      continue;
    }

    const maxRetries = 2;
    let attempt = 0;
    let finalResult: TaskExecutionResult = { ...taskResult };
    const startTime = Date.now();

    while (attempt < maxRetries) {
      attempt++;
      console.log(`[TaskEngine] Executing task "${taskResult.taskTitle}" - attempt ${attempt}/${maxRetries}`);

      try {
        // Update task status
        if (taskResult.taskId > 0) {
          await db.update(tasks).set({ status: "progress", progress: 10 })
            .where(eq(tasks.id, taskResult.taskId));
        }

        // Step 1: Generate action plan
        const plan = await generateActionPlan(
          { task: taskResult.taskTitle, assignee: taskResult.assignee, deadline: "", priority: "medium" },
          meetingContext,
          platformState
        );

        console.log(`[TaskEngine] Action plan for "${taskResult.taskTitle}": ${plan.steps.length} steps, agent: ${plan.bestAgent}`);

        // Log action plan to meeting messages
        await db.insert(meetingMessages).values({
          meetingId,
          speakerId: "system",
          speakerType: "agent",
          messageText: `📋 خطة تنفيذ "${taskResult.taskTitle}":\n${plan.steps.map(s => `${s.stepNumber}. ${s.description} (${s.toolName})`).join("\n")}\nالوكيل: ${plan.bestAgent} | السبب: ${plan.reasoning}`,
        });

        // Step 2: Execute with action plan
        const execution = await executeWithActionPlan(plan, userId, meetingId, meetingTitle);

        // Step 3: Verify
        const verification = await verifyExecution(plan, execution.stepResults, execution.toolsUsed);

        console.log(`[TaskEngine] Verification for "${taskResult.taskTitle}": ${verification.verified ? "PASSED" : "FAILED"} - ${verification.details}`);

        // Determine final status
        const toolsActuallyUsed = execution.toolsUsed.length > 0;
        const hasSuccessfulSteps = execution.stepResults.some(s => s.success);

        if (verification.verified) {
          // Success!
          if (taskResult.taskId > 0) {
            await db.update(tasks).set({ status: "done", progress: 100 })
              .where(eq(tasks.id, taskResult.taskId));
          }

          await db.insert(meetingMessages).values({
            meetingId,
            speakerId: plan.bestAgent,
            speakerType: "agent",
            messageText: `✅ [تنفيذ مهمة] ${taskResult.taskTitle}\n\n${execution.agentResponse}\n\n📊 التحقق: ${verification.details}\n🔧 الأدوات المستخدمة: ${execution.toolsUsed.join(", ") || "لا يوجد"}`,
          });

          finalResult = {
            ...taskResult,
            agentKey: plan.bestAgent,
            status: "completed",
            actionPlan: plan,
            stepResults: execution.stepResults,
            result: execution.agentResponse,
            toolsUsed: execution.toolsUsed,
            dataChanges: execution.dataChanges,
          };
          break; // Success, no need to retry

        } else if (hasSuccessfulSteps) {
          // Partial success
          if (taskResult.taskId > 0) {
            const progress = Math.round((execution.stepResults.filter(s => s.success).length / plan.steps.length) * 100);
            await db.update(tasks).set({ status: "progress", progress })
              .where(eq(tasks.id, taskResult.taskId));
          }

          finalResult = {
            ...taskResult,
            agentKey: plan.bestAgent,
            status: "partial",
            actionPlan: plan,
            stepResults: execution.stepResults,
            result: execution.agentResponse,
            toolsUsed: execution.toolsUsed,
            dataChanges: execution.dataChanges,
          };

          if (attempt < maxRetries) {
            console.log(`[TaskEngine] Partial success, retrying...`);
            continue;
          }
          break;

        } else {
          // Failed - retry if possible
          finalResult = {
            ...taskResult,
            agentKey: plan.bestAgent,
            status: "failed",
            actionPlan: plan,
            stepResults: execution.stepResults,
            error: `التحقق فشل: ${verification.details}`,
            toolsUsed: execution.toolsUsed,
            dataChanges: execution.dataChanges,
          };

          if (attempt < maxRetries) {
            console.log(`[TaskEngine] Failed, retrying with different approach...`);
            continue;
          }
        }

      } catch (err) {
        console.error(`[TaskEngine] Attempt ${attempt} failed for "${taskResult.taskTitle}":`, err);
        finalResult = {
          ...taskResult,
          status: "failed",
          error: String(err),
          toolsUsed: [],
          dataChanges: [],
        };

        if (attempt >= maxRetries) break;
      }
    }

    // Mark failed tasks
    if (finalResult.status === "failed" && taskResult.taskId > 0) {
      await db.update(tasks).set({ status: "hold", progress: 0 })
        .where(eq(tasks.id, taskResult.taskId));
    }

    // === LOG EXECUTION TO DATABASE ===
    try {
      const writeToolNames = new Set(["add_consultant", "update_consultant", "add_consultant_to_project", "set_evaluation_score", "set_financial_data", "add_project", "add_task", "update_task_status", "update_consultant_profile", "add_consultant_note"]);
      const writeToolsUsed = finalResult.toolsUsed.filter(t => writeToolNames.has(t));
      const completedSteps = finalResult.stepResults?.filter(s => s.success).length || 0;
      const totalSteps = finalResult.stepResults?.length || finalResult.actionPlan?.steps.length || 0;

      await db.insert(taskExecutionLogs).values({
        taskId: taskResult.taskId > 0 ? taskResult.taskId : undefined,
        meetingId,
        agent: finalResult.agentKey || taskResult.assignee,
        taskTitle: taskResult.taskTitle,
        actionPlanJson: finalResult.actionPlan ? JSON.stringify(finalResult.actionPlan) : undefined,
        totalSteps,
        completedSteps,
        status: finalResult.status === "completed" ? "completed" : finalResult.status === "partial" ? "partial" : "failed",
        attempt,
        maxAttempts: maxRetries,
        toolsUsedJson: JSON.stringify(finalResult.toolsUsed),
        toolCallCount: finalResult.toolsUsed.length,
        writeToolCount: writeToolsUsed.length,
        stepResultsJson: finalResult.stepResults ? JSON.stringify(finalResult.stepResults) : undefined,
        verified: finalResult.stepResults?.some(s => s.verified) ? 1 : 0,
        verificationDetails: finalResult.error || undefined,
        dataChangesJson: finalResult.dataChanges.length > 0 ? JSON.stringify(finalResult.dataChanges) : undefined,
        agentResponse: finalResult.result?.substring(0, 5000),
        errorMessage: finalResult.error,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      });
      console.log(`[TaskEngine] Execution logged for task "${taskResult.taskTitle}" - status: ${finalResult.status}`);
    } catch (logErr) {
      console.error("[TaskEngine] Failed to log execution:", logErr);
    }

    executionResults.push(finalResult);
  }

  return executionResults;
}

// ═══════════════════════════════════════════════════
// Reporting
// ═══════════════════════════════════════════════════

/**
 * Generate detailed execution report
 */
export function generateExecutionReport(results: TaskExecutionResult[]): string {
  const completed = results.filter(r => r.status === "completed");
  const partial = results.filter(r => r.status === "partial");
  const failed = results.filter(r => r.status === "failed");

  let report = `📊 **تقرير تنفيذ مهام الاجتماع**\n\n`;
  report += `إجمالي المهام: ${results.length}\n`;
  report += `✅ مكتملة: ${completed.length}\n`;
  if (partial.length > 0) report += `🔶 جزئية: ${partial.length}\n`;
  report += `❌ فشلت: ${failed.length}\n\n`;

  // All tools used across all tasks
  const allToolsUsed = new Set(results.flatMap(r => r.toolsUsed));
  if (allToolsUsed.size > 0) {
    report += `🔧 الأدوات المستخدمة: ${Array.from(allToolsUsed).join(", ")}\n\n`;
  }

  if (completed.length > 0) {
    report += `--- المهام المكتملة ---\n\n`;
    for (const r of completed) {
      report += `✅ **${r.taskTitle}** (${r.assignee} → ${r.agentKey})\n`;
      if (r.toolsUsed.length > 0) report += `   🔧 أدوات: ${r.toolsUsed.join(", ")}\n`;
      if (r.dataChanges.length > 0) report += `   📝 تغييرات: ${r.dataChanges.length}\n`;
      if (r.result) {
        const shortResult = r.result.length > 200 ? r.result.substring(0, 200) + "..." : r.result;
        report += `   النتيجة: ${shortResult}\n`;
      }
      report += "\n";
    }
  }

  if (partial.length > 0) {
    report += `--- المهام الجزئية ---\n\n`;
    for (const r of partial) {
      const successSteps = r.stepResults?.filter(s => s.success).length || 0;
      const totalSteps = r.stepResults?.length || 0;
      report += `🔶 **${r.taskTitle}** (${r.assignee} → ${r.agentKey})\n`;
      report += `   تم ${successSteps}/${totalSteps} خطوات\n`;
      if (r.toolsUsed.length > 0) report += `   🔧 أدوات: ${r.toolsUsed.join(", ")}\n`;
      report += "\n";
    }
  }

  if (failed.length > 0) {
    report += `--- المهام التي فشلت ---\n\n`;
    for (const r of failed) {
      report += `❌ **${r.taskTitle}** (${r.assignee})\n`;
      report += `   السبب: ${r.error || "خطأ غير معروف"}\n\n`;
    }
  }

  return report;
}

/**
 * Send notification with execution report
 */
export async function notifyOwnerViaTelegram(
  meetingTitle: string,
  results: TaskExecutionResult[]
): Promise<void> {
  const completed = results.filter(r => r.status === "completed");
  const partial = results.filter(r => r.status === "partial");
  const failed = results.filter(r => r.status === "failed");

  let message = `🏢 *تقرير تنفيذ مهام الاجتماع*\n\n`;
  message += `📋 الاجتماع: ${meetingTitle}\n`;
  message += `📊 إجمالي: ${results.length} | ✅ ${completed.length} | 🔶 ${partial.length} | ❌ ${failed.length}\n\n`;

  const allToolsUsed = new Set(results.flatMap(r => r.toolsUsed));
  if (allToolsUsed.size > 0) {
    message += `🔧 أدوات مستخدمة: ${allToolsUsed.size}\n\n`;
  }

  for (const r of completed) {
    message += `✅ ${r.taskTitle} (${r.agentKey})\n`;
  }
  for (const r of partial) {
    message += `🔶 ${r.taskTitle} (${r.agentKey}) - جزئي\n`;
  }
  for (const r of failed) {
    message += `❌ ${r.taskTitle} - فشل\n`;
  }

  message += `\n💡 راجع التفاصيل في المنصة.`;

  try {
    await sendNotificationToOwner(message, "Markdown");
  } catch (err) {
    console.error("[TaskEngine] Telegram notification failed:", err);
  }
}
