import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, boolean, timestamp, pgEnum, serial, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projectStatusEnum = pgEnum("project_status", ["Pre-study", "Design", "Permits", "Tendering", "Active", "Sales", "Completed", "Completed (Handover)"]);
export const expenseCategoryEnum = pgEnum("expense_category", ["Soft Cost", "Hard Cost"]);
export const walletTypeEnum = pgEnum("wallet_type", ["Wallet_A", "Wallet_B"]);
export const aiDataStatusEnum = pgEnum("ai_data_status", ["Pending", "Approved", "Rejected"]);
export const taskPhaseEnum = pgEnum("task_phase", ["Pre-Construction", "Construction", "Handover"]);
export const knowledgeDomainEnum = pgEnum("knowledge_domain", ["rera_law", "dubai_municipality", "building_codes", "market_prices", "company_context", "project_standards", "general"]);

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  totalGFA: numeric("total_gfa", { precision: 14, scale: 2 }).notNull(),
  sellableArea: numeric("sellable_area", { precision: 14, scale: 2 }).notNull(),
  constructionCostPerSqft: numeric("construction_cost_per_sqft", { precision: 10, scale: 2 }).notNull(),
  status: projectStatusEnum("status").notNull().default("Pre-study"),
  approvedSalePricePerSqft: numeric("approved_sale_price_per_sqft", { precision: 10, scale: 2 }),
  retained5PercentFund: numeric("retained_5_percent_fund", { precision: 16, scale: 2 }).default("0"),
  retentionReleaseDate: timestamp("retention_release_date"),
  completedAt: timestamp("completed_at"),
  plotNumber: text("plot_number"),
  areaCode: text("area_code"),
  titleDeedNumber: text("title_deed_number"),
  ddaNumber: text("dda_number"),
  masterDevRef: text("master_dev_ref"),
  plotAreaSqm: numeric("plot_area_sqm", { precision: 12, scale: 2 }),
  plotAreaSqft: numeric("plot_area_sqft", { precision: 12, scale: 2 }),
  gfaSqm: numeric("gfa_sqm", { precision: 12, scale: 2 }),
  gfaSqft: numeric("gfa_sqft", { precision: 12, scale: 2 }),
  buaSqft: numeric("bua_sqft", { precision: 12, scale: 2 }),
  permittedUse: text("permitted_use"),
  ownershipType: text("ownership_type"),
  subdivisionRestrictions: text("subdivision_restrictions"),
  masterDevName: text("master_dev_name"),
  masterDevAddress: text("master_dev_address"),
  sellerName: text("seller_name"),
  sellerAddress: text("seller_address"),
  buyerName: text("buyer_name"),
  buyerNationality: text("buyer_nationality"),
  buyerPassport: text("buyer_passport"),
  buyerAddress: text("buyer_address"),
  buyerPhone: text("buyer_phone"),
  buyerEmail: text("buyer_email"),
  electricityAllocation: text("electricity_allocation"),
  waterAllocation: text("water_allocation"),
  sewageAllocation: text("sewage_allocation"),
  tripAM: text("trip_am"),
  tripLT: text("trip_lt"),
  tripPM: text("trip_pm"),
  effectiveDate: text("effective_date"),
  constructionPeriod: text("construction_period"),
  constructionStartDate: text("construction_start_date"),
  completionDate: text("completion_date"),
  constructionConditions: text("construction_conditions"),
  saleRestrictions: text("sale_restrictions"),
  resaleConditions: text("resale_conditions"),
  communityCharges: text("community_charges"),
  registrationAuthority: text("registration_authority"),
  adminFee: integer("admin_fee"),
  clearanceFee: integer("clearance_fee"),
  compensationAmount: integer("compensation_amount"),
  governingLaw: text("governing_law"),
  disputeResolution: text("dispute_resolution"),
  notes: text("notes"),
  sellableAreaResidential: numeric("sellable_area_residential", { precision: 14, scale: 2 }),
  sellableAreaRetail: numeric("sellable_area_retail", { precision: 14, scale: 2 }),
  sellableAreaOffices: numeric("sellable_area_offices", { precision: 14, scale: 2 }),
  unitsResidential: integer("units_residential"),
  unitsRetail: integer("units_retail"),
  unitsOffices: integer("units_offices"),
  landPrice: numeric("land_price", { precision: 16, scale: 2 }),
  agentCommissionLandPct: numeric("agent_commission_land_pct", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  type: walletTypeEnum("type").notNull(),
  label: text("label").notNull(),
  balance: numeric("balance", { precision: 16, scale: 2 }).notNull().default("0"),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  category: expenseCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
  consultantCertificateApproved: boolean("consultant_certificate_approved").default(false),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiMarketData = pgTable("ai_market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  dataType: text("data_type").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
  previousValue: numeric("previous_value", { precision: 14, scale: 2 }),
  unit: text("unit").notNull().default("AED/sqft"),
  source: text("source").notNull().default("AI Agent"),
  insight: text("insight").notNull(),
  impactDescription: text("impact_description"),
  status: aiDataStatusEnum("status").notNull().default("Pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const constructionMilestones = pgTable("construction_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  milestoneName: text("milestone_name").notNull(),
  targetPercentage: numeric("target_percentage", { precision: 5, scale: 2 }).notNull(),
  consultantCertificateAttached: boolean("consultant_certificate_attached").notNull().default(false),
  approvedReleaseAmount: numeric("approved_release_amount", { precision: 16, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  phase: taskPhaseEnum("phase").notNull(),
  taskName: text("task_name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  amountAed: numeric("amount_aed", { precision: 16, scale: 2 }).notNull().default("0"),
  walletSource: walletTypeEnum("wallet_source").notNull(),
  isRevenue: boolean("is_revenue").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feasibilityStudies = pgTable("feasibility_studies", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").references(() => projects.id),
  projectName: text("project_name").notNull(),
  community: text("community"),
  plotNumber: text("plot_number"),
  projectDescription: text("project_description"),
  landUse: text("land_use"),
  plotArea: integer("plot_area"),
  gfaResidential: integer("gfa_residential"),
  gfaRetail: integer("gfa_retail"),
  gfaOffices: integer("gfa_offices"),
  totalGfa: integer("total_gfa"),
  saleableResidential: integer("saleable_residential"),
  saleableRetail: integer("saleable_retail"),
  saleableResidentialPct: integer("saleable_residential_pct").default(90),
  saleableRetailPct: integer("saleable_retail_pct").default(99),
  saleableOfficesPct: integer("saleable_offices_pct").default(90),
  estimatedConstructionArea: integer("estimated_construction_area"),
  numberOfUnits: integer("number_of_units"),
  landPrice: integer("land_price"),
  agentCommissionLandPct: integer("agent_commission_land_pct").default(1),
  soilInvestigation: integer("soil_investigation"),
  authoritiesFee: integer("authorities_fee"),
  constructionCostPerSqft: integer("construction_cost_per_sqft"),
  designFeePct: integer("design_fee_pct").default(2),
  supervisionFeePct: integer("supervision_fee_pct").default(2),
  contingenciesPct: integer("contingencies_pct").default(2),
  developerFeePct: integer("developer_fee_pct").default(5),
  agentCommissionSalePct: integer("agent_commission_sale_pct").default(5),
  marketingPct: integer("marketing_pct").default(2),
  reraOffplanFee: integer("rera_offplan_fee").default(150000),
  reraUnitFee: integer("rera_unit_fee").default(850),
  nocFee: integer("noc_fee").default(10000),
  escrowFee: integer("escrow_fee").default(140000),
  topographySurvey: integer("topography_survey").default(15000),
  bankCharges: integer("bank_charges").default(25000),
  communityFee: integer("community_fee").default(50000),
  surveyorFees: integer("surveyor_fees").default(30000),
  reraAuditReports: integer("rera_audit_reports").default(50000),
  reraInspectionReports: integer("rera_inspection_reports").default(50000),
  residentialSalePrice: integer("residential_sale_price"),
  retailSalePrice: integer("retail_sale_price"),
  officesSalePrice: integer("offices_sale_price"),
  profitSharePct: integer("profit_share_pct").default(15),
  res1brPct: integer("res_1br_pct").default(0),
  res2brPct: integer("res_2br_pct").default(0),
  res3brPct: integer("res_3br_pct").default(0),
  res1brAvgSize: integer("res_1br_avg_size").default(750),
  res2brAvgSize: integer("res_2br_avg_size").default(1100),
  res3brAvgSize: integer("res_3br_avg_size").default(1500),
  shopSmallPct: integer("shop_small_pct").default(0),
  shopMediumPct: integer("shop_medium_pct").default(0),
  shopLargePct: integer("shop_large_pct").default(0),
  shopSmallAvgSize: integer("shop_small_avg_size").default(300),
  shopMediumAvgSize: integer("shop_medium_avg_size").default(600),
  shopLargeAvgSize: integer("shop_large_avg_size").default(1200),
  finishesQuality: text("finishes_quality"),
  pricingScenarios: text("pricing_scenarios"),
  approvedScenario: integer("approved_scenario"),
  scenarioName: text("scenario_name"),
  notes: text("notes"),
  reportExecutiveSummary: text("report_executive_summary"),
  reportMarketStudy: text("report_market_study"),
  reportLocationAnalysis: text("report_location_analysis"),
  reportRiskAnalysis: text("report_risk_analysis"),
  reportSensitivityAnalysis: text("report_sensitivity_analysis"),
  reportLegalCompliance: text("report_legal_compliance"),
  reportRecommendations: text("report_recommendations"),
  reportCompetitiveAnalysis: text("report_competitive_analysis"),
  competitivePricingFields: text("competitive_pricing_fields"),
  reportProductStrategy: text("report_product_strategy"),
  reportPricingStrategy: text("report_pricing_strategy"),
  reportAbsorptionForecast: text("report_absorption_forecast"),
  reportCashFlowProjection: text("report_cash_flow_projection"),
  reportJvSensitivity: text("report_jv_sensitivity"),
  reportRiskQuant: text("report_risk_quant"),
  reportExecutiveBrief: text("report_executive_brief"),
  reportExitStrategy: text("report_exit_strategy"),
  reportBoardSummary: text("report_board_summary"),
  reportDevelopmentCost: text("report_development_cost"),
  reportStatus: text("report_status").default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgetCategoryEnum = pgEnum("budget_category", [
  "land_costs",
  "design_consultancy",
  "government_fees",
  "construction",
  "rera_registration",
  "marketing_sales",
  "financial_admin"
]);

export const projectBudgetItems = pgTable("project_budget_items", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  category: budgetCategoryEnum("category").notNull(),
  itemKey: text("item_key").notNull(),
  labelEn: text("label_en").notNull(),
  labelAr: text("label_ar").notNull(),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull().default("0"),
  percentage: numeric("percentage", { precision: 6, scale: 2 }),
  percentageBase: text("percentage_base"),
  sortOrder: integer("sort_order").notNull().default(0),
  isAutoCalculated: boolean("is_auto_calculated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  domain: knowledgeDomainEnum("domain").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  keywords: text("keywords"),
  source: text("source"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatHistory = pgTable("chat_history", {
  id: serial("id").primaryKey(),
  agent: text("agent").notNull().default("salwa"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const consultants = pgTable("consultants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  specialization: text("specialization"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectConsultants = pgTable("project_consultants", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  consultantId: integer("consultant_id").notNull().references(() => consultants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evaluatorScores = pgTable("evaluator_scores", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  consultantId: integer("consultant_id").notNull().references(() => consultants.id, { onDelete: "cascade" }),
  evaluatorId: text("evaluator_id").notNull(),
  criterionId: integer("criterion_id").notNull(),
  score: integer("score").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const consultantFinancials = pgTable("consultant_financials", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  consultantId: integer("consultant_id").notNull().references(() => consultants.id, { onDelete: "cascade" }),
  designType: text("design_type").default("pct"),
  designValue: numeric("design_value", { precision: 12, scale: 2 }).default("0"),
  supervisionType: text("supervision_type").default("pct"),
  supervisionValue: numeric("supervision_value", { precision: 12, scale: 2 }).default("0"),
  proposalLink: text("proposal_link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const committeeDecisions = pgTable("committee_decisions", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  selectedConsultantId: integer("selected_consultant_id").references(() => consultants.id),
  decisionType: text("decision_type"),
  decisionBasis: text("decision_basis"),
  justification: text("justification"),
  negotiationTarget: text("negotiation_target"),
  negotiationConditions: text("negotiation_conditions"),
  committeeNotes: text("committee_notes"),
  aiAnalysis: text("ai_analysis"),
  aiRecommendation: text("ai_recommendation"),
  aiPostDecisionAnalysis: text("ai_post_decision_analysis"),
  isConfirmed: boolean("is_confirmed").default(false),
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: text("confirmed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiAdvisoryScores = pgTable("ai_advisory_scores", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  consultantId: integer("consultant_id").notNull().references(() => consultants.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").notNull(),
  suggestedScore: integer("suggested_score"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export * from "./models/chat";

export const insertConsultantSchema = createInsertSchema(consultants).omit({ id: true, createdAt: true });
export type InsertConsultant = z.infer<typeof insertConsultantSchema>;
export type Consultant = typeof consultants.$inferSelect;

export const insertProjectConsultantSchema = createInsertSchema(projectConsultants).omit({ id: true, createdAt: true });
export type InsertProjectConsultant = z.infer<typeof insertProjectConsultantSchema>;
export type ProjectConsultant = typeof projectConsultants.$inferSelect;

export const insertEvaluatorScoreSchema = createInsertSchema(evaluatorScores).omit({ id: true, createdAt: true });
export type InsertEvaluatorScore = z.infer<typeof insertEvaluatorScoreSchema>;
export type EvaluatorScore = typeof evaluatorScores.$inferSelect;

export const insertConsultantFinancialSchema = createInsertSchema(consultantFinancials).omit({ id: true, createdAt: true });
export type InsertConsultantFinancial = z.infer<typeof insertConsultantFinancialSchema>;
export type ConsultantFinancial = typeof consultantFinancials.$inferSelect;

export const insertCommitteeDecisionSchema = createInsertSchema(committeeDecisions).omit({ id: true, createdAt: true, confirmedAt: true });
export type InsertCommitteeDecision = z.infer<typeof insertCommitteeDecisionSchema>;
export type CommitteeDecision = typeof committeeDecisions.$inferSelect;

export const insertAiAdvisoryScoreSchema = createInsertSchema(aiAdvisoryScores).omit({ id: true, createdAt: true });
export type InsertAiAdvisoryScore = z.infer<typeof insertAiAdvisoryScoreSchema>;
export type AiAdvisoryScore = typeof aiAdvisoryScores.$inferSelect;

export const wbsItems = pgTable("wbs_items", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull(),
  level: integer("level").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  parentId: integer("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  owner: text("owner"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWbsItemSchema = createInsertSchema(wbsItems).omit({ id: true, createdAt: true });
export type InsertWbsItem = z.infer<typeof insertWbsItemSchema>;
export type WbsItem = typeof wbsItems.$inferSelect;

export const stageItems = pgTable("stage_items", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull(),
  phase: text("phase").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  code: text("code"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  requiredDocs: text("required_docs"),
  requiredDocsAr: text("required_docs_ar"),
  owner: text("owner"),
  plannedStartDate: text("planned_start_date"),
  plannedEndDate: text("planned_end_date"),
  href: text("href"),
  status: text("status").notNull().default("not_started"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  isSystem: boolean("is_system").notNull().default(false),
  isBoardLevel: boolean("is_board_level").notNull().default(false),
  cashOutflow: numeric("cash_outflow", { precision: 16, scale: 2 }).notNull().default("0"),
  cashInflow: numeric("cash_inflow", { precision: 16, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStageItemSchema = createInsertSchema(stageItems).omit({ id: true, createdAt: true });
export type InsertStageItem = z.infer<typeof insertStageItemSchema>;
export type StageItem = typeof stageItems.$inferSelect;

export const cashFlowSourceEnum = pgEnum("cash_flow_source", ["equity", "bank_finance", "sales", "other"]);
export const cashFlowTypeEnum = pgEnum("cash_flow_type", ["outflow", "inflow"]);

export const projectCashFlows = pgTable("project_cash_flows", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  month: text("month").notNull(),
  type: cashFlowTypeEnum("type").notNull(),
  source: cashFlowSourceEnum("source").notNull(),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull().default("0"),
  description: text("description"),
  category: text("category"),
  linkedActivityId: integer("linked_activity_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectFinancials = pgTable("project_financials", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  totalProjectCost: numeric("total_project_cost", { precision: 16, scale: 2 }).notNull().default("0"),
  equityRequired: numeric("equity_required", { precision: 16, scale: 2 }).notNull().default("0"),
  bankFinance: numeric("bank_finance", { precision: 16, scale: 2 }).notNull().default("0"),
  salesTarget: numeric("sales_target", { precision: 16, scale: 2 }).notNull().default("0"),
  projectDurationMonths: integer("project_duration_months").default(30),
  salesDelayMonths: integer("sales_delay_months").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentStatusEnum = pgEnum("agent_status", ["active", "coming_soon", "disabled"]);
export const agentTaskStatusEnum = pgEnum("agent_task_status", ["queued", "in_progress", "completed", "failed", "cancelled"]);

export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  roleEn: text("role_en").notNull(),
  roleAr: text("role_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  avatarUrl: text("avatar_url"),
  avatarColor: text("avatar_color").notNull().default("#F59E0B"),
  avatarInitial: text("avatar_initial").notNull().default("A"),
  systemPrompt: text("system_prompt"),
  toolIds: text("tool_ids").array(),
  capabilities: text("capabilities").array(),
  status: agentStatusEnum("status").notNull().default("coming_soon"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentTasks = pgTable("agent_tasks", {
  id: serial("id").primaryKey(),
  fromAgentId: varchar("from_agent_id").references(() => aiAgents.id),
  toAgentId: varchar("to_agent_id").notNull().references(() => aiAgents.id),
  projectId: varchar("project_id").references(() => projects.id),
  taskType: text("task_type").notNull(),
  title: text("title").notNull(),
  payload: text("payload"),
  result: text("result"),
  status: agentTaskStatusEnum("status").notNull().default("queued"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({ createdAt: true });
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;

export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({ id: true, createdAt: true, completedAt: true });
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type AgentTask = typeof agentTasks.$inferSelect;

export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected", "needs_info"]);
export const requestTypeEnum = pgEnum("request_type", ["consultant", "contractor", "financing", "pricing", "budget", "schedule", "other"]);
export const directiveTypeEnum = pgEnum("directive_type", ["inquiry", "report_request", "instruction", "other"]);

export const approvalRequests = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").references(() => projects.id),
  type: requestTypeEnum("type").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation"),
  status: requestStatusEnum("status").notNull().default("pending"),
  responseNote: text("response_note"),
  respondedBy: text("responded_by"),
  respondedAt: timestamp("responded_at"),
  createdBy: text("created_by").notNull().default("developer_director"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadershipDirectives = pgTable("leadership_directives", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").references(() => projects.id),
  type: directiveTypeEnum("type").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  reply: text("reply"),
  repliedAt: timestamp("replied_at"),
  status: text("status").notNull().default("open"),
  createdBy: text("created_by").notNull().default("ceo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApprovalRequestSchema = createInsertSchema(approvalRequests).omit({ id: true, createdAt: true, respondedAt: true });
export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;

export const insertLeadershipDirectiveSchema = createInsertSchema(leadershipDirectives).omit({ id: true, createdAt: true, repliedAt: true });
export type InsertLeadershipDirective = z.infer<typeof insertLeadershipDirectiveSchema>;
export type LeadershipDirective = typeof leadershipDirectives.$inferSelect;

export const insertProjectCashFlowSchema = createInsertSchema(projectCashFlows).omit({ id: true, createdAt: true });
export type InsertProjectCashFlow = z.infer<typeof insertProjectCashFlowSchema>;
export type ProjectCashFlow = typeof projectCashFlows.$inferSelect;

export const insertProjectFinancialSchema = createInsertSchema(projectFinancials).omit({ id: true, createdAt: true });
export type InsertProjectFinancial = z.infer<typeof insertProjectFinancialSchema>;
export type ProjectFinancial = typeof projectFinancials.$inferSelect;

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, approvedSalePricePerSqft: true, retained5PercentFund: true, retentionReleaseDate: true, completedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true, status: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const insertAiMarketDataSchema = createInsertSchema(aiMarketData).omit({ id: true, createdAt: true, status: true });
export type InsertAiMarketData = z.infer<typeof insertAiMarketDataSchema>;
export type AiMarketData = typeof aiMarketData.$inferSelect;

export const insertMilestoneSchema = createInsertSchema(constructionMilestones).omit({ id: true, createdAt: true, status: true, completedAt: true });
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type ConstructionMilestone = typeof constructionMilestones.$inferSelect;

export const insertProjectTaskSchema = createInsertSchema(projectTasks).omit({ id: true, createdAt: true });
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type ProjectTask = typeof projectTasks.$inferSelect;

export const insertFeasibilityStudySchema = createInsertSchema(feasibilityStudies).omit({ id: true, createdAt: true });
export type InsertFeasibilityStudy = z.infer<typeof insertFeasibilityStudySchema>;
export type FeasibilityStudy = typeof feasibilityStudies.$inferSelect;

export const insertBudgetItemSchema = createInsertSchema(projectBudgetItems).omit({ id: true, createdAt: true });
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
export type ProjectBudgetItem = typeof projectBudgetItems.$inferSelect;

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({ id: true, createdAt: true });
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBaseItem = typeof knowledgeBase.$inferSelect;

export const insertChatHistorySchema = createInsertSchema(chatHistory).omit({ id: true, createdAt: true });
export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;
export type ChatHistoryItem = typeof chatHistory.$inferSelect;

export const reportVersionStatusEnum = pgEnum("report_version_status", ["draft", "governed", "board_issue"]);
export const riskLevelEnum = pgEnum("risk_level", ["green", "yellow", "red"]);
export const boardRecommendationEnum = pgEnum("board_recommendation", ["go", "go_with_adjustment", "hold", "no_go"]);
export const inquiryStatusEnum = pgEnum("inquiry_status", ["open", "answered", "escalated"]);

export const reportVersions = pgTable("report_versions", {
  id: serial("id").primaryKey(),
  feasibilityStudyId: integer("feasibility_study_id").notNull().references(() => feasibilityStudies.id),
  projectId: varchar("project_id").references(() => projects.id),
  versionNumber: text("version_number").notNull(),
  versionStatus: reportVersionStatusEnum("version_status").notNull().default("draft"),
  gdv: numeric("gdv", { precision: 16, scale: 2 }),
  tdc: numeric("tdc", { precision: 16, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 16, scale: 2 }),
  profitMarginPct: numeric("profit_margin_pct", { precision: 8, scale: 2 }),
  projectIrr: numeric("project_irr", { precision: 8, scale: 2 }),
  equityIrr: numeric("equity_irr", { precision: 8, scale: 2 }),
  expectedSalesDuration: text("expected_sales_duration"),
  fundingGap: numeric("funding_gap", { precision: 16, scale: 2 }),
  riskLevel: riskLevelEnum("risk_level").default("yellow"),
  recommendation: boardRecommendationEnum("recommendation"),
  requiredAction: text("required_action"),
  reportSnapshot: text("report_snapshot"),
  technicalValidation: text("technical_validation"),
  financialValidation: text("financial_validation"),
  legalValidation: text("legal_validation"),
  validatedBy: text("validated_by"),
  validatedAt: timestamp("validated_at"),
  issuedAt: timestamp("issued_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commandCenterInquiries = pgTable("command_center_inquiries", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").references(() => projects.id),
  senderRole: text("sender_role").notNull(),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  response: text("response"),
  respondedBy: text("responded_by"),
  status: inquiryStatusEnum("status").notNull().default("open"),
  escalatedToOwner: boolean("escalated_to_owner").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export const insertReportVersionSchema = createInsertSchema(reportVersions).omit({ id: true, createdAt: true, validatedAt: true, issuedAt: true });
export type InsertReportVersion = z.infer<typeof insertReportVersionSchema>;
export type ReportVersion = typeof reportVersions.$inferSelect;

export const insertCommandCenterInquirySchema = createInsertSchema(commandCenterInquiries).omit({ id: true, createdAt: true, respondedAt: true });
export type InsertCommandCenterInquiry = z.infer<typeof insertCommandCenterInquirySchema>;
export type CommandCenterInquiry = typeof commandCenterInquiries.$inferSelect;

export const sourceTierEnum = pgEnum("source_tier", ["tier1_official", "tier2_primary", "tier3_professional", "tier4_listings", "tier5_macro"]);
export const accessMethodEnum = pgEnum("access_method", ["manual_file", "drive_sync", "api", "scrape"]);
export const confidenceLevelEnum = pgEnum("confidence_level", ["high", "medium", "low"]);
export const scenarioTypeEnum = pgEnum("scenario_type", ["base", "optimistic", "conservative", "custom"]);
export const conflictStatusEnum = pgEnum("conflict_status", ["unresolved", "resolved_auto", "resolved_owner"]);

export const sourceRegistry = pgTable("source_registry", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: sourceTierEnum("tier").notNull(),
  accessMethod: accessMethodEnum("access_method").notNull().default("manual_file"),
  url: text("url"),
  description: text("description"),
  fieldsProvided: text("fields_provided").array(),
  refreshCadence: text("refresh_cadence"),
  licenseNotes: text("license_notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectAssumptions = pgTable("project_assumptions", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
  units: text("units"),
  previousValue: text("previous_value"),
  ownerApproved: boolean("owner_approved").default(false).notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rationale: text("rationale"),
  sourceId: integer("source_id").references(() => sourceRegistry.id),
  joelleSuggested: boolean("joelle_suggested").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectScenarios = pgTable("project_scenarios", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  feasibilityStudyId: integer("feasibility_study_id").references(() => feasibilityStudies.id),
  scenarioType: scenarioTypeEnum("scenario_type").notNull().default("base"),
  name: text("name").notNull(),
  constructionCostAdj: numeric("construction_cost_adj", { precision: 8, scale: 2 }).default("0"),
  salePriceAdj: numeric("sale_price_adj", { precision: 8, scale: 2 }).default("0"),
  absorptionAdj: numeric("absorption_adj", { precision: 8, scale: 2 }).default("0"),
  gdv: numeric("gdv", { precision: 16, scale: 2 }),
  tdc: numeric("tdc", { precision: 16, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 16, scale: 2 }),
  roi: numeric("roi", { precision: 8, scale: 2 }),
  irr: numeric("irr", { precision: 8, scale: 2 }),
  equityIrr: numeric("equity_irr", { precision: 8, scale: 2 }),
  peakCashNeed: numeric("peak_cash_need", { precision: 16, scale: 2 }),
  fundingGap: numeric("funding_gap", { precision: 16, scale: 2 }),
  salesDurationMonths: integer("sales_duration_months"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conflictRecords = pgTable("conflict_records", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  kpiName: text("kpi_name").notNull(),
  sourceAId: integer("source_a_id").references(() => sourceRegistry.id),
  sourceBId: integer("source_b_id").references(() => sourceRegistry.id),
  sourceAValue: text("source_a_value").notNull(),
  sourceBValue: text("source_b_value").notNull(),
  deltaPct: numeric("delta_pct", { precision: 8, scale: 2 }),
  resolvedValue: text("resolved_value"),
  resolution: conflictStatusEnum("resolution").notNull().default("unresolved"),
  rationale: text("rationale"),
  confidence: confidenceLevelEnum("confidence"),
  confidenceScore: integer("confidence_score"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").references(() => projects.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  performedBy: text("performed_by").notNull().default("system"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSourceRegistrySchema = createInsertSchema(sourceRegistry).omit({ id: true, createdAt: true });
export type InsertSourceRegistry = z.infer<typeof insertSourceRegistrySchema>;
export type SourceRegistryItem = typeof sourceRegistry.$inferSelect;

export const insertProjectAssumptionSchema = createInsertSchema(projectAssumptions).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertProjectAssumption = z.infer<typeof insertProjectAssumptionSchema>;
export type ProjectAssumption = typeof projectAssumptions.$inferSelect;

export const insertProjectScenarioSchema = createInsertSchema(projectScenarios).omit({ id: true, createdAt: true });
export type InsertProjectScenario = z.infer<typeof insertProjectScenarioSchema>;
export type ProjectScenario = typeof projectScenarios.$inferSelect;

export const insertConflictRecordSchema = createInsertSchema(conflictRecords).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertConflictRecord = z.infer<typeof insertConflictRecordSchema>;
export type ConflictRecord = typeof conflictRecords.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;

export const confidenceGradeEnum = pgEnum("confidence_grade", ["A", "B", "C"]);
export const competitorStatusEnum = pgEnum("competitor_status", ["launched", "under_construction", "ready", "sold_out"]);
export const documentTypeEnum = pgEnum("document_type", ["csv", "pdf", "brochure", "screenshot", "excel", "other"]);
export const datasetTypeEnum = pgEnum("dataset_type", ["transactions", "rents", "projects", "listings", "competitor", "macro", "research", "other"]);

export const reconciliationLedger = pgTable("reconciliation_ledger", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  metricId: text("metric_id").notNull(),
  metricName: text("metric_name").notNull(),
  metricDefinition: text("metric_definition"),
  geoBoundaryId: text("geo_boundary_id"),
  windowStart: text("window_start"),
  windowEnd: text("window_end"),
  sourceAName: text("source_a_name").notNull(),
  sourceAFile: text("source_a_file"),
  sourceAValue: text("source_a_value").notNull(),
  sourceBName: text("source_b_name").notNull(),
  sourceBFile: text("source_b_file"),
  sourceBValue: text("source_b_value").notNull(),
  variancePct: numeric("variance_pct", { precision: 8, scale: 2 }),
  weightsApplied: text("weights_applied"),
  decisionValue: text("decision_value"),
  confidenceGrade: confidenceGradeEnum("confidence_grade").notNull().default("B"),
  exceptionNotes: text("exception_notes"),
  ownersApprovalRequired: boolean("owners_approval_required").default(false),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const competitorProjects = pgTable("competitor_projects", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  competitorName: text("competitor_name").notNull(),
  developerName: text("developer_name").notNull(),
  microLocation: text("micro_location"),
  status: competitorStatusEnum("status").default("launched"),
  launchDate: text("launch_date"),
  handoverDate: text("handover_date"),
  totalUnits: integer("total_units"),
  unitMixStudioPct: integer("unit_mix_studio_pct").default(0),
  unitMix1brPct: integer("unit_mix_1br_pct").default(0),
  unitMix2brPct: integer("unit_mix_2br_pct").default(0),
  unitMix3brPct: integer("unit_mix_3br_pct").default(0),
  avgUnitSizeSqm: numeric("avg_unit_size_sqm", { precision: 10, scale: 2 }),
  avgPricePsf: numeric("avg_price_psf", { precision: 10, scale: 2 }),
  priceRangeLow: numeric("price_range_low", { precision: 10, scale: 2 }),
  priceRangeHigh: numeric("price_range_high", { precision: 10, scale: 2 }),
  paymentPlanSummary: text("payment_plan_summary"),
  incentivesSummary: text("incentives_summary"),
  salesVelocity: integer("sales_velocity"),
  evidenceFiles: text("evidence_files"),
  sourceSystem: text("source_system"),
  confidenceGrade: confidenceGradeEnum("confidence_grade_comp").default("B"),
  lastVerifiedDate: text("last_verified_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectDocuments = pgTable("project_documents", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  stageItemId: integer("stage_item_id"),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  documentType: documentTypeEnum("document_type").notNull().default("other"),
  sourceSystem: text("source_system"),
  datasetType: datasetTypeEnum("dataset_type"),
  checksum: text("checksum"),
  uploadedBy: text("uploaded_by").default("owner"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReconciliationLedgerSchema = createInsertSchema(reconciliationLedger).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertReconciliationLedger = z.infer<typeof insertReconciliationLedgerSchema>;
export type ReconciliationLedgerEntry = typeof reconciliationLedger.$inferSelect;

export const insertCompetitorProjectSchema = createInsertSchema(competitorProjects).omit({ id: true, createdAt: true });
export type InsertCompetitorProject = z.infer<typeof insertCompetitorProjectSchema>;
export type CompetitorProject = typeof competitorProjects.$inferSelect;

export const insertProjectDocumentSchema = createInsertSchema(projectDocuments).omit({ id: true, createdAt: true });
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;
export type ProjectDocument = typeof projectDocuments.$inferSelect;

export const capitalEventTypeEnum = pgEnum("capital_event_type", [
  "EQUITY_INJECT", "ESCROW_DEPOSIT", "ESCROW_RELEASE", "BURN_PAYMENT",
  "RETENTION_HOLD", "RETENTION_RELEASE", "VO_COST", "SALES_RECEIPT"
]);

export const capitalStateEnum = pgEnum("capital_state", ["C1", "C2", "C3", "C4", "C5"]);

export const lifecycleStateEnum = pgEnum("lifecycle_state", [
  "S0_ACTIVATED", "S1_CONSULTANTS_PROCURED", "S2_DESIGN_IN_PROGRESS",
  "S3_REGULATORY_IN_PROGRESS", "S4_READY_FOR_TENDER", "S5_TENDER_IN_PROGRESS",
  "S6_CONTRACT_AWARDED", "S7_SALES_READY", "S8_SALES_ACTIVE",
  "S9_CONSTRUCTION_ACTIVE", "S10_NEAR_COMPLETION", "S11_HANDOVER",
  "S12_OA_TRANSFER", "S13_DLP_ACTIVE", "S14_CLOSED"
]);

export const regulatoryNodeTypeEnum = pgEnum("regulatory_node_type", [
  "DLD_TITLE", "RERA_DEV_REG", "ESCROW_OPENING", "QS_TCC_CERT",
  "MUNICIPALITY_PLANNING", "BUILDING_PERMIT", "CIVIL_DEFENSE",
  "DEWA_NOC", "MASTER_DEV_NOC", "OQOOD_ACTIVATION",
  "PROJECT_REG_RERA", "COMPLETION_CERT", "UNIT_TITLE_ISSUANCE"
]);

export const regulatoryStatusEnum = pgEnum("regulatory_status", [
  "NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED"
]);

export const ipcStatusEnum = pgEnum("ipc_status", [
  "DRAFT", "SUBMITTED", "REVIEWED", "APPROVED", "PAID", "DISPUTED"
]);

export const voTypeEnum = pgEnum("vo_type", ["VO_A_DEVELOPER", "VO_B_AUTHORITY", "VO_C_CONTRACTOR"]);

export const voStatusEnum = pgEnum("vo_status", [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "IMPLEMENTED"
]);

export const projectRiskLevelEnum = pgEnum("project_risk_level", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const gateStatusEnum = pgEnum("gate_status", ["PENDING", "PASSED", "FAILED", "OVERRIDDEN"]);

export const contractStatusEnum = pgEnum("contract_status", [
  "DRAFT", "TENDERING", "AWARDED", "ACTIVE", "COMPLETED", "TERMINATED"
]);

export const unitStatusEnum = pgEnum("unit_status", [
  "AVAILABLE", "RESERVED", "SOLD", "HANDED_OVER", "CANCELLED"
]);

export const dependencyTypeEnum = pgEnum("dependency_type", ["REQUIRED", "RECOMMENDED"]);

export const capitalEvents = pgTable("capital_events", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  eventType: capitalEventTypeEnum("event_type").notNull(),
  amount: integer("amount").notNull(),
  fromState: capitalStateEnum("from_state"),
  toState: capitalStateEnum("to_state"),
  description: text("description"),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  createdBy: text("created_by").default("system"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const capitalBalances = pgTable("capital_balances", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  c1FreeEquity: integer("c1_free_equity").default(0).notNull(),
  c2CommittedEquity: integer("c2_committed_equity").default(0).notNull(),
  c3EscrowLocked: integer("c3_escrow_locked").default(0).notNull(),
  c4DeployedBurn: integer("c4_deployed_burn").default(0).notNull(),
  c5RetentionHeld: integer("c5_retention_held").default(0).notNull(),
  liquidityReal: integer("liquidity_real").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectStateTransitions = pgTable("project_state_transitions", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  fromState: lifecycleStateEnum("from_state"),
  toState: lifecycleStateEnum("to_state").notNull(),
  triggeredBy: text("triggered_by").default("system"),
  reason: text("reason"),
  gatesPassed: text("gates_passed").array(),
  capitalSnapshot: jsonb("capital_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const regulatoryNodes = pgTable("regulatory_nodes", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  nodeType: regulatoryNodeTypeEnum("node_type").notNull(),
  status: regulatoryStatusEnum("status").default("NOT_STARTED").notNull(),
  documentRef: text("document_ref"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

export const regulatoryDependencies = pgTable("regulatory_dependencies", {
  id: serial("id").primaryKey(),
  nodeId: integer("node_id").notNull().references(() => regulatoryNodes.id),
  dependsOnNodeId: integer("depends_on_node_id").notNull().references(() => regulatoryNodes.id),
  dependencyType: dependencyTypeEnum("dependency_type").default("REQUIRED").notNull(),
});

export const ipcs = pgTable("ipcs", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  contractId: integer("contract_id"),
  ipcNumber: integer("ipc_number").notNull(),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  grossCertifiedValue: integer("gross_certified_value").notNull(),
  retentionDeduction: integer("retention_deduction").default(0).notNull(),
  advanceRecovery: integer("advance_recovery").default(0),
  penalties: integer("penalties").default(0),
  netPayable: integer("net_payable").notNull(),
  physicalProgress: integer("physical_progress").default(0).notNull(),
  status: ipcStatusEnum("status").default("DRAFT").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const variationOrders = pgTable("variation_orders", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  contractId: integer("contract_id"),
  voNumber: text("vo_number").notNull(),
  voType: voTypeEnum("vo_type").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  estimatedCost: integer("estimated_cost").default(0),
  approvedCost: integer("approved_cost"),
  status: voStatusEnum("status").default("DRAFT").notNull(),
  impactOnTCC: integer("impact_on_tcc").default(0),
  impactOnScheduleDays: integer("impact_on_schedule_days").default(0),
  cumulativeVOPercent: numeric("cumulative_vo_percent", { precision: 6, scale: 3 }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskScores = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  liquidityRisk: numeric("liquidity_risk", { precision: 6, scale: 3 }).default("0"),
  salesRisk: numeric("sales_risk", { precision: 6, scale: 3 }).default("0"),
  constructionRisk: numeric("construction_risk", { precision: 6, scale: 3 }).default("0"),
  regulatoryRisk: numeric("regulatory_risk", { precision: 6, scale: 3 }).default("0"),
  portfolioRisk: numeric("portfolio_risk", { precision: 6, scale: 3 }).default("0"),
  totalRisk: numeric("total_risk", { precision: 6, scale: 3 }).default("0"),
  lsr: numeric("lsr", { precision: 6, scale: 3 }),
  ecr: numeric("ecr", { precision: 6, scale: 3 }),
  riskLevel: projectRiskLevelEnum("risk_level_project").default("LOW").notNull(),
  signals: jsonb("signals"),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
});

export const portfolioMetrics = pgTable("portfolio_metrics", {
  id: serial("id").primaryKey(),
  totalFreeEquity: integer("total_free_equity").default(0).notNull(),
  totalCommitted: integer("total_committed").default(0).notNull(),
  totalEscrowLocked: integer("total_escrow_locked").default(0).notNull(),
  totalBurned: integer("total_burned").default(0).notNull(),
  totalRetention: integer("total_retention").default(0).notNull(),
  portfolioExposureRatio: numeric("portfolio_exposure_ratio", { precision: 6, scale: 3 }),
  liquidityRunwayMonths: numeric("liquidity_runway_months", { precision: 6, scale: 1 }),
  projectCount: integer("project_count").default(0),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
});

export const governanceGates = pgTable("governance_gates", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  gateCode: text("gate_code").notNull(),
  gateName: text("gate_name").notNull(),
  gateNameAr: text("gate_name_ar"),
  status: gateStatusEnum("status").default("PENDING").notNull(),
  requiredConditions: jsonb("required_conditions"),
  evaluationResult: jsonb("evaluation_result"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  contractorName: text("contractor_name").notNull(),
  contractorNameAr: text("contractor_name_ar"),
  contractType: text("contract_type").notNull(),
  contractValue: integer("contract_value").notNull(),
  retentionPercent: numeric("retention_percent", { precision: 5, scale: 2 }).default("10"),
  performanceBondPercent: numeric("performance_bond_percent", { precision: 5, scale: 2 }).default("10"),
  ldTerms: text("ld_terms"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: contractStatusEnum("status").default("DRAFT").notNull(),
  awardedAt: timestamp("awarded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salesUnits = pgTable("sales_units", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  unitNumber: text("unit_number").notNull(),
  unitType: text("unit_type").notNull(),
  floor: integer("floor").default(0),
  area: numeric("area", { precision: 10, scale: 2 }).notNull(),
  askingPrice: integer("asking_price").default(0),
  status: unitStatusEnum("unit_status").default("AVAILABLE").notNull(),
  buyerName: text("buyer_name"),
  salePrice: integer("sale_price"),
  saleDate: text("sale_date"),
  oqoodRegistered: boolean("oqood_registered").default(false),
  oqoodDate: text("oqood_date"),
  paymentPlanId: integer("payment_plan_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentPlans = pgTable("payment_plans", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  planName: text("plan_name").notNull(),
  planNameAr: text("plan_name_ar"),
  totalAmount: integer("total_amount").notNull(),
  installments: jsonb("installments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCapitalEventSchema = createInsertSchema(capitalEvents).omit({ id: true, createdAt: true });
export type InsertCapitalEvent = z.infer<typeof insertCapitalEventSchema>;
export type CapitalEvent = typeof capitalEvents.$inferSelect;

export const insertCapitalBalanceSchema = createInsertSchema(capitalBalances).omit({ id: true, updatedAt: true });
export type InsertCapitalBalance = z.infer<typeof insertCapitalBalanceSchema>;
export type CapitalBalance = typeof capitalBalances.$inferSelect;

export const insertProjectStateTransitionSchema = createInsertSchema(projectStateTransitions).omit({ id: true, createdAt: true });
export type InsertProjectStateTransition = z.infer<typeof insertProjectStateTransitionSchema>;
export type ProjectStateTransition = typeof projectStateTransitions.$inferSelect;

export const insertRegulatoryNodeSchema = createInsertSchema(regulatoryNodes).omit({ id: true, updatedAt: true });
export type InsertRegulatoryNode = z.infer<typeof insertRegulatoryNodeSchema>;
export type RegulatoryNode = typeof regulatoryNodes.$inferSelect;

export const insertIPCSchema = createInsertSchema(ipcs).omit({ id: true, createdAt: true, approvedAt: true, paidAt: true });
export type InsertIPC = z.infer<typeof insertIPCSchema>;
export type IPC = typeof ipcs.$inferSelect;

export const insertVariationOrderSchema = createInsertSchema(variationOrders).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertVariationOrder = z.infer<typeof insertVariationOrderSchema>;
export type VariationOrder = typeof variationOrders.$inferSelect;

export const insertRiskScoreSchema = createInsertSchema(riskScores).omit({ id: true, computedAt: true });
export type InsertRiskScore = z.infer<typeof insertRiskScoreSchema>;
export type RiskScore = typeof riskScores.$inferSelect;

export const insertPortfolioMetricSchema = createInsertSchema(portfolioMetrics).omit({ id: true, computedAt: true });
export type InsertPortfolioMetric = z.infer<typeof insertPortfolioMetricSchema>;
export type PortfolioMetric = typeof portfolioMetrics.$inferSelect;

export const insertGovernanceGateSchema = createInsertSchema(governanceGates).omit({ id: true, createdAt: true, decidedAt: true });
export type InsertGovernanceGate = z.infer<typeof insertGovernanceGateSchema>;
export type GovernanceGate = typeof governanceGates.$inferSelect;

export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, awardedAt: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export const insertSalesUnitSchema = createInsertSchema(salesUnits).omit({ id: true, createdAt: true });
export type InsertSalesUnit = z.infer<typeof insertSalesUnitSchema>;
export type SalesUnit = typeof salesUnits.$inferSelect;

export const insertPaymentPlanSchema = createInsertSchema(paymentPlans).omit({ id: true, createdAt: true });
export type InsertPaymentPlan = z.infer<typeof insertPaymentPlanSchema>;
export type PaymentPlan = typeof paymentPlans.$inferSelect;

export const agentRunStatusEnum = pgEnum("agent_run_status", ["queued", "running", "completed", "failed"]);
export const agentRunTriggerEnum = pgEnum("agent_run_trigger", ["manual", "document_upload", "ipc_created", "cron_nightly", "cron_weekly", "event_chain"]);
export const proposalStatusEnum = pgEnum("proposal_status", ["pending", "approved", "rejected", "expired"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);
export const draftDecisionStatusEnum = pgEnum("draft_decision_status", ["draft", "pending_review", "approved", "rejected"]);

export const docClassificationEnum = pgEnum("doc_classification", [
  "CONTRACT_MAIN_WORKS", "CONTRACT_SUBCONTRACT", "QS_COST_PLAN", "TCC_CERTIFICATION",
  "IPC_CERTIFICATE", "VO_REQUEST", "VO_APPROVAL", "RERA_ESCROW_DOC", "DLD_DOC",
  "DM_PLANNING_APPROVAL", "DM_BUILDING_PERMIT", "CIVIL_DEFENSE_APPROVAL", "DEWA_NOC",
  "MASTER_DEVELOPER_NOC", "OQOOD_EXPORT", "SALES_TRACKER", "RECEIPT_PROOF",
  "HANDOVER_CHECKLIST", "COMPLETION_CERTIFICATE", "OA_TRANSFER_DOC", "DLP_LOG", "UNKNOWN"
]);

export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id),
  projectId: varchar("project_id").references(() => projects.id),
  trigger: agentRunTriggerEnum("trigger").notNull().default("manual"),
  triggerRef: text("trigger_ref"),
  status: agentRunStatusEnum("status").notNull().default("queued"),
  inputContext: jsonb("input_context"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const agentOutputs = pgTable("agent_outputs", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => agentRuns.id),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id),
  outputType: text("output_type").notNull(),
  outputData: jsonb("output_data").notNull(),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => agentRuns.id),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id),
  projectId: varchar("project_id").references(() => projects.id),
  category: text("category").notNull(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  priority: text("priority").notNull().default("medium"),
  actionRequired: boolean("action_required").notNull().default(false),
  metadata: jsonb("metadata"),
  status: proposalStatusEnum("status").notNull().default("pending"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => agentRuns.id),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id),
  projectId: varchar("project_id").references(() => projects.id),
  severity: alertSeverityEnum("severity").notNull().default("info"),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  messageEn: text("message_en").notNull(),
  messageAr: text("message_ar").notNull(),
  metric: text("metric"),
  currentValue: text("current_value"),
  threshold: text("threshold"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reconciliationProposals = pgTable("reconciliation_proposals", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => agentRuns.id),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id),
  projectId: varchar("project_id").references(() => projects.id),
  documentId: integer("document_id").references(() => projectDocuments.id),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  description: text("description"),
  status: proposalStatusEnum("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const proposalItems = pgTable("proposal_items", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => reconciliationProposals.id),
  targetTable: text("target_table").notNull(),
  targetId: text("target_id"),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  confidence: real("confidence").notNull().default(0),
  evidenceType: text("evidence_type"),
  evidenceRef: text("evidence_ref"),
  evidencePage: integer("evidence_page"),
  evidenceSnippet: text("evidence_snippet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const draftDecisions = pgTable("draft_decisions", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => agentRuns.id),
  agentId: varchar("agent_id").notNull().references(() => aiAgents.id),
  projectId: varchar("project_id").references(() => projects.id),
  proposalId: integer("proposal_id").references(() => reconciliationProposals.id),
  decisionType: text("decision_type").notNull(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  rationale: text("rationale"),
  recommendedAction: text("recommended_action").notNull(),
  impact: jsonb("impact"),
  status: draftDecisionStatusEnum("status").notNull().default("draft"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const extractionRuns = pgTable("extraction_runs", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => projectDocuments.id),
  agentRunId: integer("agent_run_id").references(() => agentRuns.id),
  classification: docClassificationEnum("classification"),
  classificationConfidence: real("classification_confidence"),
  rawText: text("raw_text"),
  detectedTables: jsonb("detected_tables"),
  pageCount: integer("page_count"),
  status: agentRunStatusEnum("status").notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const extractionFields = pgTable("extraction_fields", {
  id: serial("id").primaryKey(),
  extractionRunId: integer("extraction_run_id").notNull().references(() => extractionRuns.id),
  canonicalField: text("canonical_field").notNull(),
  extractedValue: text("extracted_value").notNull(),
  confidence: real("confidence").notNull().default(0),
  evidenceType: text("evidence_type"),
  evidencePage: integer("evidence_page"),
  evidenceCell: text("evidence_cell"),
  evidenceSnippet: text("evidence_snippet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAgentRunSchema = createInsertSchema(agentRuns).omit({ id: true, createdAt: true, completedAt: true });
export type InsertAgentRun = z.infer<typeof insertAgentRunSchema>;
export type AgentRun = typeof agentRuns.$inferSelect;

export const insertAgentOutputSchema = createInsertSchema(agentOutputs).omit({ id: true, createdAt: true });
export type InsertAgentOutput = z.infer<typeof insertAgentOutputSchema>;
export type AgentOutput = typeof agentOutputs.$inferSelect;

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendations.$inferSelect;

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true, acknowledgedAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

export const insertReconciliationProposalSchema = createInsertSchema(reconciliationProposals).omit({ id: true, createdAt: true, approvedAt: true });
export type InsertReconciliationProposal = z.infer<typeof insertReconciliationProposalSchema>;
export type ReconciliationProposal = typeof reconciliationProposals.$inferSelect;

export const insertProposalItemSchema = createInsertSchema(proposalItems).omit({ id: true, createdAt: true });
export type InsertProposalItem = z.infer<typeof insertProposalItemSchema>;
export type ProposalItem = typeof proposalItems.$inferSelect;

export const insertDraftDecisionSchema = createInsertSchema(draftDecisions).omit({ id: true, createdAt: true, decidedAt: true });
export type InsertDraftDecision = z.infer<typeof insertDraftDecisionSchema>;
export type DraftDecision = typeof draftDecisions.$inferSelect;

export const insertExtractionRunSchema = createInsertSchema(extractionRuns).omit({ id: true, createdAt: true, completedAt: true });
export type InsertExtractionRun = z.infer<typeof insertExtractionRunSchema>;
export type ExtractionRun = typeof extractionRuns.$inferSelect;

export const insertExtractionFieldSchema = createInsertSchema(extractionFields).omit({ id: true, createdAt: true });
export type InsertExtractionField = z.infer<typeof insertExtractionFieldSchema>;
export type ExtractionField = typeof extractionFields.$inferSelect;

export const boardPortfolioCache = pgTable("board_portfolio_cache", {
  id: serial("id").primaryKey(),
  totalProjects: integer("total_projects").default(0).notNull(),
  totalGDV: numeric("total_gdv", { precision: 16, scale: 2 }).default("0"),
  totalTDC: numeric("total_tdc", { precision: 16, scale: 2 }).default("0"),
  avgROI: numeric("avg_roi", { precision: 8, scale: 2 }).default("0"),
  portfolioHealthGrade: text("portfolio_health_grade").default("B"),
  c1Total: integer("c1_total").default(0),
  c2Total: integer("c2_total").default(0),
  c3Total: integer("c3_total").default(0),
  c4Total: integer("c4_total").default(0),
  c5Total: integer("c5_total").default(0),
  riskSummary: jsonb("risk_summary"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const boardProjectCache = pgTable("board_project_cache", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  projectName: text("project_name").notNull(),
  projectNameAr: text("project_name_ar"),
  location: text("location"),
  status: text("status"),
  gdv: numeric("gdv", { precision: 16, scale: 2 }).default("0"),
  tdc: numeric("tdc", { precision: 16, scale: 2 }).default("0"),
  roi: numeric("roi", { precision: 8, scale: 2 }).default("0"),
  riskLevel: text("risk_level").default("LOW"),
  physicalProgress: integer("physical_progress").default(0),
  salesProgress: integer("sales_progress").default(0),
  capitalState: jsonb("capital_state"),
  executiveSummary: text("executive_summary"),
  executiveSummaryAr: text("executive_summary_ar"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const boardDecisionView = pgTable("board_decision_view", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").references(() => projects.id),
  decisionType: text("decision_type").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  summary: text("summary"),
  summaryAr: text("summary_ar"),
  recommendation: text("recommendation"),
  status: text("status").default("pending"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const laylaConversations = pgTable("layla_conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  intent: text("intent"),
  projectId: varchar("project_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBoardPortfolioCacheSchema = createInsertSchema(boardPortfolioCache).omit({ id: true, updatedAt: true });
export type InsertBoardPortfolioCache = z.infer<typeof insertBoardPortfolioCacheSchema>;
export type BoardPortfolioCache = typeof boardPortfolioCache.$inferSelect;

export const insertBoardProjectCacheSchema = createInsertSchema(boardProjectCache).omit({ id: true, updatedAt: true });
export type InsertBoardProjectCache = z.infer<typeof insertBoardProjectCacheSchema>;
export type BoardProjectCache = typeof boardProjectCache.$inferSelect;

export const insertBoardDecisionViewSchema = createInsertSchema(boardDecisionView).omit({ id: true, createdAt: true });
export type InsertBoardDecisionView = z.infer<typeof insertBoardDecisionViewSchema>;
export type BoardDecisionView = typeof boardDecisionView.$inferSelect;

export const insertLaylaConversationSchema = createInsertSchema(laylaConversations).omit({ id: true, createdAt: true });
export type InsertLaylaConversation = z.infer<typeof insertLaylaConversationSchema>;
export type LaylaConversation = typeof laylaConversations.$inferSelect;
