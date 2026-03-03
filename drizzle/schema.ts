import { int, mysqlEnum, mysqlTable, text, mediumtext, longtext, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";
import { bigint as bigintCol } from "drizzle-orm/mysql-core";

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
  
  // === القسم الأول: البيانات الأساسية للقطعة (Fact Sheet) ===
  // 1.1 أرقام التعريف
  titleDeedNumber: varchar('titleDeedNumber', { length: 100 }), // رقم سند الملكية
  ddaNumber: varchar('ddaNumber', { length: 100 }), // رقم DDA (هيئة دبي للتطوير)
  masterDevRef: varchar('masterDevRef', { length: 100 }), // الرقم المرجعي للمطور الرئيسي
  
  // 1.2 المساحات
  plotAreaSqm: decimal('plotAreaSqm', { precision: 12, scale: 2 }), // مساحة الأرض بالمتر المربع
  plotAreaSqft: decimal('plotAreaSqft', { precision: 12, scale: 2 }), // مساحة الأرض بالقدم المربع
  gfaSqm: decimal('gfaSqm', { precision: 12, scale: 2 }), // المساحة الإجمالية المسموح بناؤها بالمتر
  gfaSqft: decimal('gfaSqft', { precision: 12, scale: 2 }), // المساحة الإجمالية المسموح بناؤها بالقدم
  // 1.2.1 GFA حسب النوع (قدم²)
  gfaResidentialSqft: decimal('gfaResidentialSqft', { precision: 14, scale: 2 }), // GFA سكني بالقدم²
  gfaRetailSqft: decimal('gfaRetailSqft', { precision: 14, scale: 2 }), // GFA محلات تجارية بالقدم²
  gfaOfficesSqft: decimal('gfaOfficesSqft', { precision: 14, scale: 2 }), // GFA مكاتب بالقدم²
  
  // 1.3 الاستخدام ونوع الملكية
  permittedUse: varchar('permittedUse', { length: 255 }), // الاستخدام المسموح
  ownershipType: varchar('ownershipType', { length: 255 }), // نوع الملكية
  subdivisionRestrictions: text('subdivisionRestrictions'), // قيود التجزئة
  
  // === القسم الثاني: الأطراف الرئيسية ===
  // 2.1 المطور الرئيسي
  masterDevName: varchar('masterDevName', { length: 255 }), // اسم المطور الرئيسي
  masterDevAddress: varchar('masterDevAddress', { length: 500 }), // عنوان المطور
  
  // 2.2 البائع (المالك السابق)
  sellerName: varchar('sellerName', { length: 255 }),
  sellerAddress: varchar('sellerAddress', { length: 500 }),
  
  // 2.3 المشتري (المالك الحالي)
  buyerName: varchar('buyerName', { length: 255 }),
  buyerNationality: varchar('buyerNationality', { length: 100 }),
  buyerPassport: varchar('buyerPassport', { length: 50 }),
  buyerAddress: varchar('buyerAddress', { length: 500 }),
  buyerPhone: varchar('buyerPhone', { length: 50 }),
  buyerEmail: varchar('buyerEmail', { length: 320 }),
  
  // === القسم الثالث: البنية التحتية والتخصيصات ===
  // 3.1 تخصيصات المرافق
  electricityAllocation: varchar('electricityAllocation', { length: 100 }), // كيلوواط
  waterAllocation: varchar('waterAllocation', { length: 100 }), // م³/يوم
  sewageAllocation: varchar('sewageAllocation', { length: 100 }), // م³/يوم
  
  // 3.2 تخصيصات الحركة المرورية
  tripAM: varchar('tripAM', { length: 50 }), // صباحاً
  tripLT: varchar('tripLT', { length: 50 }), // نهاراً
  tripPM: varchar('tripPM', { length: 50 }), // مساءً
  
  // === القسم الرابع: الجدول الزمني للإنشاءات ===
  effectiveDate: varchar('effectiveDate', { length: 50 }), // تاريخ السريان
  constructionPeriod: varchar('constructionPeriod', { length: 255 }), // فترة البناء الإجمالية
  constructionStartDate: varchar('constructionStartDate', { length: 255 }), // تاريخ بدء الإنشاء
  completionDate: varchar('completionDate', { length: 255 }), // تاريخ الإنجاز
  constructionConditions: text('constructionConditions'), // شروط بدء الإنشاء
  
  // === القسم الخامس: الالتزامات والقيود ===
  saleRestrictions: text('saleRestrictions'), // قيود البيع والتصرف
  resaleConditions: text('resaleConditions'), // إعادة البيع المستقبلية
  communityCharges: text('communityCharges'), // رسوم المجتمع
  
  // === القسم السادس: المستندات والتسجيل ===
  registrationAuthority: varchar('registrationAuthority', { length: 255 }), // جهة التسجيل
  adminFee: int('adminFee'), // رسوم إدارية
  clearanceFee: int('clearanceFee'), // رسوم شهادة التخليص
  compensationAmount: int('compensationAmount'), // مبلغ تعويض
  
  // === القسم السابع: القانون الحاكم ===
  governingLaw: text('governingLaw'), // القانون الساري
  disputeResolution: text('disputeResolution'), // تسوية النزاعات
  
  notes: text('notes'),

  // === قسم بيانات الشراء ===
  landPrice: decimal('landPrice', { precision: 14, scale: 2 }), // سعر الأرض
  agentCommissionLandPct: decimal('agentCommissionLandPct', { precision: 5, scale: 2 }), // عمولة وسيط الأرض %

  // === القسم الثامن: الإدخالات اليدوية ===
  manualBuaSqft: decimal('manualBuaSqft', { precision: 14, scale: 2 }), // مساحة البناء BUA (قدم مربع)
  estimatedConstructionPricePerSqft: decimal('estimatedConstructionPricePerSqft', { precision: 14, scale: 2 }), // السعر التقديري للقدم المربع (بناء)
  soilTestFee: decimal('soilTestFee', { precision: 14, scale: 2 }), // رسوم تقرير فحص التربة
  topographicSurveyFee: decimal('topographicSurveyFee', { precision: 14, scale: 2 }), // أعمال الرفع المساحي الطبوغرافي
  reraUnitRegFee: decimal('reraUnitRegFee', { precision: 14, scale: 2 }), // رسوم تسجيل الوحدات — ريرا
  developerNocFee: decimal('developerNocFee', { precision: 14, scale: 2 }), // رسوم عدم ممانعة للبيع — المطور
  escrowAccountFee: decimal('escrowAccountFee', { precision: 14, scale: 2 }), // رسوم فتح حساب الضمان
  bankFees: decimal('bankFees', { precision: 14, scale: 2 }), // الرسوم البنكية
  communityFees: decimal('communityFees', { precision: 14, scale: 2 }), // رسوم المجتمع
  surveyorFees: decimal('surveyorFees', { precision: 14, scale: 2 }), // أتعاب المسّاح (تأكيد المساحات)
  reraAuditReportFee: decimal('reraAuditReportFee', { precision: 14, scale: 2 }), // تقارير تدقيق ريرا الدورية
  reraInspectionReportFee: decimal('reraInspectionReportFee', { precision: 14, scale: 2 }), // تقارير تفتيش ريرا الدورية
  reraProjectRegFee: decimal('reraProjectRegFee', { precision: 14, scale: 2 }), // رسوم تسجيل المشروع — ريرا
  officialBodiesFees: decimal('officialBodiesFees', { precision: 14, scale: 2 }), // رسوم الجهات الرسمية
  // نسب التكاليف المتغيرة
  designFeePct: decimal('designFeePct', { precision: 5, scale: 2 }), // أتعاب التصميم %
  supervisionFeePct: decimal('supervisionFeePct', { precision: 5, scale: 2 }), // أتعاب الإشراف %
  separationFeePerM2: decimal('separationFeePerM2', { precision: 10, scale: 2 }), // رسوم الفرز لكل م²
  salesCommissionPct: decimal('salesCommissionPct', { precision: 5, scale: 2 }), // عمولة البيع %
  marketingPct: decimal('marketingPct', { precision: 5, scale: 2 }), // التسويق %
  developerFeePhase1Pct: decimal('developerFeePhase1Pct', { precision: 5, scale: 2 }).default("2"), // أتعاب المطور المرحلة الأولى %
  developerFeePhase2Pct: decimal('developerFeePhase2Pct', { precision: 5, scale: 2 }).default("3"), // أتعاب المطور المرحلة الثانية %

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
  projectId: int('projectId').references(() => projects.id, { onDelete: 'set null' }), // ربط بالمشروع
  scenarioName: varchar('scenarioName', { length: 255 }), // اسم السيناريو (متفائل، متشائم، متوسط)
  aiSummary: text('aiSummary'), // ملخص ذكي من جويل
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
  // Market Analysis
  marketAnalysis: text('marketAnalysis'), // تحليل السوق من جويل
  competitorAnalysis: text('competitorAnalysis'), // تحليل المنافسين
  priceRecommendation: text('priceRecommendation'), // توصيات سعرية
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
  decisionType: varchar('decisionType', { length: 50 }), // 'selected', 'negotiate', 'pending', 'rejected'
  decisionBasis: varchar('decisionBasis', { length: 100 }), // 'highest_technical', 'best_value', 'lowest_fee', 'highest_fee_with_negotiation', 'other'
  justification: text('justification'), // مبررات اللجنة التفصيلية
  negotiationTarget: text('negotiationTarget'), // التارجت
  negotiationConditions: text('negotiationConditions'), // شروط التفاوض
  committeeNotes: text('committeeNotes'), // ملاحظات اللجنة
  aiAnalysis: text('aiAnalysis'), // تحليل الذكاء الاصطناعي
  aiRecommendation: text('aiRecommendation'), // توصية الذكاء الاصطناعي
  aiPostDecisionAnalysis: text('aiPostDecisionAnalysis'), // تحليل AI بعد القرار
  isConfirmed: int('isConfirmed').default(0), // هل تم تأكيد القرار (0=لا, 1=نعم)
  confirmedAt: timestamp('confirmedAt'), // تاريخ التأكيد
  confirmedBy: varchar('confirmedBy', { length: 255 }), // من أكد القرار
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type CommitteeDecision = typeof committeeDecisions.$inferSelect;
export type InsertCommitteeDecision = typeof committeeDecisions.$inferInsert;

// AI Advisory scores per criterion per consultant per project
export const aiAdvisoryScores = mysqlTable('aiAdvisoryScores', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  consultantId: int('consultantId').notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  criterionId: int('criterionId').notNull(),
  suggestedScore: int('suggestedScore'), // الدرجة المقترحة من AI
  reasoning: text('reasoning'), // مبررات AI
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type AiAdvisoryScore = typeof aiAdvisoryScores.$inferSelect;
export type InsertAiAdvisoryScore = typeof aiAdvisoryScores.$inferInsert;

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
  type: mysqlEnum('knowledgeType', ['decision', 'evaluation', 'pattern', 'insight', 'lesson']).notNull(),
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
  // Detailed proposal content analysis
  aiScope: text('aiScope'), // JSON - نطاق الأعمال المشمولة
  aiExclusions: text('aiExclusions'), // JSON - الاستثناءات والأعمال غير المشمولة
  aiAdditionalWorks: text('aiAdditionalWorks'), // JSON - الأعمال الإضافية وتكلفتها
  aiSupervisionTerms: text('aiSupervisionTerms'), // JSON - شروط وأتعاب الإشراف
  aiTimeline: text('aiTimeline'), // JSON - الجدول الزمني والمراحل
  aiPaymentTerms: text('aiPaymentTerms'), // JSON - شروط الدفع
  aiConditions: text('aiConditions'), // JSON - الشروط العامة والخاصة
  aiTeamComposition: text('aiTeamComposition'), // JSON - تكوين الفريق
  aiDeliverables: text('aiDeliverables'), // JSON - المخرجات والتسليمات
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

// OAuth Tokens - Google Drive OAuth tokens for user delegation
export const oauthTokens = mysqlTable('oauthTokens', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  provider: varchar('provider', { length: 50 }).notNull(), // 'google'
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  expiresAt: timestamp('expiresAt'), // When access token expires
  scope: text('scope'), // Granted scopes
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type OAuthToken = typeof oauthTokens.$inferSelect;
export type InsertOAuthToken = typeof oauthTokens.$inferInsert;

// ==========================================
// سجل العقود - Contracts Registry
// ==========================================

// أنواع العقود (قابلة للإضافة والتعديل والحذف)
export const contractTypes = mysqlTable('contractTypes', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(), // اسم نوع العقد
  nameEn: varchar('nameEn', { length: 255 }), // الاسم بالإنجليزية
  code: varchar('code', { length: 50 }), // كود مختصر مثل SPA, NOV, PMC
  category: varchar('category', { length: 100 }), // التصنيف: land, construction, consultant, government, sales, other
  description: text('description'), // وصف نوع العقد
  isDefault: int('isDefault').default(0).notNull(), // 1 = نوع افتراضي من النظام
  sortOrder: int('sortOrder').default(0).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ContractType = typeof contractTypes.$inferSelect;
export type InsertContractType = typeof contractTypes.$inferInsert;

// عقود المشاريع (العقد الفعلي المرتبط بمشروع)
export const projectContracts = mysqlTable('projectContracts', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('userId').notNull().references(() => users.id),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  contractTypeId: int('contractTypeId').notNull().references(() => contractTypes.id),
  
  // بيانات العقد الأساسية
  title: varchar('title', { length: 500 }).notNull(), // عنوان العقد
  contractNumber: varchar('contractNumber', { length: 100 }), // رقم العقد
  partyA: varchar('partyA', { length: 255 }), // الطرف الأول
  partyB: varchar('partyB', { length: 255 }), // الطرف الثاني
  contractValue: decimal('contractValue', { precision: 15, scale: 2 }), // قيمة العقد
  currency: varchar('currency', { length: 10 }).default('AED'), // العملة
  
  // التواريخ
  signDate: varchar('signDate', { length: 50 }), // تاريخ التوقيع
  startDate: varchar('startDate', { length: 50 }), // تاريخ البدء
  endDate: varchar('endDate', { length: 50 }), // تاريخ الانتهاء
  
  // الملف
  fileUrl: varchar('fileUrl', { length: 1000 }), // رابط ملف العقد (S3)
  fileKey: varchar('fileKey', { length: 500 }), // مفتاح S3
  fileName: varchar('fileName', { length: 255 }), // اسم الملف الأصلي
  driveFileId: varchar('driveFileId', { length: 100 }), // معرف الملف في Google Drive
  
  // حالة العقد
  status: mysqlEnum('contractStatus', ['draft', 'active', 'expired', 'terminated', 'renewed', 'pending']).default('draft').notNull(),
  
  // تحليل فاروق
  analysisStatus: mysqlEnum('contractAnalysisStatus', ['not_analyzed', 'analyzing', 'completed', 'failed']).default('not_analyzed').notNull(),
  analysisSummary: text('analysisSummary'), // ملخص التحليل
  analysisKeyDates: text('analysisKeyDates'), // JSON: المواعيد المهمة
  analysisPenalties: text('analysisPenalties'), // JSON: الغرامات والجزاءات
  analysisObligations: text('analysisObligations'), // JSON: الالتزامات
  analysisRisks: text('analysisRisks'), // JSON: المخاطر القانونية
  analysisParties: text('analysisParties'), // JSON: الأطراف وأدوارهم
  analysisTermination: text('analysisTermination'), // شروط الإنهاء
  analysisNotes: text('analysisNotes'), // ملاحظات فاروق
  analysisFullJson: text('analysisFullJson'), // التحليل الكامل JSON
  analyzedAt: timestamp('analyzedAt'), // تاريخ التحليل
  
  notes: text('notes'), // ملاحظات عامة
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type ProjectContract = typeof projectContracts.$inferSelect;
export type InsertProjectContract = typeof projectContracts.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// نظام فهرسة المستندات المشترك (Shared Document Index)
// ═══════════════════════════════════════════════════════════════

export const documentIndex = mysqlTable('documentIndex', {
  id: int('id').autoincrement().primaryKey(),
  
  // مصدر الملف
  sourceType: mysqlEnum('sourceType', ['google_drive', 'email_attachment', 'upload', 'agent_output']).notNull(),
  sourceId: varchar('sourceId', { length: 255 }), // Google Drive file ID, email UID, etc.
  sourcePath: varchar('sourcePath', { length: 1000 }), // Full path in Drive or S3 URL
  sourceName: varchar('sourceName', { length: 500 }).notNull(), // Original filename
  
  // نوع الملف
  fileType: mysqlEnum('fileType', ['pdf', 'excel', 'word', 'image', 'text', 'google_doc', 'google_sheet', 'google_slides', 'csv', 'other']).notNull(),
  mimeType: varchar('mimeType', { length: 255 }),
  fileSizeBytes: int('fileSizeBytes'),
  
  // المحتوى المستخرج
  extractedText: longtext('extractedText'), // النص الكامل المستخرج
  extractedTextLength: int('extractedTextLength'), // طول النص (للإحصائيات)
  structuredData: longtext('structuredData'), // JSON: بيانات مهيكلة (جداول Excel، حقول مستخرجة)
  summary: text('summary'), // ملخص AI للمستند
  
  // التصنيف
  category: varchar('category', { length: 100 }), // proposal, contract, title_deed, feasibility, etc.
  projectId: int('projectId'), // ربط بالمشروع إن وجد
  consultantId: int('consultantId'), // ربط بالاستشاري إن وجد
  tags: text('tags'), // JSON array of tags
  language: varchar('language', { length: 10 }), // ar, en, mixed
  
  // حالة الفهرسة
  indexStatus: mysqlEnum('indexStatus', ['pending', 'processing', 'indexed', 'failed', 'needs_update']).default('pending').notNull(),
  indexError: text('indexError'), // سبب الفشل
  indexedBy: varchar('indexedBy', { length: 50 }), // اسم الوكيل الذي فهرس الملف
  
  // البحث
  searchVector: text('searchVector'), // كلمات مفتاحية للبحث السريع
  
  // التتبع
  lastAccessedAt: timestamp('lastAccessedAt'), // آخر وصول
  accessCount: int('accessCount').default(0), // عدد مرات الوصول
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type DocumentIndex = typeof documentIndex.$inferSelect;
export type InsertDocumentIndex = typeof documentIndex.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// سجل نشاط الوكلاء (Agent Activity Log)
// ═══════════════════════════════════════════════════════════════

export const agentActivityLog = mysqlTable('agentActivityLog', {
  id: int('id').autoincrement().primaryKey(),
  
  // الوكيل
  agentName: varchar('agentName', { length: 50 }).notNull(), // salwa, farouq, khazen, etc.
  agentModel: varchar('agentModel', { length: 50 }), // GPT-4o, Claude Sonnet 4, Gemini 2.5 Pro
  
  // العملية
  actionType: mysqlEnum('actionType', [
    'tool_call',      // استدعاء أداة
    'chat_response',  // رد على محادثة
    'file_read',      // قراءة ملف
    'file_write',     // كتابة ملف
    'db_read',        // قراءة من قاعدة البيانات
    'db_write',       // كتابة في قاعدة البيانات
    'email_action',   // عملية إيميل
    'drive_action',   // عملية Google Drive
    'agent_comm',     // تواصل بين وكلاء
    'task_execution', // تنفيذ مهمة
    'meeting_action', // عملية اجتماع
    'analysis',       // تحليل مستند
    'error'           // خطأ
  ]).notNull(),
  
  // التفاصيل
  toolName: varchar('toolName', { length: 100 }), // اسم الأداة المستخدمة
  inputSummary: text('inputSummary'), // ملخص المدخلات (أول 500 حرف)
  outputSummary: text('outputSummary'), // ملخص المخرجات (أول 500 حرف)
  fullInput: mediumtext('fullInput'), // المدخلات الكاملة (JSON)
  fullOutput: mediumtext('fullOutput'), // المخرجات الكاملة (JSON)
  
  // النتيجة
  status: mysqlEnum('activityStatus', ['success', 'failure', 'partial', 'pending']).notNull(),
  errorMessage: text('errorMessage'), // رسالة الخطأ إن وجدت
  errorDetails: text('errorDetails'), // تفاصيل الخطأ (stack trace)
  
  // السياق
  triggerSource: varchar('triggerSource', { length: 100 }), // chat, meeting, task, email, telegram, scheduled
  relatedEntityType: varchar('relatedEntityType', { length: 50 }), // project, consultant, contract, meeting, task
  relatedEntityId: int('relatedEntityId'),
  userId: int('userId'), // المستخدم الذي طلب العملية
  
  // الأداء
  durationMs: int('durationMs'), // مدة التنفيذ بالميلي ثانية
  tokensUsed: int('tokensUsed'), // عدد التوكنات المستخدمة (تقريبي)
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export type AgentActivityLog = typeof agentActivityLog.$inferSelect;
export type InsertAgentActivityLog = typeof agentActivityLog.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// قاعدة المعرفة المتخصصة (Specialist Knowledge)
// ═══════════════════════════════════════════════════════════════

export const specialistKnowledge = mysqlTable('specialistKnowledge', {
  id: int('id').autoincrement().primaryKey(),
  
  // التصنيف
  domain: mysqlEnum('knowledgeDomain', [
    'rera_law',           // قوانين RERA
    'dubai_municipality',  // معايير بلدية دبي
    'building_codes',      // كودات البناء
    'market_prices',       // أسعار السوق
    'como_context',        // سياق COMO
    'como_people',         // أشخاص COMO
    'como_preferences',    // تفضيلات COMO
    'como_workflow',       // طريقة عمل COMO
    'consultant_info',     // معلومات الاستشاريين
    'project_standards',   // معايير المشاريع
    'general'              // عام
  ]).notNull(),
  
  category: varchar('category', { length: 100 }).notNull(), // فئة فرعية
  title: varchar('title', { length: 500 }).notNull(),
  content: longtext('content').notNull(), // المحتوى الكامل
  
  // البحث
  keywords: text('keywords'), // كلمات مفتاحية (JSON array)
  
  // المصدر
  source: varchar('source', { length: 255 }), // المصدر (قانون رقم X، موقع RERA، إلخ)
  sourceUrl: varchar('sourceUrl', { length: 1000 }),
  
  // الصلاحية
  isActive: int('isActive').default(1).notNull(), // 1 = نشط، 0 = غير نشط
  validFrom: timestamp('validFrom'),
  validUntil: timestamp('validUntil'),
  
  // التتبع
  addedBy: varchar('addedBy', { length: 50 }), // من أضاف (admin, agent, system)
  lastUsedAt: timestamp('lastUsedAt'),
  useCount: int('useCount').default(0),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type SpecialistKnowledge = typeof specialistKnowledge.$inferSelect;
export type InsertSpecialistKnowledge = typeof specialistKnowledge.$inferInsert;

// سجل الإيميلات المرسلة عبر سلوى
export const sentEmails = mysqlTable('sent_emails', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  
  // بيانات الإرسال
  toEmail: varchar('toEmail', { length: 320 }).notNull(), // عنوان المرسل إليه
  toName: varchar('toName', { length: 255 }), // اسم المرسل إليه
  subject: varchar('subject', { length: 500 }).notNull(), // الموضوع
  body: longtext('body').notNull(), // نص الرد
  
  // بيانات الإيميل الأصلي
  inReplyTo: varchar('inReplyTo', { length: 500 }), // messageId للإيميل الأصلي
  originalEmailUid: int('originalEmailUid'), // UID الإيميل الأصلي
  cc: varchar('cc', { length: 1000 }), // نسخة كربونية
  
  // الحالة
  status: mysqlEnum('status', ['sent', 'failed', 'pending']).default('sent').notNull(),
  errorMessage: text('errorMessage'), // رسالة الخطأ في حالة الفشل
  
  // من أرسل
  sentBy: varchar('sentBy', { length: 50 }).default('salwa').notNull(), // salwa, user, system
  agentName: varchar('agentName', { length: 50 }).default('salwa'), // اسم الوكيل
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export type SentEmail = typeof sentEmails.$inferSelect;
export type InsertSentEmail = typeof sentEmails.$inferInsert;

// ─── Email Notifications ──────────────────────────────────────
export const emailNotifications = mysqlTable("email_notifications", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  emailUid: int("email_uid").notNull(),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  preview: text("preview"),
  receivedAt: bigintCol("received_at", { mode: "number" }).notNull(),
  isRead: int("is_read").default(0),
  isDismissed: int("is_dismissed").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// ═══════════════════════════════════════════════════════════════
// مركز القيادة - Command Center (Executive Communication Hub)
// ═══════════════════════════════════════════════════════════════

// أعضاء مركز القيادة - Command Center Members
export const commandCenterMembers = mysqlTable('commandCenterMembers', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), // الاسم الكامل
  nameAr: varchar('nameAr', { length: 255 }).notNull(), // الاسم بالعربي (للترحيب)
  role: mysqlEnum('memberRole', ['admin', 'executive']).notNull(), // admin = عبدالرحمن, executive = وائل/الشيخ عيسى
  memberId: varchar('memberId', { length: 50 }).notNull().unique(), // معرف فريد: abdulrahman, wael, sheikh_issa
  accessToken: varchar('accessToken', { length: 128 }).notNull().unique(), // توكن الدخول الفريد
  greeting: varchar('greeting', { length: 500 }), // رسالة الترحيب المخصصة
  avatarUrl: varchar('avatarUrl', { length: 1000 }), // صورة العضو
  isActive: int('isActive').default(1).notNull(), // 1 = نشط
  lastAccessAt: timestamp('lastAccessAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type CommandCenterMember = typeof commandCenterMembers.$inferSelect;
export type InsertCommandCenterMember = typeof commandCenterMembers.$inferInsert;

// عناصر الفقاعات الذكية - Smart Bubble Items
export const commandCenterItems = mysqlTable('commandCenterItems', {
  id: int('id').autoincrement().primaryKey(),
  
  // نوع الفقاعة
  bubbleType: mysqlEnum('bubbleType', ['reports', 'requests', 'meeting_minutes', 'evaluations', 'announcements']).notNull(),
  
  // المحتوى
  title: varchar('title', { length: 500 }).notNull(),
  content: longtext('content'), // المحتوى الرئيسي (HTML أو Markdown)
  summary: text('summary'), // ملخص قصير يظهر في الفقاعة
  
  // الأولوية والحالة
  priority: mysqlEnum('itemPriority', ['normal', 'important', 'urgent']).default('normal').notNull(),
  status: mysqlEnum('itemStatus', ['active', 'archived', 'pending_response', 'resolved']).default('active').notNull(),
  
  // من أنشأ ولمن
  createdByMemberId: varchar('createdByMemberId', { length: 50 }).notNull(), // من أنشأ العنصر
  targetMemberIds: text('targetMemberIds'), // JSON array: لمن يظهر (null = الكل)
  
  // الطلبات والردود
  requiresResponse: int('requiresResponse').default(0).notNull(), // 1 = يحتاج رد
  responseDeadline: timestamp('responseDeadline'), // موعد الرد النهائي
  
  // مرفقات
  attachments: text('attachments'), // JSON array of {name, url, type}
  
  // ربط بالمشروع
  projectId: int('projectId').references(() => projects.id),
  consultantId: int('consultantId').references(() => consultants.id),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type CommandCenterItem = typeof commandCenterItems.$inferSelect;
export type InsertCommandCenterItem = typeof commandCenterItems.$inferInsert;

// ردود أعضاء مركز القيادة على العناصر
export const commandCenterResponses = mysqlTable('commandCenterResponses', {
  id: int('id').autoincrement().primaryKey(),
  itemId: int('itemId').notNull().references(() => commandCenterItems.id, { onDelete: 'cascade' }),
  memberId: varchar('memberId', { length: 50 }).notNull(), // من رد
  responseText: text('responseText').notNull(),
  responseType: mysqlEnum('responseType', ['approval', 'rejection', 'comment', 'question']).default('comment').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export type CommandCenterResponse = typeof commandCenterResponses.$inferSelect;
export type InsertCommandCenterResponse = typeof commandCenterResponses.$inferInsert;

// تقييمات مركز القيادة (التقييم المستقل)
export const commandCenterEvaluations = mysqlTable('commandCenterEvaluations', {
  id: int('id').autoincrement().primaryKey(),
  
  // جلسة التقييم
  sessionId: varchar('sessionId', { length: 100 }).notNull(), // معرف جلسة التقييم (لربط تقييمات نفس الجلسة)
  projectId: int('projectId').notNull().references(() => projects.id),
  consultantId: int('consultantId').notNull().references(() => consultants.id),
  
  // المقيّم
  memberId: varchar('memberId', { length: 50 }).notNull(), // من قيّم
  
  // الدرجات (JSON: {criterionId: score, ...})
  scoresJson: text('scoresJson').notNull(), // JSON object with criterion scores
  totalScore: decimal('totalScore', { precision: 5, scale: 2 }), // المجموع المرجح
  
  // ملاحظات
  notes: text('notes'), // ملاحظات المقيّم
  
  // الحالة
  isComplete: int('isComplete').default(0).notNull(), // 1 = أكمل التقييم
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type CommandCenterEvaluation = typeof commandCenterEvaluations.$inferSelect;
export type InsertCommandCenterEvaluation = typeof commandCenterEvaluations.$inferInsert;

// جلسات التقييم (لتتبع اكتمال التقييمات الثلاثة)
export const evaluationSessions = mysqlTable('evaluationSessions', {
  id: int('id').autoincrement().primaryKey(),
  sessionId: varchar('sessionId', { length: 100 }).notNull().unique(),
  projectId: int('projectId').notNull().references(() => projects.id),
  consultantId: int('consultantId').notNull().references(() => consultants.id),
  
  title: varchar('title', { length: 500 }).notNull(), // عنوان جلسة التقييم
  description: text('description'), // وصف
  
  // حالة الاكتمال
  isRevealed: int('isRevealed').default(0).notNull(), // 1 = تم كشف النتائج (بعد اكتمال الثلاثة)
  completedCount: int('completedCount').default(0).notNull(), // عدد من أكمل التقييم
  requiredCount: int('requiredCount').default(3).notNull(), // عدد المطلوب (3)
  
  // من أنشأ الجلسة
  createdByMemberId: varchar('createdByMemberId', { length: 50 }).notNull(),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type EvaluationSession = typeof evaluationSessions.$inferSelect;
export type InsertEvaluationSession = typeof evaluationSessions.$inferInsert;

// إشعارات مركز القيادة
export const commandCenterNotifications = mysqlTable('commandCenterNotifications', {
  id: int('id').autoincrement().primaryKey(),
  memberId: varchar('memberId', { length: 50 }).notNull(), // لمن الإشعار
  title: varchar('title', { length: 500 }).notNull(),
  message: text('message'),
  type: mysqlEnum('notificationType', ['new_item', 'response', 'evaluation', 'urgent', 'system']).default('system').notNull(),
  relatedItemId: int('relatedItemId'), // ربط بعنصر
  isRead: int('isRead').default(0).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export type CommandCenterNotification = typeof commandCenterNotifications.$inferSelect;
export type InsertCommandCenterNotification = typeof commandCenterNotifications.$inferInsert;

// محادثات سلوى في مركز القيادة (منفصلة عن المحادثات العادية)
export const commandCenterChat = mysqlTable('commandCenterChat', {
  id: int('id').autoincrement().primaryKey(),
  memberId: varchar('memberId', { length: 50 }).notNull(), // العضو المتحدث
  role: mysqlEnum('chatRole', ['member', 'salwa']).notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'), // JSON: بيانات إضافية (أوامر سلوى، نتائج أدوات)
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export type CommandCenterChatMsg = typeof commandCenterChat.$inferSelect;
export type InsertCommandCenterChatMsg = typeof commandCenterChat.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// مراحل المشاريع ومؤشرات الأداء - Project Milestones & KPIs
// ═══════════════════════════════════════════════════════════════

// مراحل المشروع - Project Milestones
export const projectMilestones = mysqlTable('projectMilestones', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  
  // بيانات المرحلة
  title: varchar('title', { length: 500 }).notNull(), // اسم المرحلة
  titleAr: varchar('titleAr', { length: 500 }), // الاسم بالعربي
  description: text('description'), // وصف المرحلة
  
  // الفئة
  category: mysqlEnum('milestoneCategory', [
    'planning',        // التخطيط
    'design',          // التصميم
    'permits',         // التراخيص
    'construction',    // البناء
    'handover',        // التسليم
    'sales',           // المبيعات
    'other'            // أخرى
  ]).default('other').notNull(),
  
  // التواريخ
  plannedStartDate: varchar('plannedStartDate', { length: 50 }), // تاريخ البدء المخطط
  plannedEndDate: varchar('plannedEndDate', { length: 50 }), // تاريخ الانتهاء المخطط
  actualStartDate: varchar('actualStartDate', { length: 50 }), // تاريخ البدء الفعلي
  actualEndDate: varchar('actualEndDate', { length: 50 }), // تاريخ الانتهاء الفعلي
  
  // التقدم والحالة
  progressPercent: int('progressPercent').default(0).notNull(), // نسبة الإنجاز 0-100
  status: mysqlEnum('milestoneStatus', [
    'not_started',   // لم تبدأ
    'in_progress',   // جارية
    'delayed',       // متأخرة
    'completed',     // مكتملة
    'on_hold',       // معلقة
    'cancelled'      // ملغاة
  ]).default('not_started').notNull(),
  
  // الأولوية والترتيب
  priority: mysqlEnum('milestonePriority', ['low', 'medium', 'high', 'critical']).default('medium').notNull(),
  sortOrder: int('sortOrder').default(0).notNull(), // ترتيب العرض
  
  // المسؤول
  assignedTo: varchar('assignedTo', { length: 255 }), // المسؤول عن المرحلة
  
  // ملاحظات
  notes: text('notes'),
  
  // من أنشأ (عضو مركز القيادة)
  createdByMemberId: varchar('createdByMemberId', { length: 50 }),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type InsertProjectMilestone = typeof projectMilestones.$inferInsert;

// مؤشرات الأداء الرئيسية - Key Performance Indicators
export const projectKpis = mysqlTable('projectKpis', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  
  // بيانات المؤشر
  name: varchar('name', { length: 500 }).notNull(), // اسم المؤشر
  nameAr: varchar('nameAr', { length: 500 }), // الاسم بالعربي
  description: text('description'), // وصف المؤشر
  
  // الفئة
  category: mysqlEnum('kpiCategory', [
    'financial',       // مالي
    'timeline',        // زمني
    'quality',         // جودة
    'safety',          // سلامة
    'sales',           // مبيعات
    'customer',        // رضا العملاء
    'operational'      // تشغيلي
  ]).default('operational').notNull(),
  
  // القيم
  targetValue: decimal('targetValue', { precision: 15, scale: 2 }), // القيمة المستهدفة
  currentValue: decimal('currentValue', { precision: 15, scale: 2 }), // القيمة الحالية
  unit: varchar('unit', { length: 50 }), // الوحدة (%, AED, days, sqft, etc.)
  
  // الاتجاه
  trend: mysqlEnum('kpiTrend', ['up', 'down', 'stable', 'na']).default('na').notNull(), // اتجاه المؤشر
  
  // الحالة (محسوبة أو يدوية)
  status: mysqlEnum('kpiStatus', [
    'on_track',      // على المسار
    'at_risk',       // في خطر
    'off_track',     // خارج المسار
    'achieved',      // تم تحقيقه
    'not_started'    // لم يبدأ
  ]).default('not_started').notNull(),
  
  // التحديث
  lastUpdatedBy: varchar('lastUpdatedBy', { length: 255 }), // من حدّث آخر مرة
  
  // ملاحظات
  notes: text('notes'),
  
  // من أنشأ (عضو مركز القيادة)
  createdByMemberId: varchar('createdByMemberId', { length: 50 }),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type ProjectKpi = typeof projectKpis.$inferSelect;
export type InsertProjectKpi = typeof projectKpis.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// الإعداد القانوني وتسجيل المشروع - Legal Setup & Project Registration
// ═══════════════════════════════════════════════════════════════

export const legalSetupRecords = mysqlTable('legalSetupRecords', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  
  // === الوثائق الأساسية ===
  titleDeedStatus: varchar('titleDeedStatus', { length: 100 }), // حالة سند الملكية: مكتمل، قيد الإجراء، معلق
  titleDeedNumber: varchar('titleDeedNumber', { length: 100 }), // رقم سند الملكية
  titleDeedDate: varchar('titleDeedDate', { length: 50 }), // تاريخ سند الملكية
  
  // === التسجيل لدى الجهات الحكومية ===
  ddaRegistrationStatus: varchar('ddaRegistrationStatus', { length: 100 }), // حالة التسجيل لدى هيئة دبي للتطوير
  ddaRegistrationNumber: varchar('ddaRegistrationNumber', { length: 100 }), // رقم التسجيل
  ddaRegistrationDate: varchar('ddaRegistrationDate', { length: 50 }), // تاريخ التسجيل
  
  municipalityApprovalStatus: varchar('municipalityApprovalStatus', { length: 100 }), // حالة موافقة البلدية
  municipalityApprovalNumber: varchar('municipalityApprovalNumber', { length: 100 }), // رقم الموافقة
  municipalityApprovalDate: varchar('municipalityApprovalDate', { length: 50 }), // تاريخ الموافقة
  
  // === الالتزامات والشروط ===
  legalObligations: text('legalObligations'), // الالتزامات القانونية (JSON array)
  restrictionsAndConditions: text('restrictionsAndConditions'), // القيود والشروط (JSON array)
  
  // === الرسوم والتكاليف ===
  registrationFees: int('registrationFees'), // رسوم التسجيل
  legalConsultationFees: int('legalConsultationFees'), // أتعاب الاستشارة القانونية
  governmentFeesTotal: int('governmentFeesTotal'), // إجمالي الرسوم الحكومية
  
  // === ملاحظات وتعليقات ===
  legalNotes: text('legalNotes'), // ملاحظات قانونية عامة
  farouqAnalysis: text('farouqAnalysis'), // تحليل فاروق (المحامي)
  
  // === حالة الإعداد ===
  completionStatus: varchar('completionStatus', { length: 100 }).default('pending'), // pending, in_progress, completed
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type LegalSetupRecord = typeof legalSetupRecords.$inferSelect;
export type InsertLegalSetupRecord = typeof legalSetupRecords.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// التصاميم وتصريح البناء - Designs & Building Permit
// ═══════════════════════════════════════════════════════════════

export const designsAndPermits = mysqlTable('designsAndPermits', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  
  // === التصاميم المعمارية ===
  architecturalDesignStatus: varchar('architecturalDesignStatus', { length: 100 }), // حالة التصميم: مكتمل، قيد الإعداد، معلق
  architecturalDesignDate: varchar('architecturalDesignDate', { length: 50 }), // تاريخ إنجاز التصميم
  architecturalDesignFileUrl: varchar('architecturalDesignFileUrl', { length: 1000 }), // رابط ملف التصميم
  architecturalDesignFileKey: varchar('architecturalDesignFileKey', { length: 500 }), // مفتاح S3
  
  // === التصاميم الهندسية ===
  engineeringDesignStatus: varchar('engineeringDesignStatus', { length: 100 }), // حالة التصميم الهندسي
  engineeringDesignDate: varchar('engineeringDesignDate', { length: 50 }), // تاريخ إنجاز التصميم الهندسي
  engineeringDesignFileUrl: varchar('engineeringDesignFileUrl', { length: 1000 }), // رابط ملف التصميم الهندسي
  engineeringDesignFileKey: varchar('engineeringDesignFileKey', { length: 500 }), // مفتاح S3
  
  // === تصريح البناء ===
  buildingPermitStatus: varchar('buildingPermitStatus', { length: 100 }), // حالة التصريح: مكتمل، قيد الانتظار، معلق
  buildingPermitNumber: varchar('buildingPermitNumber', { length: 100 }), // رقم تصريح البناء
  buildingPermitDate: varchar('buildingPermitDate', { length: 50 }), // تاريخ التصريح
  buildingPermitExpiryDate: varchar('buildingPermitExpiryDate', { length: 50 }), // تاريخ انتهاء التصريح
  buildingPermitFileUrl: varchar('buildingPermitFileUrl', { length: 1000 }), // رابط ملف التصريح
  buildingPermitFileKey: varchar('buildingPermitFileKey', { length: 500 }), // مفتاح S3
  
  // === الموافقات المتعلقة بالتصاميم ===
  municipalityDesignApprovalStatus: varchar('municipalityDesignApprovalStatus', { length: 100 }), // حالة موافقة البلدية على التصاميم
  municipalityDesignApprovalDate: varchar('municipalityDesignApprovalDate', { length: 50 }), // تاريخ الموافقة
  
  // === المتطلبات والشروط ===
  designRequirements: text('designRequirements'), // متطلبات التصميم (JSON array)
  buildingConditions: text('buildingConditions'), // شروط البناء (JSON array)
  
  // === الرسوم والتكاليف ===
  designConsultationFees: int('designConsultationFees'), // أتعاب الاستشارة التصميمية
  buildingPermitFees: int('buildingPermitFees'), // رسوم تصريح البناء
  municipalityDesignReviewFees: int('municipalityDesignReviewFees'), // رسوم مراجعة التصاميم من البلدية
  
  // === ملاحظات وتعليقات ===
  designNotes: text('designNotes'), // ملاحظات عامة على التصاميم
  consultantAnalysis: text('consultantAnalysis'), // تحليل الاستشاري المعماري
  
  // === حالة الإعداد ===
  completionStatus: varchar('completionStatus', { length: 100 }).default('pending'), // pending, in_progress, completed
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type DesignAndPermit = typeof designsAndPermits.$inferSelect;
export type InsertDesignAndPermit = typeof designsAndPermits.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// النظرة العامة والسوق - Market Overview (Tab 1 in Feasibility)
// ═══════════════════════════════════════════════════════════════

export const marketOverview = mysqlTable('marketOverview', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  projectId: int('projectId').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  
  // === تقرير جويل الذكي ===
  aiSmartReport: longtext('aiSmartReport'), // التقرير الذكي الحر من جويل
  aiRecommendationsJson: text('aiRecommendationsJson'), // JSON: التوصيات المهيكلة
  aiReportGeneratedAt: timestamp('aiReportGeneratedAt'), // تاريخ إنشاء التقرير
  
  // === توزيع الوحدات السكنية ===
  // استديو
  residentialStudioPct: decimal('residentialStudioPct', { precision: 5, scale: 2 }).default('0'), // نسبة الاستديو %
  residentialStudioAvgArea: int('residentialStudioAvgArea').default(0), // متوسط مساحة الاستديو sqft
  // غرفة وصالة
  residential1brPct: decimal('residential1brPct', { precision: 5, scale: 2 }).default('0'), // نسبة غرفة وصالة %
  residential1brAvgArea: int('residential1brAvgArea').default(0), // متوسط مساحة غرفة وصالة sqft
  // غرفتان وصالة
  residential2brPct: decimal('residential2brPct', { precision: 5, scale: 2 }).default('0'), // نسبة غرفتان وصالة %
  residential2brAvgArea: int('residential2brAvgArea').default(0), // متوسط مساحة غرفتان وصالة sqft
  // ثلاث غرف وصالة
  residential3brPct: decimal('residential3brPct', { precision: 5, scale: 2 }).default('0'), // نسبة ثلاث غرف وصالة %
  residential3brAvgArea: int('residential3brAvgArea').default(0), // متوسط مساحة ثلاث غرف وصالة sqft
  
  // === توزيع المحلات التجارية ===
  // صغيرة
  retailSmallPct: decimal('retailSmallPct', { precision: 5, scale: 2 }).default('0'), // نسبة المحلات الصغيرة %
  retailSmallAvgArea: int('retailSmallAvgArea').default(0), // متوسط مساحة المحل الصغير sqft
  // متوسطة
  retailMediumPct: decimal('retailMediumPct', { precision: 5, scale: 2 }).default('0'), // نسبة المحلات المتوسطة %
  retailMediumAvgArea: int('retailMediumAvgArea').default(0), // متوسط مساحة المحل المتوسط sqft
  // كبيرة
  retailLargePct: decimal('retailLargePct', { precision: 5, scale: 2 }).default('0'), // نسبة المحلات الكبيرة %
  retailLargeAvgArea: int('retailLargeAvgArea').default(0), // متوسط مساحة المحل الكبير sqft
  
  // === توزيع المكاتب ===
  // صغيرة
  officeSmallPct: decimal('officeSmallPct', { precision: 5, scale: 2 }).default('0'), // نسبة المكاتب الصغيرة %
  officeSmallAvgArea: int('officeSmallAvgArea').default(0), // متوسط مساحة المكتب الصغير sqft
  // متوسطة
  officeMediumPct: decimal('officeMediumPct', { precision: 5, scale: 2 }).default('0'), // نسبة المكاتب المتوسطة %
  officeMediumAvgArea: int('officeMediumAvgArea').default(0), // متوسط مساحة المكتب المتوسط sqft
  // كبيرة
  officeLargePct: decimal('officeLargePct', { precision: 5, scale: 2 }).default('0'), // نسبة المكاتب الكبيرة %
  officeLargeAvgArea: int('officeLargeAvgArea').default(0), // متوسط مساحة المكتب الكبير sqft
  
  // === جودة التشطيب ===
  finishingQuality: varchar('finishingQuality', { length: 100 }).default('ممتاز'), // ممتاز / جيد / عادي
  
  // === حالة الاعتماد ===
  isApproved: int('isApproved').default(0).notNull(), // 0 = لم يعتمد، 1 = معتمد
  approvedAt: timestamp('approvedAt'),
  
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type MarketOverview = typeof marketOverview.$inferSelect;
export type InsertMarketOverview = typeof marketOverview.$inferInsert;


// ═══════════════════════════════════════════
// Competition & Pricing (Tab 2 - المنافسة والتسعير)
// ═══════════════════════════════════════════
export const competitionPricing = mysqlTable('competition_pricing', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  projectId: int('projectId').notNull().references(() => projects.id),

  // === تقرير جويل الذكي ===
  aiSmartReport: text('aiSmartReport'), // التقرير الحر عن المنافسة والتسعير
  aiRecommendationsJson: text('aiRecommendationsJson'), // توصيات JSON (3 سيناريوهات + خطة سداد)
  aiReportGeneratedAt: timestamp('aiReportGeneratedAt'),

  // === السيناريو المتفائل - أسعار القدم² ===
  // سكني
  optStudioPrice: int('optStudioPrice').default(0),
  opt1brPrice: int('opt1brPrice').default(0),
  opt2brPrice: int('opt2brPrice').default(0),
  opt3brPrice: int('opt3brPrice').default(0),
  // تجاري
  optRetailSmallPrice: int('optRetailSmallPrice').default(0),
  optRetailMediumPrice: int('optRetailMediumPrice').default(0),
  optRetailLargePrice: int('optRetailLargePrice').default(0),
  // مكاتب
  optOfficeSmallPrice: int('optOfficeSmallPrice').default(0),
  optOfficeMediumPrice: int('optOfficeMediumPrice').default(0),
  optOfficeLargePrice: int('optOfficeLargePrice').default(0),

  // === السيناريو الأساسي - أسعار القدم² ===
  // سكني
  baseStudioPrice: int('baseStudioPrice').default(0),
  base1brPrice: int('base1brPrice').default(0),
  base2brPrice: int('base2brPrice').default(0),
  base3brPrice: int('base3brPrice').default(0),
  // تجاري
  baseRetailSmallPrice: int('baseRetailSmallPrice').default(0),
  baseRetailMediumPrice: int('baseRetailMediumPrice').default(0),
  baseRetailLargePrice: int('baseRetailLargePrice').default(0),
  // مكاتب
  baseOfficeSmallPrice: int('baseOfficeSmallPrice').default(0),
  baseOfficeMediumPrice: int('baseOfficeMediumPrice').default(0),
  baseOfficeLargePrice: int('baseOfficeLargePrice').default(0),

  // === السيناريو المتحفظ - أسعار القدم² ===
  // سكني
  consStudioPrice: int('consStudioPrice').default(0),
  cons1brPrice: int('cons1brPrice').default(0),
  cons2brPrice: int('cons2brPrice').default(0),
  cons3brPrice: int('cons3brPrice').default(0),
  // تجاري
  consRetailSmallPrice: int('consRetailSmallPrice').default(0),
  consRetailMediumPrice: int('consRetailMediumPrice').default(0),
  consRetailLargePrice: int('consRetailLargePrice').default(0),
  // مكاتب
  consOfficeSmallPrice: int('consOfficeSmallPrice').default(0),
  consOfficeMediumPrice: int('consOfficeMediumPrice').default(0),
  consOfficeLargePrice: int('consOfficeLargePrice').default(0),

  // === خطة السداد ===
  paymentBookingPct: decimal('paymentBookingPct', { precision: 5, scale: 2 }).default('10'),
  paymentBookingTiming: varchar('paymentBookingTiming', { length: 255 }).default('عند التوقيع'),
  paymentConstructionPct: decimal('paymentConstructionPct', { precision: 5, scale: 2 }).default('60'),
  paymentConstructionTiming: varchar('paymentConstructionTiming', { length: 255 }).default('أثناء الإنشاء'),
  paymentHandoverPct: decimal('paymentHandoverPct', { precision: 5, scale: 2 }).default('30'),
  paymentHandoverTiming: varchar('paymentHandoverTiming', { length: 255 }).default('عند التسليم'),
  paymentDeferredPct: decimal('paymentDeferredPct', { precision: 5, scale: 2 }).default('0'),
  paymentDeferredTiming: varchar('paymentDeferredTiming', { length: 255 }),

  // === السيناريو النشط (للعرض) ===
  activeScenario: varchar('activeScenario', { length: 20 }).default('base'), // 'optimistic' | 'base' | 'conservative'

  // === حالة الاعتماد ===
  isApproved: int('isApproved').default(0).notNull(),
  approvedAt: timestamp('approvedAt'),

  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type CompetitionPricing = typeof competitionPricing.$inferSelect;
export type InsertCompetitionPricing = typeof competitionPricing.$inferInsert;


// ═══════════════════════════════════════════
// التكاليف والتدفقات النقدية
// ═══════════════════════════════════════════
export const costsCashFlow = mysqlTable('costs_cash_flow', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id),
  userId: int('userId').notNull().references(() => users.id),

  // === تكاليف الأرض ===
  landPrice: int('landPrice').default(0),
  agentCommissionLandPct: decimal('agentCommissionLandPct', { precision: 5, scale: 2 }).default("1"),
  landRegistrationPct: decimal('landRegistrationPct', { precision: 5, scale: 2 }).default("4"),

  // === تكاليف ما قبل البناء ===
  soilInvestigation: int('soilInvestigation').default(0),
  topographySurvey: int('topographySurvey').default(0),
  designFeePct: decimal('designFeePct', { precision: 5, scale: 2 }).default("2"),
  supervisionFeePct: decimal('supervisionFeePct', { precision: 5, scale: 2 }).default("2"),
  authoritiesFee: int('authoritiesFee').default(0),
  separationFeePerM2: int('separationFeePerM2').default(40),

  // === تكاليف البناء ===
  constructionCostPerSqft: int('constructionCostPerSqft').default(0),
  communityFee: int('communityFee').default(0),
  contingenciesPct: decimal('contingenciesPct', { precision: 5, scale: 2 }).default("2"),

  // === تكاليف البيع والتسويق ===
  developerFeePct: decimal('developerFeePct', { precision: 5, scale: 2 }).default("5"),
  agentCommissionSalePct: decimal('agentCommissionSalePct', { precision: 5, scale: 2 }).default("5"),
  marketingPct: decimal('marketingPct', { precision: 5, scale: 2 }).default("2"),

  // === رسوم تنظيمية ===
  reraOffplanFee: int('reraOffplanFee').default(150000),
  reraUnitFee: int('reraUnitFee').default(850),
  nocFee: int('nocFee').default(10000),
  escrowFee: int('escrowFee').default(140000),
  bankCharges: int('bankCharges').default(20000),
  surveyorFees: int('surveyorFees').default(12000),
  reraAuditFees: int('reraAuditFees').default(18000),
  reraInspectionFees: int('reraInspectionFees').default(70000),

  // === حصة الأرباح ===
  comoProfitSharePct: decimal('comoProfitSharePct', { precision: 5, scale: 2 }).default("15"),

  // === الجدول الزمني ===
  projectDurationMonths: int('projectDurationMonths').default(36),
  constructionStartMonth: int('constructionStartMonth').default(6),
  constructionDurationMonths: int('constructionDurationMonths').default(24),
  salesStartMonth: int('salesStartMonth').default(1),
  salesDurationMonths: int('salesDurationMonths').default(30),
  salesPhase1Pct: decimal('salesPhase1Pct', { precision: 5, scale: 2 }).default("30"),
  salesPhase2Pct: decimal('salesPhase2Pct', { precision: 5, scale: 2 }).default("40"),
  salesPhase3Pct: decimal('salesPhase3Pct', { precision: 5, scale: 2 }).default("30"),

  // === تقرير جويل الذكي ===
  aiSmartReport: text('aiSmartReport'),
  aiRecommendationsJson: text('aiRecommendationsJson'),

  // === حالة الاعتماد ===
  isApproved: int('isApproved').default(0).notNull(),
  approvedAt: timestamp('approvedAt'),

  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type CostsCashFlow = typeof costsCashFlow.$inferSelect;
export type InsertCostsCashFlow = typeof costsCashFlow.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// مراحل التطوير - Development Stages
// ═══════════════════════════════════════════════════════════════

// عناصر المراحل (المهام)
export const stageItems = mysqlTable('stage_items', {
  id: int('id').autoincrement().primaryKey(),
  projectId: int('projectId').notNull().references(() => projects.id),
  phaseNumber: int('phaseNumber').notNull(), // 2-6
  sectionKey: varchar('sectionKey', { length: 20 }).notNull(), // e.g. "2.1", "3.2"
  itemIndex: int('itemIndex').notNull(), // ترتيب المهمة داخل القسم
  title: text('title').notNull(), // عنوان المهمة
  status: mysqlEnum('status', ['not_started', 'in_progress', 'completed']).default('not_started').notNull(),
  isCustom: boolean('isCustom').default(false).notNull(), // هل هي مهمة مخصصة أضافها المستخدم
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export type StageItem = typeof stageItems.$inferSelect;
export type InsertStageItem = typeof stageItems.$inferInsert;

// مستندات المراحل (الملفات المرفقة)
export const stageDocuments = mysqlTable('stage_documents', {
  id: int('id').autoincrement().primaryKey(),
  stageItemId: int('stageItemId').notNull().references(() => stageItems.id),
  projectId: int('projectId').notNull().references(() => projects.id),
  fileName: varchar('fileName', { length: 500 }).notNull(),
  fileUrl: text('fileUrl').notNull(),
  fileKey: varchar('fileKey', { length: 500 }).notNull(),
  mimeType: varchar('mimeType', { length: 100 }),
  fileSize: int('fileSize'), // bytes
  uploadedAt: timestamp('uploadedAt').defaultNow().notNull(),
});

export type StageDocument = typeof stageDocuments.$inferSelect;
export type InsertStageDocument = typeof stageDocuments.$inferInsert;
