import { eq, and, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, InsertProject, consultants, InsertConsultant, projectConsultants, InsertProjectConsultant, financialData, InsertFinancialData, evaluationScores, InsertEvaluationScore, evaluatorScores, InsertEvaluatorScore, committeeDecisions, InsertCommitteeDecision, consultantDetails, InsertConsultantDetail } from "../drizzle/schema";
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
