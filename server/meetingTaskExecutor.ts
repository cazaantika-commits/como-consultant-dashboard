/**
 * Meeting Task Executor - نظام تنفيذ المهام من الاجتماعات
 * 
 * عند إنهاء اجتماع، يتم:
 * 1. إنشاء مهام حقيقية في نظام المهام
 * 2. إسناد كل مهمة للوكيل المسؤول
 * 3. تنفيذ المهام بواسطة الوكلاء باستخدام أدواتهم
 * 4. تحديث حالة المهام وإبلاغ المدير بالنتائج
 */

import { getDb } from "./db";
import { tasks, agents, meetings, meetingMessages } from "../drizzle/schema";
import { eq, like } from "drizzle-orm";
import { handleAgentChat, AgentType } from "./agentChat";
import { sendNotificationToOwner } from "./telegramBot";

// Map Arabic agent names to agent keys
const AGENT_NAME_MAP: Record<string, AgentType> = {
  "سلوى": "salwa",
  "salwa": "salwa",
  "فاروق": "farouq",
  "farouq": "farouq",
  "خازن": "khazen",
  "khazen": "khazen",
  "براق": "buraq",
  "buraq": "buraq",
  "خالد": "khaled",
  "khaled": "khaled",
  "ألينا": "alina",
  "الينا": "alina",
  "alina": "alina",
  "باز": "baz",
  "baz": "baz",
  "جويل": "joelle",
  "joelle": "joelle",
};

// Resolve agent name from task assignee text
function resolveAgentKey(assignee: string): AgentType | null {
  const lower = assignee.toLowerCase().trim();
  
  // Direct match
  if (AGENT_NAME_MAP[lower]) return AGENT_NAME_MAP[lower];
  
  // Partial match
  for (const [name, key] of Object.entries(AGENT_NAME_MAP)) {
    if (lower.includes(name) || name.includes(lower)) return key;
  }
  
  // Default to salwa for coordination tasks
  if (lower.includes("المنسق") || lower.includes("الفريق") || lower.includes("الجميع")) {
    return "salwa";
  }
  
  return null;
}

// Determine project from task context
function extractProjectHint(taskText: string): string {
  // Common project-related keywords
  const projectPatterns = [
    /مشروع\s+(.+?)(?:\s|$|،|\.)/,
    /project\s+(.+?)(?:\s|$|,|\.)/i,
  ];
  
  for (const pattern of projectPatterns) {
    const match = taskText.match(pattern);
    if (match) return match[1].trim();
  }
  
  return "عام";
}

interface MeetingTask {
  task: string;
  assignee: string;
  deadline: string;
  priority: string;
}

interface TaskExecutionResult {
  taskId: number;
  taskTitle: string;
  assignee: string;
  agentKey: AgentType | null;
  status: "created" | "executing" | "completed" | "failed";
  result?: string;
  error?: string;
}

/**
 * Create real tasks in the task system from meeting outputs
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
      const agentKey = resolveAgentKey(task.assignee);
      const priorityMap: Record<string, "high" | "medium" | "low"> = {
        "عالي": "high", "عالية": "high", "high": "high", "مرتفع": "high", "مرتفعة": "high",
        "متوسط": "medium", "متوسطة": "medium", "medium": "medium",
        "منخفض": "low", "منخفضة": "low", "low": "low",
      };
      const priority = priorityMap[task.priority?.toLowerCase()] || "medium";

      // Create real task in the task system
      const [inserted] = await db.insert(tasks).values({
        title: task.task,
        description: `مهمة مستخرجة من اجتماع: ${meetingTitle}\nالمسؤول: ${task.assignee}\nالموعد: ${task.deadline || "غير محدد"}`,
        project: extractProjectHint(task.task) || meetingTitle,
        category: "meeting-task",
        owner: task.assignee,
        priority,
        status: "new",
        progress: 0,
        dueDate: task.deadline !== "غير محدد" && task.deadline !== "" ? task.deadline : undefined,
        source: "agent",
        sourceAgent: `meeting-${meetingId}`,
      });

      const taskId = inserted.insertId;

      results.push({
        taskId,
        taskTitle: task.task,
        assignee: task.assignee,
        agentKey,
        status: "created",
      });
    } catch (err) {
      console.error(`[MeetingTaskExecutor] Failed to create task: ${task.task}`, err);
      results.push({
        taskId: 0,
        taskTitle: task.task,
        assignee: task.assignee,
        agentKey: null,
        status: "failed",
        error: String(err),
      });
    }
  }

  return results;
}

/**
 * Execute tasks by sending them to the assigned agents
 * Each agent receives the task as a direct instruction and uses their tools to execute it
 */
export async function executeTasksByAgents(
  meetingId: number,
  userId: number,
  meetingTitle: string,
  taskResults: TaskExecutionResult[],
  meetingContext: string // transcript/summary for context
): Promise<TaskExecutionResult[]> {
  const db = await getDb();
  if (!db) return taskResults;

  const executionResults: TaskExecutionResult[] = [];

  for (const taskResult of taskResults) {
    if (taskResult.status !== "created" || !taskResult.agentKey) {
      executionResults.push(taskResult);
      continue;
    }

    try {
      // Update task status to executing
      if (taskResult.taskId > 0) {
        await db.update(tasks).set({
          status: "progress",
          progress: 10,
        }).where(eq(tasks.id, taskResult.taskId));
      }

      // Build execution instruction for the agent
      const executionPrompt = buildExecutionPrompt(taskResult, meetingTitle, meetingContext);

      // Send task to agent for execution
      const agentResponse = await handleAgentChat({
        agent: taskResult.agentKey,
        message: executionPrompt,
        userId,
        conversationHistory: [],
      });

      // Update task as completed
      if (taskResult.taskId > 0) {
        await db.update(tasks).set({
          status: "done",
          progress: 100,
        }).where(eq(tasks.id, taskResult.taskId));
      }

      // Log execution in meeting messages
      await db.insert(meetingMessages).values({
        meetingId,
        speakerId: taskResult.agentKey,
        speakerType: "agent",
        messageText: `✅ [تنفيذ مهمة] ${taskResult.taskTitle}\n\n${agentResponse.text}`,
      });

      executionResults.push({
        ...taskResult,
        status: "completed",
        result: agentResponse.text,
      });

    } catch (err) {
      console.error(`[MeetingTaskExecutor] Agent ${taskResult.agentKey} failed to execute: ${taskResult.taskTitle}`, err);
      
      // Mark task as failed
      if (taskResult.taskId > 0) {
        await db.update(tasks).set({
          status: "hold",
          progress: 0,
        }).where(eq(tasks.id, taskResult.taskId));
      }

      executionResults.push({
        ...taskResult,
        status: "failed",
        error: String(err),
      });
    }
  }

  return executionResults;
}

/**
 * Build a specific execution prompt for each agent based on their task
 */
function buildExecutionPrompt(
  taskResult: TaskExecutionResult,
  meetingTitle: string,
  meetingContext: string
): string {
  const basePrompt = `🎯 [أمر تنفيذي من اجتماع "${meetingTitle}"]

المهمة المطلوبة: ${taskResult.taskTitle}

تعليمات مهمة:
- هذه مهمة حقيقية يجب تنفيذها فعلياً الآن
- استخدم الأدوات المتاحة لك لتنفيذ المهمة
- لا تكتفِ بالوصف أو التوصيات - نفّذ المهمة فعلياً
- إذا كانت المهمة تتطلب تحديث بيانات في المنصة، استخدم الأدوات لتحديثها
- إذا كانت المهمة تتطلب مراجعة ملفات، قم بمراجعتها فعلياً
- أبلغ عن النتيجة بوضوح: ماذا فعلت بالضبط وما النتيجة

سياق الاجتماع (للمرجع):
${meetingContext.substring(0, 2000)}

نفّذ المهمة الآن وأبلغني بالنتيجة.`;

  return basePrompt;
}

/**
 * Send Telegram notification with execution report to owner
 */
export async function notifyOwnerViaTelegram(
  meetingTitle: string,
  results: TaskExecutionResult[]
): Promise<void> {
  const completed = results.filter(r => r.status === "completed");
  const failed = results.filter(r => r.status === "failed");
  
  let message = `🏢 *تقرير تنفيذ مهام الاجتماع*\n\n`;
  message += `📋 الاجتماع: ${meetingTitle}\n`;
  message += `📊 إجمالي المهام: ${results.length}\n`;
  message += `✅ تم تنفيذها: ${completed.length}\n`;
  if (failed.length > 0) message += `❌ فشلت: ${failed.length}\n`;
  message += `\n`;
  
  for (const r of completed) {
    message += `✅ ${r.taskTitle} (${r.assignee})\n`;
  }
  
  for (const r of failed) {
    message += `❌ ${r.taskTitle} (${r.assignee})\n`;
  }
  
  message += `\n💡 يمكنك مراجعة التفاصيل في لوحة متابعة الاجتماعات على المنصة.`;
  
  try {
    await sendNotificationToOwner(message, "Markdown");
    console.log("[MeetingTaskExecutor] Telegram notification sent successfully");
  } catch (err) {
    console.error("[MeetingTaskExecutor] Failed to send Telegram notification:", err);
  }
}

/**
 * Generate execution summary report
 */
export function generateExecutionReport(results: TaskExecutionResult[]): string {
  const completed = results.filter(r => r.status === "completed");
  const failed = results.filter(r => r.status === "failed");
  const created = results.filter(r => r.status === "created");

  let report = `📊 **تقرير تنفيذ مهام الاجتماع**\n\n`;
  report += `إجمالي المهام: ${results.length}\n`;
  report += `✅ تم تنفيذها: ${completed.length}\n`;
  report += `❌ فشلت: ${failed.length}\n`;
  report += `📋 في الانتظار: ${created.length}\n\n`;

  if (completed.length > 0) {
    report += `--- المهام المنفذة ---\n\n`;
    for (const r of completed) {
      report += `✅ **${r.taskTitle}** (${r.assignee})\n`;
      if (r.result) {
        // Truncate long results
        const shortResult = r.result.length > 300 ? r.result.substring(0, 300) + "..." : r.result;
        report += `   النتيجة: ${shortResult}\n\n`;
      }
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
