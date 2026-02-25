/**
 * Activity Logger - سجل نشاط الوكلاء الشامل
 * 
 * يسجل كل عملية يقوم بها أي وكيل: أداة استُخدمت، نتيجة، وقت، سبب
 * يوفر شفافية كاملة لمراقبة أداء الوكلاء
 */

import { getDb } from "./db";
import { agentActivityLog } from "../drizzle/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";

export type ActionType = 
  | 'tool_call' | 'chat_response' | 'file_read' | 'file_write'
  | 'db_read' | 'db_write' | 'email_action' | 'drive_action'
  | 'agent_comm' | 'task_execution' | 'meeting_action' | 'analysis' | 'error';

export type ActivityStatus = 'success' | 'failure' | 'partial' | 'pending';

interface LogActivityParams {
  agentName: string;
  agentModel?: string;
  actionType: ActionType;
  toolName?: string;
  inputSummary?: string;
  outputSummary?: string;
  fullInput?: any;
  fullOutput?: any;
  status: ActivityStatus;
  errorMessage?: string;
  errorDetails?: string;
  triggerSource?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  userId?: number;
  durationMs?: number;
  tokensUsed?: number;
}

/**
 * تسجيل نشاط وكيل في السجل
 * يُستخدم تلقائياً عند كل استدعاء أداة
 */
export async function logActivity(params: LogActivityParams): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const [result] = await db.insert(agentActivityLog).values({
      agentName: params.agentName,
      agentModel: params.agentModel || null,
      actionType: params.actionType,
      toolName: params.toolName || null,
      inputSummary: params.inputSummary ? params.inputSummary.substring(0, 500) : null,
      outputSummary: params.outputSummary ? params.outputSummary.substring(0, 500) : null,
      fullInput: params.fullInput ? JSON.stringify(params.fullInput).substring(0, 50000) : null,
      fullOutput: params.fullOutput ? JSON.stringify(params.fullOutput).substring(0, 50000) : null,
      status: params.status,
      errorMessage: params.errorMessage || null,
      errorDetails: params.errorDetails || null,
      triggerSource: params.triggerSource || 'chat',
      relatedEntityType: params.relatedEntityType || null,
      relatedEntityId: params.relatedEntityId || null,
      userId: params.userId || null,
      durationMs: params.durationMs || null,
      tokensUsed: params.tokensUsed || null,
    });

    return result.insertId;
  } catch (err) {
    console.error("[ActivityLogger] Failed to log activity:", err);
    return null;
  }
}

/**
 * تسجيل استدعاء أداة مع قياس الوقت
 * يُغلف أي دالة أداة ويسجل المدخلات والمخرجات والوقت والنتيجة
 */
export async function logToolCall(
  agentName: string,
  toolName: string,
  args: Record<string, any>,
  executeFn: () => Promise<string>,
  userId?: number,
  triggerSource?: string
): Promise<string> {
  const startTime = Date.now();
  let result: string;
  let status: ActivityStatus = 'success';
  let errorMessage: string | undefined;

  // Determine action type from tool name
  const actionType = categorizeToolAction(toolName);

  try {
    result = await executeFn();
    
    // Check if result contains error
    try {
      const parsed = JSON.parse(result);
      if (parsed.error) {
        status = 'failure';
        errorMessage = parsed.error;
      }
    } catch {
      // Not JSON, that's fine
    }
  } catch (err: any) {
    status = 'failure';
    errorMessage = err.message;
    result = JSON.stringify({ error: `خطأ في تنفيذ الأداة: ${err.message}` });
    
    // Log error with stack trace
    await logActivity({
      agentName,
      actionType: 'error',
      toolName,
      inputSummary: `${toolName}(${JSON.stringify(args).substring(0, 200)})`,
      outputSummary: errorMessage,
      fullInput: args,
      status: 'failure',
      errorMessage,
      errorDetails: err.stack,
      userId,
      triggerSource,
      durationMs: Date.now() - startTime,
    });
    
    return result;
  }

  const durationMs = Date.now() - startTime;

  // Log the activity asynchronously (don't block the response)
  logActivity({
    agentName,
    actionType,
    toolName,
    inputSummary: `${toolName}(${JSON.stringify(args).substring(0, 300)})`,
    outputSummary: result.substring(0, 500),
    fullInput: args,
    fullOutput: result.length > 50000 ? result.substring(0, 50000) + '...[truncated]' : result,
    status,
    errorMessage,
    userId,
    triggerSource,
    durationMs,
  }).catch(err => console.error("[ActivityLogger] Async log failed:", err));

  return result;
}

/**
 * تصنيف نوع العملية من اسم الأداة
 */
function categorizeToolAction(toolName: string): ActionType {
  if (toolName.includes('email') || toolName === 'check_email' || toolName === 'read_email' || toolName === 'reply_email' || toolName === 'compose_email' || toolName === 'download_email_attachments') {
    return 'email_action';
  }
  if (toolName.includes('drive') || toolName.includes('upload_text_file')) {
    return toolName.includes('read') || toolName.includes('list') || toolName.includes('search') || toolName.includes('get') 
      ? 'file_read' : 'file_write';
  }
  if (toolName === 'ask_another_agent' || toolName === 'view_agent_conversations') {
    return 'agent_comm';
  }
  if (toolName.includes('meeting')) {
    return 'meeting_action';
  }
  if (toolName.includes('task')) {
    return 'task_execution';
  }
  if (toolName.startsWith('list_') || toolName.startsWith('get_') || toolName === 'search_all_data' || toolName === 'query_institutional_memory') {
    return 'db_read';
  }
  if (toolName.startsWith('add_') || toolName.startsWith('set_') || toolName.startsWith('update_') || toolName.startsWith('save_') || toolName.startsWith('create_')) {
    return 'db_write';
  }
  if (toolName.includes('search_indexed_documents') || toolName.includes('get_document_content') || toolName.includes('search_knowledge')) {
    return 'analysis';
  }
  return 'tool_call';
}

/**
 * جلب سجل النشاط مع فلاتر
 */
export async function getActivityLog(filters: {
  agentName?: string;
  actionType?: ActionType;
  status?: ActivityStatus;
  userId?: number;
  limit?: number;
  offset?: number;
  since?: Date;
}) {
  const db = await getDb();
  if (!db) return { activities: [], total: 0 };

  const conditions: any[] = [];
  
  if (filters.agentName) {
    conditions.push(eq(agentActivityLog.agentName, filters.agentName));
  }
  if (filters.actionType) {
    conditions.push(eq(agentActivityLog.actionType, filters.actionType));
  }
  if (filters.status) {
    conditions.push(eq(agentActivityLog.status, filters.status));
  }
  if (filters.userId) {
    conditions.push(eq(agentActivityLog.userId, filters.userId));
  }
  if (filters.since) {
    conditions.push(gte(agentActivityLog.createdAt, filters.since));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const activities = await db.select()
    .from(agentActivityLog)
    .where(whereClause)
    .orderBy(desc(agentActivityLog.createdAt))
    .limit(filters.limit || 50)
    .offset(filters.offset || 0);

  // Get total count
  const [countResult] = await db.select({ count: sql<number>`count(*)` })
    .from(agentActivityLog)
    .where(whereClause);

  return {
    activities,
    total: countResult?.count || 0,
  };
}

/**
 * إحصائيات النشاط لكل وكيل
 */
export async function getAgentStats(since?: Date) {
  const db = await getDb();
  if (!db) return [];

  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24h

  const stats = await db.select({
    agentName: agentActivityLog.agentName,
    totalActions: sql<number>`count(*)`,
    successCount: sql<number>`SUM(CASE WHEN ${agentActivityLog.status} = 'success' THEN 1 ELSE 0 END)`,
    failureCount: sql<number>`SUM(CASE WHEN ${agentActivityLog.status} = 'failure' THEN 1 ELSE 0 END)`,
    avgDurationMs: sql<number>`AVG(${agentActivityLog.durationMs})`,
    lastActivity: sql<Date>`MAX(${agentActivityLog.createdAt})`,
  })
    .from(agentActivityLog)
    .where(gte(agentActivityLog.createdAt, sinceDate))
    .groupBy(agentActivityLog.agentName);

  return stats;
}

/**
 * آخر أنشطة وكيل معين
 */
export async function getRecentAgentActivity(agentName: string, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: agentActivityLog.id,
    actionType: agentActivityLog.actionType,
    toolName: agentActivityLog.toolName,
    inputSummary: agentActivityLog.inputSummary,
    outputSummary: agentActivityLog.outputSummary,
    status: agentActivityLog.status,
    errorMessage: agentActivityLog.errorMessage,
    durationMs: agentActivityLog.durationMs,
    createdAt: agentActivityLog.createdAt,
  })
    .from(agentActivityLog)
    .where(eq(agentActivityLog.agentName, agentName))
    .orderBy(desc(agentActivityLog.createdAt))
    .limit(limit);
}
