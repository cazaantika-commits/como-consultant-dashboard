import { Router, Request, Response } from "express";
import { getDb } from "./db";
import { tasks } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { eq, desc, and, sql } from "drizzle-orm";

/**
 * Agent API - REST endpoints for Qasim (أرشفة) and Salwa (تقييم) agents
 * 
 * Endpoints:
 * POST /api/agent/task          - Create a task directly
 * POST /api/agent/email-to-task - Parse email and create task(s) automatically
 * POST /api/agent/bulk-tasks    - Create multiple tasks at once
 * GET  /api/agent/tasks         - List tasks created by a specific agent
 * GET  /api/agent/activity      - Get agent activity log
 * POST /api/agent/notify        - Send notification to owner about agent activity
 */

const router = Router();

// Simple API key validation middleware
// Uses BUILT_IN_FORGE_API_KEY as the agent auth key
function validateAgentAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");
  if (!apiKey || token !== apiKey) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  next();
}

router.use(validateAgentAuth);

// ============================================================
// POST /api/agent/task - Create a single task from an agent
// ============================================================
router.post("/task", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const {
      title,
      description,
      project,
      category,
      owner,
      priority = "medium",
      dueDate,
      agentName,
      attachment,
    } = req.body;

    if (!title || !project || !owner || !agentName) {
      return res.status(400).json({
        error: "Missing required fields: title, project, owner, agentName",
      });
    }

    const result = await db.insert(tasks).values({
      title,
      description: description || null,
      project,
      category: category || null,
      owner,
      priority,
      status: "new",
      progress: 0,
      dueDate: dueDate || null,
      attachment: attachment || null,
      source: "agent",
      sourceAgent: agentName,
    });

    // Log the activity
    await logAgentActivity(db, agentName, "task_created", title, project);

    return res.json({
      success: true,
      taskId: result[0].insertId,
      message: `مهمة جديدة أنشأها ${agentName}: ${title}`,
    });
  } catch (e: any) {
    console.error("[AgentAPI] Create task error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ============================================================
// POST /api/agent/email-to-task - Parse email content and create tasks
// Uses LLM to analyze email and extract actionable tasks
// ============================================================
router.post("/email-to-task", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const { emailSubject, emailBody, emailFrom, emailDate, agentName } = req.body;

    if (!emailBody || !agentName) {
      return res.status(400).json({
        error: "Missing required fields: emailBody, agentName",
      });
    }

    // Use LLM to analyze the email and extract tasks
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `أنت مساعد ذكي لشركة كومو للتطوير العقاري (COMO Developments) في دبي.
مهمتك تحليل رسائل البريد الإلكتروني واستخراج المهام القابلة للتنفيذ منها.

المشاريع المعروفة:
- الجداف (Al Jaddaf)
- مجان (Majan Building)
- ند الشبا (Nad Al Sheba)
- الفلل (Villas / Nad Al Shiba Villas)
- المول (Mall)
- عام (General) - للمهام غير المرتبطة بمشروع محدد

المسؤولون المعروفون:
- عبدالرحمن (Abdalrahman) - المدير
- الشيخ عيسى (Sheikh Issa) - المالك
- أحمد (Ahmad) - مدير المشاريع

الفئات المتاحة:
- تصميم (Design)
- عقود (Contracts)
- تراخيص (Permits)
- مالية (Finance)
- أرشفة (Archiving)
- تقييم (Evaluation)
- اجتماعات (Meetings)
- متابعة (Follow-up)
- عام (General)

قم بتحليل البريد الإلكتروني واستخراج المهام. لكل مهمة حدد:
- title: عنوان المهمة بالعربية
- description: وصف مختصر
- project: اسم المشروع (من القائمة أعلاه)
- category: الفئة
- owner: المسؤول
- priority: high/medium/low
- dueDate: تاريخ الاستحقاق إن وجد (YYYY-MM-DD)

إذا لم يكن هناك مهام قابلة للتنفيذ، أرجع مصفوفة فارغة.`,
        },
        {
          role: "user",
          content: `من: ${emailFrom || "غير معروف"}
التاريخ: ${emailDate || "غير محدد"}
الموضوع: ${emailSubject || "بدون موضوع"}

المحتوى:
${emailBody}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_tasks",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "عنوان المهمة" },
                    description: { type: "string", description: "وصف المهمة" },
                    project: { type: "string", description: "اسم المشروع" },
                    category: { type: "string", description: "فئة المهمة" },
                    owner: { type: "string", description: "المسؤول" },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    dueDate: { type: "string", description: "تاريخ الاستحقاق YYYY-MM-DD أو فارغ" },
                  },
                  required: ["title", "description", "project", "category", "owner", "priority", "dueDate"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string", description: "ملخص البريد الإلكتروني" },
            },
            required: ["tasks", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      return res.status(500).json({ error: "LLM returned empty response" });
    }

    const parsed = JSON.parse(content);
    const createdTasks: any[] = [];

    for (const task of parsed.tasks) {
      const result = await db.insert(tasks).values({
        title: task.title,
        description: task.description || null,
        project: task.project,
        category: task.category || null,
        owner: task.owner,
        priority: task.priority || "medium",
        status: "new",
        progress: 0,
        dueDate: task.dueDate && task.dueDate !== "" ? task.dueDate : null,
        source: "agent",
        sourceAgent: agentName,
      });

      createdTasks.push({
        id: result[0].insertId,
        title: task.title,
        project: task.project,
        owner: task.owner,
        priority: task.priority,
      });
    }

    // Log activity
    await logAgentActivity(
      db,
      agentName,
      "email_parsed",
      `تحليل إيميل: ${emailSubject || "بدون موضوع"} → ${createdTasks.length} مهام`,
      undefined
    );

    // Notify owner if tasks were created
    if (createdTasks.length > 0) {
      const taskList = createdTasks
        .map((t) => `• ${t.title} (${t.project}) → ${t.owner}`)
        .join("\n");

      await notifyOwner({
        title: `${agentName} أنشأ ${createdTasks.length} مهام جديدة من بريد إلكتروني`,
        content: `الموضوع: ${emailSubject || "بدون موضوع"}\nمن: ${emailFrom || "غير معروف"}\n\nالمهام المنشأة:\n${taskList}\n\nالملخص: ${parsed.summary}`,
      }).catch(() => {});
    }

    return res.json({
      success: true,
      tasksCreated: createdTasks.length,
      tasks: createdTasks,
      summary: parsed.summary,
    });
  } catch (e: any) {
    console.error("[AgentAPI] Email-to-task error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ============================================================
// POST /api/agent/bulk-tasks - Create multiple tasks at once
// ============================================================
router.post("/bulk-tasks", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const { tasks: taskList, agentName } = req.body;

    if (!taskList || !Array.isArray(taskList) || !agentName) {
      return res.status(400).json({
        error: "Missing required fields: tasks (array), agentName",
      });
    }

    const createdIds: number[] = [];

    for (const task of taskList) {
      if (!task.title || !task.project || !task.owner) continue;

      const result = await db.insert(tasks).values({
        title: task.title,
        description: task.description || null,
        project: task.project,
        category: task.category || null,
        owner: task.owner,
        priority: task.priority || "medium",
        status: "new",
        progress: 0,
        dueDate: task.dueDate || null,
        attachment: task.attachment || null,
        source: "agent",
        sourceAgent: agentName,
      });

      createdIds.push(result[0].insertId);
    }

    await logAgentActivity(
      db,
      agentName,
      "bulk_tasks_created",
      `إنشاء ${createdIds.length} مهام دفعة واحدة`,
      undefined
    );

    return res.json({
      success: true,
      tasksCreated: createdIds.length,
      taskIds: createdIds,
    });
  } catch (e: any) {
    console.error("[AgentAPI] Bulk tasks error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GET /api/agent/tasks?agentName=xxx - List tasks by agent
// ============================================================
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const agentName = req.query.agentName as string;

    let result;
    if (agentName) {
      result = await db
        .select()
        .from(tasks)
        .where(
          and(eq(tasks.source, "agent"), eq(tasks.sourceAgent, agentName))
        )
        .orderBy(desc(tasks.createdAt));
    } else {
      result = await db
        .select()
        .from(tasks)
        .where(eq(tasks.source, "agent"))
        .orderBy(desc(tasks.createdAt));
    }

    return res.json({ tasks: result, count: result.length });
  } catch (e: any) {
    console.error("[AgentAPI] List tasks error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GET /api/agent/activity?agentName=xxx - Get agent activity log
// ============================================================
router.get("/activity", async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database not available" });

    const agentName = req.query.agentName as string;

    let result;
    if (agentName) {
      result = await db.execute(
        sql`SELECT * FROM agentActivityLog WHERE agentName = ${agentName} ORDER BY createdAt DESC LIMIT 100`
      );
    } else {
      result = await db.execute(
        sql`SELECT * FROM agentActivityLog ORDER BY createdAt DESC LIMIT 100`
      );
    }

    const rows = result[0] as unknown as any[];
    return res.json({ activities: rows || [], count: rows?.length || 0 });
  } catch (e: any) {
    console.error("[AgentAPI] Activity log error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ============================================================
// POST /api/agent/notify - Send notification to owner
// ============================================================
router.post("/notify", async (req: Request, res: Response) => {
  try {
    const { title, content, agentName } = req.body;

    if (!title || !content || !agentName) {
      return res.status(400).json({
        error: "Missing required fields: title, content, agentName",
      });
    }

    const sent = await notifyOwner({
      title: `[${agentName}] ${title}`,
      content,
    });

    return res.json({ success: sent });
  } catch (e: any) {
    console.error("[AgentAPI] Notify error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// ============================================================
// Helper: Log agent activity
// ============================================================
async function logAgentActivity(
  db: any,
  agentName: string,
  action: string,
  details: string,
  project?: string
) {
  try {
    await db.execute(
      sql`INSERT INTO agentActivityLog (agentName, action, details, project) VALUES (${agentName}, ${action}, ${details}, ${project || null})`
    );
  } catch (e) {
    // If table doesn't exist yet, create it
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS agentActivityLog (
          id INT AUTO_INCREMENT PRIMARY KEY,
          agentName VARCHAR(255) NOT NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          project VARCHAR(255),
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.execute(
        sql`INSERT INTO agentActivityLog (agentName, action, details, project) VALUES (${agentName}, ${action}, ${details}, ${project || null})`
      );
    } catch (e2) {
      console.warn("[AgentAPI] Failed to log activity:", e2);
    }
  }
}

export default router;
