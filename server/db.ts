import { eq, and, inArray, or, like, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, InsertProject, consultants, InsertConsultant, projectConsultants, InsertProjectConsultant, financialData, InsertFinancialData, evaluationScores, InsertEvaluationScore, evaluatorScores, InsertEvaluatorScore, committeeDecisions, InsertCommitteeDecision, consultantDetails, InsertConsultantDetail, aiAdvisoryScores, InsertAiAdvisoryScore } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Projects queries
export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(projects).where(eq(projects.userId, userId));
}

export async function getProjectById(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return result.length > 0 && result[0].userId === userId ? result[0] : null;
}

export async function createProject(userId: number, data: Omit<InsertProject, 'userId'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(projects).values({ ...data, userId } as InsertProject);
  return result;
}

export async function updateProject(projectId: number, userId: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const project = await getProjectById(projectId, userId);
  if (!project) throw new Error('Project not found');
  return await db.update(projects).set(data).where(eq(projects.id, projectId));
}

export async function deleteProject(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const project = await getProjectById(projectId, userId);
  if (!project) throw new Error('Project not found');
  return await db.delete(projects).where(eq(projects.id, projectId));
}

// Consultants queries
export async function getUserConsultants(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(consultants).where(eq(consultants.userId, userId));
}

export async function createConsultant(userId: number, data: Omit<InsertConsultant, 'userId'>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return await db.insert(consultants).values({ ...data, userId } as InsertConsultant);
}

export async function deleteConsultant(consultantId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const consultant = await db.select().from(consultants)
    .where(eq(consultants.id, consultantId))
    .limit(1);
  if (consultant.length === 0 || consultant[0].userId !== userId) {
    throw new Error('Consultant not found');
  }
  return await db.delete(consultants).where(eq(consultants.id, consultantId));
}

// Project-Consultant relationship
export async function getProjectConsultants(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const relations = await db.select().from(projectConsultants).where(eq(projectConsultants.projectId, projectId));
  const consultantIds = relations.map(r => r.consultantId);
  if (consultantIds.length === 0) return [];
  return await db.select().from(consultants).where(inArray(consultants.id, consultantIds));
}

export async function addConsultantToProject(projectId: number, consultantId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return await db.insert(projectConsultants).values({ projectId, consultantId });
}

export async function removeConsultantFromProject(projectId: number, consultantId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return await db.delete(projectConsultants)
    .where(and(eq(projectConsultants.projectId, projectId), eq(projectConsultants.consultantId, consultantId)));
}

// Financial data
export async function getProjectFinancialData(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(financialData).where(eq(financialData.projectId, projectId));
}

export async function upsertFinancialData(projectId: number, consultantId: number, data: Partial<InsertFinancialData>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(financialData)
    .where(and(eq(financialData.projectId, projectId), eq(financialData.consultantId, consultantId)))
    .limit(1);
  if (existing.length > 0) {
    return await db.update(financialData).set(data)
      .where(and(eq(financialData.projectId, projectId), eq(financialData.consultantId, consultantId)));
  }
  return await db.insert(financialData).values({ projectId, consultantId, ...data });
}

// Evaluation scores
export async function getProjectEvaluationScores(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(evaluationScores).where(eq(evaluationScores.projectId, projectId));
}

export async function upsertEvaluationScore(projectId: number, consultantId: number, criterionId: number, score: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(evaluationScores)
    .where(and(eq(evaluationScores.projectId, projectId), eq(evaluationScores.consultantId, consultantId), eq(evaluationScores.criterionId, criterionId)))
    .limit(1);
  if (existing.length > 0) {
    return await db.update(evaluationScores).set({ score })
      .where(and(eq(evaluationScores.projectId, projectId), eq(evaluationScores.consultantId, consultantId), eq(evaluationScores.criterionId, criterionId)));
  }
  return await db.insert(evaluationScores).values({ projectId, consultantId, criterionId, score });
}

// Evaluator scores (3-evaluator system)
export async function getProjectEvaluatorScores(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(evaluatorScores).where(eq(evaluatorScores.projectId, projectId));
}

export async function upsertEvaluatorScore(projectId: number, consultantId: number, criterionId: number, evaluatorName: string, score: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(evaluatorScores)
    .where(and(
      eq(evaluatorScores.projectId, projectId),
      eq(evaluatorScores.consultantId, consultantId),
      eq(evaluatorScores.criterionId, criterionId),
      eq(evaluatorScores.evaluatorName, evaluatorName)
    ))
    .limit(1);
  if (existing.length > 0) {
    return await db.update(evaluatorScores).set({ score })
      .where(and(
        eq(evaluatorScores.projectId, projectId),
        eq(evaluatorScores.consultantId, consultantId),
        eq(evaluatorScores.criterionId, criterionId),
        eq(evaluatorScores.evaluatorName, evaluatorName)
      ));
  }
  return await db.insert(evaluatorScores).values({ projectId, consultantId, criterionId, evaluatorName, score });
}

// Committee decisions
export async function getCommitteeDecision(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(committeeDecisions).where(eq(committeeDecisions.projectId, projectId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertCommitteeDecision(projectId: number, data: Partial<InsertCommitteeDecision>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(committeeDecisions).where(eq(committeeDecisions.projectId, projectId)).limit(1);
  if (existing.length > 0) {
    return await db.update(committeeDecisions).set(data).where(eq(committeeDecisions.projectId, projectId));
  }
  return await db.insert(committeeDecisions).values({ projectId, ...data } as InsertCommitteeDecision);
}

// AI Advisory Scores
export async function getAiAdvisoryScores(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(aiAdvisoryScores).where(eq(aiAdvisoryScores.projectId, projectId));
}

export async function upsertAiAdvisoryScore(data: { projectId: number; consultantId: number; criterionId: number; suggestedScore: number; reasoning: string }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(aiAdvisoryScores).where(
    and(
      eq(aiAdvisoryScores.projectId, data.projectId),
      eq(aiAdvisoryScores.consultantId, data.consultantId),
      eq(aiAdvisoryScores.criterionId, data.criterionId)
    )
  ).limit(1);
  if (existing.length > 0) {
    return await db.update(aiAdvisoryScores).set({ suggestedScore: data.suggestedScore, reasoning: data.reasoning }).where(eq(aiAdvisoryScores.id, existing[0].id));
  }
  return await db.insert(aiAdvisoryScores).values(data as InsertAiAdvisoryScore);
}

// Consultant details
export async function getConsultantDetail(consultantId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(consultantDetails).where(eq(consultantDetails.consultantId, consultantId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllConsultantDetails() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(consultantDetails);
}

export async function upsertConsultantDetail(consultantId: number, data: Partial<InsertConsultantDetail>) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(consultantDetails).where(eq(consultantDetails.consultantId, consultantId)).limit(1);
  if (existing.length > 0) {
    return await db.update(consultantDetails).set(data).where(eq(consultantDetails.consultantId, consultantId));
  }
  return await db.insert(consultantDetails).values({ consultantId, ...data } as InsertConsultantDetail);
}

// Get all projects (no user filter - for portal)
export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(projects);
}

// Get all consultants (no user filter - for portal)
export async function getAllConsultants() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(consultants);
}

// ==================== Knowledge Base Queries ====================

export async function createKnowledgeItem(data: {
  userId: number;
  type: 'decision' | 'evaluation' | 'pattern' | 'insight' | 'lesson';
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  relatedProjectId?: number;
  relatedConsultantId?: number;
  relatedAgentAssignmentId?: number;
  sourceAgent?: string;
  importance?: 'low' | 'medium' | 'high' | 'critical';
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { knowledgeBase } = await import("../drizzle/schema");
  
  const result = await db.insert(knowledgeBase).values({
    userId: data.userId,
    type: data.type,
    title: data.title,
    content: data.content,
    summary: data.summary,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    relatedProjectId: data.relatedProjectId,
    relatedConsultantId: data.relatedConsultantId,
    relatedAgentAssignmentId: data.relatedAgentAssignmentId,
    sourceAgent: data.sourceAgent,
    importance: data.importance || 'medium',
    viewCount: 0,
  });
  
  return result;
}

export async function getKnowledgeItems(userId: number, filters?: {
  type?: string;
  importance?: string;
  sourceAgent?: string;
  search?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const { knowledgeBase } = await import("../drizzle/schema");
  
  let query = db.select().from(knowledgeBase).where(eq(knowledgeBase.userId, userId));
  
  // Apply filters if provided
  // Note: This is a simplified version. For complex filtering, use drizzle's query builder more extensively
  
  const results = await query.orderBy(desc(knowledgeBase.createdAt)).limit(filters?.limit || 100);
  
  // Parse tags from JSON
  return results.map(item => ({
    ...item,
    tags: item.tags ? JSON.parse(item.tags) : [],
  }));
}

export async function getKnowledgeItemById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { knowledgeBase } = await import("../drizzle/schema");
  
  const result = await db.select().from(knowledgeBase)
    .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.userId, userId)))
    .limit(1);
  
  if (result.length === 0) return null;
  
  // Increment view count
  await db.update(knowledgeBase)
    .set({ viewCount: (result[0].viewCount || 0) + 1 })
    .where(eq(knowledgeBase.id, id));
  
  return {
    ...result[0],
    tags: result[0].tags ? JSON.parse(result[0].tags) : [],
  };
}

export async function searchKnowledgeBase(userId: number, searchTerm: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const { knowledgeBase } = await import("../drizzle/schema");
  
  // Search in title, content, and summary
  const results = await db.select().from(knowledgeBase)
    .where(
      and(
        eq(knowledgeBase.userId, userId),
        or(
          like(knowledgeBase.title, `%${searchTerm}%`),
          like(knowledgeBase.content, `%${searchTerm}%`),
          like(knowledgeBase.summary, `%${searchTerm}%`)
        )
      )
    )
    .orderBy(desc(knowledgeBase.createdAt))
    .limit(limit);
  
  return results.map(item => ({
    ...item,
    tags: item.tags ? JSON.parse(item.tags) : [],
  }));
}

// ==================== Consultant Proposals Queries ====================

export async function createProposal(data: {
  userId: number;
  consultantId?: number;
  projectId?: number;
  title: string;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { consultantProposals } = await import("../drizzle/schema");
  
  const result = await db.insert(consultantProposals).values({
    userId: data.userId,
    consultantId: data.consultantId,
    projectId: data.projectId,
    title: data.title,
    fileUrl: data.fileUrl,
    fileKey: data.fileKey,
    fileName: data.fileName,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    analysisStatus: 'pending',
  });
  
  return result;
}

export async function getProposals(userId: number, filters?: {
  consultantId?: number;
  projectId?: number;
  analysisStatus?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const { consultantProposals } = await import("../drizzle/schema");
  
  let conditions = [eq(consultantProposals.userId, userId)];
  
  if (filters?.consultantId) {
    conditions.push(eq(consultantProposals.consultantId, filters.consultantId));
  }
  if (filters?.projectId) {
    conditions.push(eq(consultantProposals.projectId, filters.projectId));
  }
  
  const results = await db.select().from(consultantProposals)
    .where(and(...conditions))
    .orderBy(desc(consultantProposals.createdAt));
  
  return results;
}

export async function getProposalById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { consultantProposals } = await import("../drizzle/schema");
  
  const result = await db.select().from(consultantProposals)
    .where(and(eq(consultantProposals.id, id), eq(consultantProposals.userId, userId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateProposalAnalysis(id: number, userId: number, analysis: Record<string, any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { consultantProposals } = await import("../drizzle/schema");
  
  // Build update object dynamically - only set fields that are provided
  const updateData: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    aiSummary: 'aiSummary',
    aiKeyPoints: 'aiKeyPoints',
    aiStrengths: 'aiStrengths',
    aiWeaknesses: 'aiWeaknesses',
    aiRecommendation: 'aiRecommendation',
    aiScore: 'aiScore',
    aiScope: 'aiScope',
    aiExclusions: 'aiExclusions',
    aiAdditionalWorks: 'aiAdditionalWorks',
    aiSupervisionTerms: 'aiSupervisionTerms',
    aiTimeline: 'aiTimeline',
    aiPaymentTerms: 'aiPaymentTerms',
    aiConditions: 'aiConditions',
    aiTeamComposition: 'aiTeamComposition',
    aiDeliverables: 'aiDeliverables',
    extractedText: 'extractedText',
    analysisStatus: 'analysisStatus',
    analysisError: 'analysisError',
  };
  
  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (key in analysis && analysis[key] !== undefined) {
      updateData[dbField] = analysis[key];
    }
  }
  
  await db.update(consultantProposals)
    .set(updateData)
    .where(and(eq(consultantProposals.id, id), eq(consultantProposals.userId, userId)));
}

// ==================== Proposal Comparisons Queries ====================

export async function createComparison(data: {
  userId: number;
  projectId?: number;
  title: string;
  proposalIds: number[];
  comparisonResult?: any;
  aiRecommendation?: string;
  winnerProposalId?: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { proposalComparisons } = await import("../drizzle/schema");
  
  const result = await db.insert(proposalComparisons).values({
    userId: data.userId,
    projectId: data.projectId,
    title: data.title,
    proposalIds: JSON.stringify(data.proposalIds),
    comparisonResult: data.comparisonResult ? JSON.stringify(data.comparisonResult) : null,
    aiRecommendation: data.aiRecommendation,
    winnerProposalId: data.winnerProposalId,
    notes: data.notes,
  });
  
  return result;
}

export async function getComparisons(userId: number, projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { proposalComparisons } = await import("../drizzle/schema");
  
  let conditions = [eq(proposalComparisons.userId, userId)];
  
  if (projectId) {
    conditions.push(eq(proposalComparisons.projectId, projectId));
  }
  
  const results = await db.select().from(proposalComparisons)
    .where(and(...conditions))
    .orderBy(desc(proposalComparisons.createdAt));
  
  return results.map(item => ({
    ...item,
    proposalIds: JSON.parse(item.proposalIds),
    comparisonResult: item.comparisonResult ? JSON.parse(item.comparisonResult) : null,
  }));
}

export async function getComparisonById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { proposalComparisons } = await import("../drizzle/schema");
  
  const result = await db.select().from(proposalComparisons)
    .where(and(eq(proposalComparisons.id, id), eq(proposalComparisons.userId, userId)))
    .limit(1);
  
  if (result.length === 0) return null;
  
  return {
    ...result[0],
    proposalIds: JSON.parse(result[0].proposalIds),
    comparisonResult: result[0].comparisonResult ? JSON.parse(result[0].comparisonResult) : null,
  };
}


// ═══════════════════════════════════════════════════
// Sent Emails Log - سجل الإيميلات المرسلة
// ═══════════════════════════════════════════════════

import { sentEmails, InsertSentEmail } from "../drizzle/schema";

export async function logSentEmail(data: InsertSentEmail) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(sentEmails).values(data);
  return result[0].insertId;
}

export async function getSentEmails(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(sentEmails)
    .where(eq(sentEmails.userId, userId))
    .orderBy(desc(sentEmails.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getSentEmailsCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(sentEmails)
    .where(eq(sentEmails.userId, userId));
  return result[0]?.count || 0;
}

export async function getSentEmailById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select()
    .from(sentEmails)
    .where(and(eq(sentEmails.id, id), eq(sentEmails.userId, userId)))
    .limit(1);
  return result[0] || null;
}
