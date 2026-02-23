import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Projects table
export const projects = mysqlTable('projects', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  plotNumber: varchar('plotNumber', { length: 50 }), // رقم القطعة مثل 6185392
  areaCode: varchar('areaCode', { length: 50 }), // كود المنطقة مثل Nas-R, Maj-M, Jadaf
  driveFolderId: varchar('driveFolderId', { length: 100 }), // معرف مجلد المشروع في Google Drive
  bua: int('bua'), // Building area in sqft
  pricePerSqft: int('pricePerSqft'), // Price per square foot in AED
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// Consultants table
export const consultants = mysqlTable('consultants', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 20 }),
  specialization: varchar('specialization', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Consultant = typeof consultants.$inferSelect;
export type InsertConsultant = typeof consultants.$inferInsert;

// Project-Consultant relationship
export const projectConsultants = mysqlTable('projectConsultants', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type ProjectConsultant = typeof projectConsultants.$inferSelect;
export type InsertProjectConsultant = typeof projectConsultants.$inferInsert;

// Financial data for consultant in project
export const financialData = mysqlTable('financialData', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  designType: varchar('designType', { length: 20 }).default('pct'), // 'pct' or 'lump'
  designValue: int('designValue'),
  supervisionType: varchar('supervisionType', { length: 20 }).default('pct'), // 'pct' or 'lump'
  supervisionValue: int('supervisionValue'),
  proposalLink: varchar('proposalLink', { length: 500 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type FinancialData = typeof financialData.$inferSelect;
export type InsertFinancialData = typeof financialData.$inferInsert;

// Evaluation scores for consultant in project
export const evaluationScores = mysqlTable('evaluationScores', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  criterionId: int('criterionId').notNull(), // 0-5 for the 6 criteria
  score: int('score'), // Score value
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type EvaluationScore = typeof evaluationScores.$inferSelect;
export type InsertEvaluationScore = typeof evaluationScores.$inferInsert;

// Consultant profiles - detailed info
export const consultantProfiles = mysqlTable('consultantProfiles', {
  id: int('id').autoincrement().primaryKey(),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }).unique(),
  companyNameAr: varchar('companyNameAr', { length: 255 }),
  founded: varchar('founded', { length: 50 }),
  headquarters: varchar('headquarters', { length: 255 }),
  website: varchar('website', { length: 500 }),
  employeeCount: varchar('employeeCount', { length: 100 }),
  specializations: text('specializations'), // comma-separated or JSON
  keyProjects: text('keyProjects'), // JSON array of notable projects
  certifications: text('certifications'), // ISO, LEED, etc.
  overview: text('overview'), // general description
  strengths: text('strengths'),
  weaknesses: text('weaknesses'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ConsultantProfile = typeof consultantProfiles.$inferSelect;
export type InsertConsultantProfile = typeof consultantProfiles.$inferInsert;

// Private notes on consultants
export const consultantNotes = mysqlTable('consultantNotes', {
  id: int('id').autoincrement().primaryKey(),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  userId: int('userId').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }),
  content: text('content').notNull(),
  category: varchar('category', { length: 100 }), // e.g. 'meeting', 'feedback', 'general'
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ConsultantNote = typeof consultantNotes.$inferSelect;
export type InsertConsultantNote = typeof consultantNotes.$inferInsert;
// Tasks table for project task management
export const tasks = mysqlTable('tasks', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  project: varchar('project', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  owner: varchar('owner', { length: 255 }).notNull(),
  priority: mysqlEnum('priority', ['high', 'medium', 'low']).default('medium').notNull(),
  status: mysqlEnum('status', ['new', 'progress', 'hold', 'done', 'cancelled']).default('new').notNull(),
  progress: int('progress').default(0).notNull(),
  dueDate: varchar('dueDate', { length: 20 }),
  attachment: text('attachment'),
  source: mysqlEnum('source', ['manual', 'agent', 'command']).default('manual').notNull(),
  sourceAgent: varchar('sourceAgent', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// AI Agents table - الوكلاء الذكيون
export const agents = mysqlTable('agents', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  nameEn: varchar('nameEn', { length: 100 }),
  role: varchar('role', { length: 255 }).notNull(),
  roleEn: varchar('roleEn', { length: 255 }),
  description: text('description'),
  color: varchar('color', { length: 20 }),
  icon: varchar('icon', { length: 50 }),
  status: mysqlEnum('agentStatus', ['active', 'inactive', 'maintenance']).default('active').notNull(),
  capabilities: text('capabilities'), // JSON array of capabilities
  isCoordinator: int('isCoordinator').default(0).notNull(), // 1 for سلوى
  gender: mysqlEnum('gender', ['male', 'female']).default('male').notNull(),
  avatarUrl: text('avatarUrl'),
  age: int('age'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

// Feasibility Studies table - دراسة الجدوى المالية
export const feasibilityStudies = mysqlTable('feasibilityStudies', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  // Project identification
  projectName: varchar('projectName', { length: 500 }).notNull(), // المنطقة _ الوصف _ رقم القطعة
  community: varchar('community', { length: 255 }), // المنطقة
  plotNumber: varchar('plotNumber', { length: 100 }), // رقم القطعة
  projectDescription: varchar('projectDescription', { length: 255 }), // وصف المشروع مثل G+2P+6
  landUse: varchar('landUse', { length: 255 }), // الاستعمال
  // Areas (stored in sqft)
  plotArea: int('plotArea'), // مساحة الأرض بالقدم²
  plotAreaM2: int('plotAreaM2'), // مساحة الأرض بالمتر²
  gfaResidential: int('gfaResidential'), // GFA سكني بالقدم²
  gfaRetail: int('gfaRetail'), // GFA تجاري بالقدم²
  gfaOffices: int('gfaOffices'), // GFA مكاتب بالقدم²
  totalGfa: int('totalGfa'), // إجمالي GFA بالقدم²
  saleableResidentialPct: int('saleableResidentialPct').default(90), // نسبة المساحة القابلة للبيع سكني
  saleableRetailPct: int('saleableRetailPct').default(99), // نسبة المساحة القابلة للبيع تجاري
  saleableOfficesPct: int('saleableOfficesPct').default(90), // نسبة المساحة القابلة للبيع مكاتب
  estimatedBua: int('estimatedBua'), // مساحة البناء التقديرية بالقدم²
  numberOfUnits: int('numberOfUnits'), // عدد الوحدات
  // Costs - User inputs
  landPrice: int('landPrice'), // سعر الأرض
  agentCommissionLandPct: int('agentCommissionLandPct').default(1), // عمولة وسيط الأرض %
  soilInvestigation: int('soilInvestigation'), // فحص التربة
  topographySurvey: int('topographySurvey'), // المسح الطبوغرافي
  authoritiesFee: int('authoritiesFee'), // رسوم الجهات الحكومية
  constructionCostPerSqft: int('constructionCostPerSqft'), // تكلفة البناء لكل قدم²
  communityFee: int('communityFee'), // رسوم المجتمع
  // Percentages (stored as whole numbers, e.g., 2 = 2%)
  designFeePct: int('designFeePct').default(2), // أتعاب التصميم %
  supervisionFeePct: int('supervisionFeePct').default(2), // أتعاب الإشراف % (1.75 stored as 175 /100)
  separationFeePerM2: int('separationFeePerM2').default(40), // رسوم الفصل لكل م²
  contingenciesPct: int('contingenciesPct').default(2), // احتياطي %
  developerFeePct: int('developerFeePct').default(5), // أتعاب المطور %
  agentCommissionSalePct: int('agentCommissionSalePct').default(5), // عمولة البيع %
  marketingPct: int('marketingPct').default(2), // تسويق %
  // Fixed fees
  reraOffplanFee: int('reraOffplanFee').default(150000),
  reraUnitFee: int('reraUnitFee').default(850), // per unit
  nocFee: int('nocFee').default(10000),
  escrowFee: int('escrowFee').default(140000),
  bankCharges: int('bankCharges').default(20000),
  surveyorFees: int('surveyorFees').default(12000),
  reraAuditFees: int('reraAuditFees').default(18000),
  reraInspectionFees: int('reraInspectionFees').default(70000),
  // Sale prices per sqft
  residentialSalePrice: int('residentialSalePrice'), // سعر بيع القدم² سكني
  retailSalePrice: int('retailSalePrice'), // سعر بيع القدم² تجاري
  officesSalePrice: int('officesSalePrice'), // سعر بيع القدم² مكاتب
  // COMO profit share
  comoProfitSharePct: int('comoProfitSharePct').default(15), // حصة COMO من الربح %
  // Notes
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type FeasibilityStudy = typeof feasibilityStudies.$inferSelect;
export type InsertFeasibilityStudy = typeof feasibilityStudies.$inferInsert;

// Evaluator scores - 3 evaluators per project/consultant/criterion
export const evaluatorScores = mysqlTable('evaluatorScores', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  criterionId: int('criterionId').notNull(), // 0-5 for the 6 criteria
  evaluatorName: varchar('evaluatorName', { length: 100 }).notNull(), // الشيخ عيسى، وائل، عبدالرحمن
  score: int('score'), // Score value (0, 25, 50, 75, 100)
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type EvaluatorScore = typeof evaluatorScores.$inferSelect;
export type InsertEvaluatorScore = typeof evaluatorScores.$inferInsert;

// Committee decisions per project
export const committeeDecisions = mysqlTable('committeeDecisions', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  selectedConsultantId: int('selectedConsultantId').references(() => consultants.id),
  decisionType: varchar('decisionType', { length: 50 }), // 'selected', 'negotiate', 'pending'
  negotiationTarget: text('negotiationTarget'), // التارجت
  committeeNotes: text('committeeNotes'), // ملاحظات اللجنة
  aiAnalysis: text('aiAnalysis'), // تحليل الذكاء الاصطناعي
  aiRecommendation: text('aiRecommendation'), // توصية الذكاء الاصطناعي
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type CommitteeDecision = typeof committeeDecisions.$inferSelect;
export type InsertCommitteeDecision = typeof committeeDecisions.$inferInsert;

// Extended consultant details (for "تعرف على الاستشاري")
export const consultantDetails = mysqlTable('consultantDetails', {
  id: int('id').autoincrement().primaryKey(),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }).unique(),
  phone2: varchar('phone2', { length: 20 }),
  location: varchar('location', { length: 255 }),
  classification: varchar('classification', { length: 100 }), // تصنيف
  weight: varchar('weight', { length: 100 }), // وزن
  yearsOfExperience: int('yearsOfExperience'),
  numberOfEngineers: int('numberOfEngineers'),
  notableClients: text('notableClients'), // عملاء بارزون
  contactPerson: varchar('contactPerson', { length: 255 }),
  contactPersonPhone: varchar('contactPersonPhone', { length: 20 }),
  contactPersonEmail: varchar('contactPersonEmail', { length: 320 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ConsultantDetail = typeof consultantDetails.$inferSelect;
export type InsertConsultantDetail = typeof consultantDetails.$inferInsert;

// Portfolio items for consultant profile
export const consultantPortfolio = mysqlTable('consultantPortfolio', {
  id: int('id').autoincrement().primaryKey(),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  imageUrl: varchar('imageUrl', { length: 500 }),
  projectType: varchar('projectType', { length: 100 }), // residential, commercial, mixed-use
  location: varchar('location', { length: 255 }),
  year: varchar('year', { length: 10 }),
  area: varchar('area', { length: 100 }), // sqft or sqm
  sortOrder: int('sortOrder').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ConsultantPortfolioItem = typeof consultantPortfolio.$inferSelect;
export type InsertConsultantPortfolioItem = typeof consultantPortfolio.$inferInsert;

// Chat history for agent conversations
export const chatHistory = mysqlTable('chatHistory', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  agent: varchar('agent', { length: 50 }).notNull(), // salwa, farouq, etc.
  role: varchar('role', { length: 20 }).notNull(), // user or assistant
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type ChatHistoryItem = typeof chatHistory.$inferSelect;
export type InsertChatHistoryItem = typeof chatHistory.$inferInsert;

// AI Model Usage Log - تتبع استخدام النماذج وأوقات الاستجابة
export const modelUsageLog = mysqlTable('modelUsageLog', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  agent: varchar('agent', { length: 50 }).notNull(), // salwa, farouq, etc.
  model: varchar('model', { length: 100 }).notNull(), // GPT-4o, Claude Sonnet 4, Gemini 2.5 Pro
  responseTimeMs: int('responseTimeMs').notNull(), // Response time in milliseconds
  success: mysqlEnum('success', ['true', 'false']).default('true').notNull(),
  isFallback: mysqlEnum('isFallback', ['true', 'false']).default('false').notNull(),
  inputTokens: int('inputTokens'), // Approximate input tokens
  outputTokens: int('outputTokens'), // Approximate output tokens
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type ModelUsageLogItem = typeof modelUsageLog.$inferSelect;
export type InsertModelUsageLogItem = typeof modelUsageLog.$inferInsert;

// Agent Assignments - تكليفات الوكلاء (منفصل عن المهام)
export const agentAssignments = mysqlTable('agentAssignments', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  agent: varchar('agent', { length: 50 }).notNull(), // salwa, farouq, khaled, etc.
  userMessage: text('userMessage').notNull(), // الطلب الأصلي من المستخدم
  toolUsed: varchar('toolUsed', { length: 100 }).notNull(), // اسم الأداة المستخدمة
  toolArgs: text('toolArgs'), // JSON - المعاملات المرسلة للأداة
  toolResult: text('toolResult'), // JSON - نتيجة تنفيذ الأداة
  status: mysqlEnum('assignmentStatus', ['executing', 'completed', 'failed']).default('executing').notNull(),
  agentResponse: text('agentResponse'), // رد الوكيل النهائي
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  completedAt: timestamp('completedAt'),
});

export type AgentAssignment = typeof agentAssignments.$inferSelect;
export type InsertAgentAssignment = typeof agentAssignments.$inferInsert;

// Task Projects - المشاريع (ديناميكية)
export const taskProjects = mysqlTable('taskProjects', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  color: varchar('color', { length: 50 }).default('#6366f1'),
  icon: varchar('icon', { length: 50 }),
  isActive: mysqlEnum('isActive', ['true', 'false']).default('true').notNull(),
  sortOrder: int('sortOrder').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type TaskProject = typeof taskProjects.$inferSelect;
export type InsertTaskProject = typeof taskProjects.$inferInsert;

// Task Categories - التصنيفات (ديناميكية)
export const taskCategories = mysqlTable('taskCategories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  color: varchar('color', { length: 50 }).default('#8b5cf6'),
  icon: varchar('icon', { length: 50 }),
  isActive: mysqlEnum('isActive', ['true', 'false']).default('true').notNull(),
  sortOrder: int('sortOrder').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type TaskCategory = typeof taskCategories.$inferSelect;
export type InsertTaskCategory = typeof taskCategories.$inferInsert;

// Knowledge Base - قاعدة المعرفة المؤسسية
export const knowledgeBase = mysqlTable('knowledgeBase', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  type: mysqlEnum('type', ['decision', 'evaluation', 'pattern', 'insight', 'lesson']).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(), // المحتوى الأساسي
  summary: text('summary'), // ملخص AI-generated
  tags: text('tags'), // JSON array of tags for search
  relatedProjectId: int('relatedProjectId').references(() => projects.id),
  relatedConsultantId: int('relatedConsultantId').references(() => consultants.id),
  relatedAgentAssignmentId: int('relatedAgentAssignmentId').references(() => agentAssignments.id),
  sourceAgent: varchar('sourceAgent', { length: 50 }), // الوكيل الذي أنشأ المعرفة
  importance: mysqlEnum('importance', ['low', 'medium', 'high', 'critical']).default('medium').notNull(),
  viewCount: int('viewCount').default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeBaseItem = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBaseItem = typeof knowledgeBase.$inferInsert;

// Consultant Proposals - عروض الاستشاريين
export const consultantProposals = mysqlTable('consultantProposals', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  consultantId: int('consultantId').references(() => consultants.id),
  projectId: int('projectId').references(() => projects.id),
  title: varchar('title', { length: 500 }).notNull(),
  fileUrl: varchar('fileUrl', { length: 1000 }).notNull(), // S3 URL
  fileKey: varchar('fileKey', { length: 500 }).notNull(), // S3 key
  fileName: varchar('fileName', { length: 255 }).notNull(),
  fileSize: int('fileSize'), // bytes
  mimeType: varchar('mimeType', { length: 100 }),
  // AI Analysis results
  aiSummary: text('aiSummary'), // ملخص العرض
  aiKeyPoints: text('aiKeyPoints'), // JSON array - النقاط الرئيسية
  aiStrengths: text('aiStrengths'), // JSON array - نقاط القوة
  aiWeaknesses: text('aiWeaknesses'), // JSON array - نقاط الضعف
  aiRecommendation: text('aiRecommendation'), // التوصية
  aiScore: int('aiScore'), // 0-100
  extractedText: text('extractedText'), // النص المستخرج من PDF
  analysisStatus: mysqlEnum('analysisStatus', ['pending', 'processing', 'completed', 'failed']).default('pending').notNull(),
  analysisError: text('analysisError'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ConsultantProposal = typeof consultantProposals.$inferSelect;
export type InsertConsultantProposal = typeof consultantProposals.$inferInsert;

// Proposal Comparisons - مقارنات العروض
export const proposalComparisons = mysqlTable('proposalComparisons', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull(),
  projectId: int('projectId').references(() => projects.id),
  title: varchar('title', { length: 500 }).notNull(),
  proposalIds: text('proposalIds').notNull(), // JSON array of proposal IDs
  comparisonResult: text('comparisonResult'), // JSON - نتيجة المقارنة التفصيلية
  aiRecommendation: text('aiRecommendation'), // التوصية النهائية
  winnerProposalId: int('winnerProposalId').references(() => consultantProposals.id),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ProposalComparison = typeof proposalComparisons.$inferSelect;
export type InsertProposalComparison = typeof proposalComparisons.$inferInsert;


// ==========================================
// غرفة الاجتماعات التفاعلية - Meeting Room
// ==========================================

// Meetings - الاجتماعات
export const meetings = mysqlTable('meetings', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull().references(() => users.id),
  title: varchar('title', { length: 500 }).notNull(),
  topic: text('topic'), // موضوع النقاش
  status: mysqlEnum('meetingStatus', ['preparing', 'in_progress', 'completed', 'cancelled']).default('preparing').notNull(),
  createdBy: varchar('createdBy', { length: 100 }).default('user').notNull(), // user or agent name
  startedAt: timestamp('startedAt'),
  endedAt: timestamp('endedAt'),
  // Meeting outputs
  minutesSummary: text('minutesSummary'), // محضر الاجتماع
  decisionsJson: text('decisionsJson'), // JSON array of decisions
  extractedTasksJson: text('extractedTasksJson'), // JSON array of tasks
  knowledgeItemsJson: text('knowledgeItemsJson'), // JSON array of knowledge items saved
  audioRecordingUrl: varchar('audioRecordingUrl', { length: 1000 }), // S3 URL for full recording
  fullTranscript: text('fullTranscript'), // النص الكامل للاجتماع
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;

// Meeting Participants - المشاركون في الاجتماع
export const meetingParticipants = mysqlTable('meetingParticipants', {
  id: int('id').primaryKey().autoincrement(),
  meetingId: int('meetingId').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  agentId: int('agentId').notNull().references(() => agents.id),
  role: mysqlEnum('participantRole', ['participant', 'observer']).default('participant').notNull(),
  joinedAt: timestamp('joinedAt').defaultNow().notNull(),
});

export type MeetingParticipant = typeof meetingParticipants.$inferSelect;
export type InsertMeetingParticipant = typeof meetingParticipants.$inferInsert;

// Meeting Files - ملفات الاجتماع
export const meetingFiles = mysqlTable('meetingFiles', {
  id: int('id').primaryKey().autoincrement(),
  meetingId: int('meetingId').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  fileName: varchar('fileName', { length: 255 }).notNull(),
  fileUrl: varchar('fileUrl', { length: 1000 }).notNull(), // S3 URL
  fileKey: varchar('fileKey', { length: 500 }).notNull(), // S3 key
  fileType: varchar('fileType', { length: 50 }).notNull(), // pdf, word, excel, image, audio
  mimeType: varchar('mimeType', { length: 100 }),
  fileSize: int('fileSize'), // bytes
  extractedText: text('extractedText'), // النص المستخرج
  uploadedAt: timestamp('uploadedAt').defaultNow().notNull(),
});

export type MeetingFile = typeof meetingFiles.$inferSelect;
export type InsertMeetingFile = typeof meetingFiles.$inferInsert;

// Meeting Messages - رسائل الاجتماع (المحادثة)
export const meetingMessages = mysqlTable('meetingMessages', {
  id: int('id').primaryKey().autoincrement(),
  meetingId: int('meetingId').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  speakerId: varchar('speakerId', { length: 100 }).notNull(), // agentName or 'user'
  speakerType: mysqlEnum('speakerType', ['user', 'agent']).notNull(),
  messageText: text('messageText').notNull(),
  audioUrl: varchar('audioUrl', { length: 1000 }), // S3 URL if voice message
  replyToId: int('replyToId'), // reply to another message
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type MeetingMessage = typeof meetingMessages.$inferSelect;
export type InsertMeetingMessage = typeof meetingMessages.$inferInsert;


// ==========================================
// محرك تنفيذ المهام - Task Execution Engine
// ==========================================

// Task Execution Logs - سجل تنفيذ المهام التفصيلي
export const taskExecutionLogs = mysqlTable('taskExecutionLogs', {
  id: int('id').primaryKey().autoincrement(),
  taskId: int('taskId').references(() => tasks.id),
  meetingId: int('meetingId').references(() => meetings.id),
  agent: varchar('agent', { length: 50 }).notNull(), // الوكيل المنفذ
  taskTitle: varchar('taskTitle', { length: 500 }).notNull(),
  
  // Action Plan
  actionPlanJson: text('actionPlanJson'), // JSON - خطة العمل المهيكلة
  totalSteps: int('totalSteps').default(0).notNull(),
  completedSteps: int('completedSteps').default(0).notNull(),
  
  // Execution Details
  status: mysqlEnum('executionStatus', ['planning', 'executing', 'verifying', 'completed', 'partial', 'failed', 'retrying']).default('planning').notNull(),
  attempt: int('attempt').default(1).notNull(), // رقم المحاولة
  maxAttempts: int('maxAttempts').default(2).notNull(),
  
  // Tool Usage Tracking
  toolsUsedJson: text('toolsUsedJson'), // JSON array - الأدوات المستخدمة فعلياً
  toolCallCount: int('toolCallCount').default(0).notNull(), // عدد استدعاءات الأدوات
  writeToolCount: int('writeToolCount').default(0).notNull(), // عدد أدوات الكتابة المستخدمة
  
  // Step Results
  stepResultsJson: text('stepResultsJson'), // JSON array - نتائج كل خطوة
  
  // Verification
  verified: int('verified').default(0).notNull(), // 0 = لم يتحقق, 1 = تحقق بنجاح
  verificationDetails: text('verificationDetails'),
  
  // Data Changes
  dataChangesJson: text('dataChangesJson'), // JSON array - التغييرات الفعلية على البيانات
  
  // Agent Response
  agentResponse: text('agentResponse'), // الرد النهائي من الوكيل
  errorMessage: text('errorMessage'), // رسالة الخطأ إن وجدت
  
  // Timing
  startedAt: timestamp('startedAt').defaultNow().notNull(),
  completedAt: timestamp('completedAt'),
  durationMs: int('durationMs'), // مدة التنفيذ بالمللي ثانية
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export type TaskExecutionLog = typeof taskExecutionLogs.$inferSelect;
export type InsertTaskExecutionLog = typeof taskExecutionLogs.$inferInsert;
