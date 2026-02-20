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
