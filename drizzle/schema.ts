import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, varchar, mysqlEnum, text, mediumtext, timestamp, index, foreignKey, bigint, decimal, longtext, tinyint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const newsTicker = mysqlTable("news_ticker", {
	id: int().autoincrement().notNull(),
	title: varchar({ length: 500 }).notNull(),
	color: varchar({ length: 20 }).default('#f59e0b'),
	isActive: tinyint("is_active").default(1).notNull(),
	sortOrder: int("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const agentActivityLog = mysqlTable("agentActivityLog", {
	id: int().autoincrement().notNull(),
	agentName: varchar({ length: 50 }).notNull(),
	agentModel: varchar({ length: 50 }),
	actionType: mysqlEnum(['tool_call','chat_response','file_read','file_write','db_read','db_write','email_action','drive_action','agent_comm','task_execution','meeting_action','analysis','error']).notNull(),
	toolName: varchar({ length: 100 }),
	inputSummary: text(),
	outputSummary: text(),
	fullInput: mediumtext(),
	fullOutput: mediumtext(),
	activityStatus: mysqlEnum(['success','failure','partial','pending']).notNull(),
	errorMessage: text(),
	errorDetails: text(),
	triggerSource: varchar({ length: 100 }),
	relatedEntityType: varchar({ length: 50 }),
	relatedEntityId: int(),
	userId: int(),
	durationMs: int(),
	tokensUsed: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const agentAssignments = mysqlTable("agentAssignments", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	agent: varchar({ length: 50 }).notNull(),
	userMessage: text().notNull(),
	toolUsed: varchar({ length: 100 }).notNull(),
	toolArgs: text(),
	toolResult: text(),
	assignmentStatus: mysqlEnum(['executing','completed','failed']).default('executing').notNull(),
	agentResponse: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	completedAt: timestamp({ mode: 'string' }),
});

export const agents = mysqlTable("agents", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 100 }).notNull(),
	nameEn: varchar({ length: 100 }),
	role: varchar({ length: 255 }).notNull(),
	roleEn: varchar({ length: 255 }),
	description: text(),
	color: varchar({ length: 20 }),
	icon: varchar({ length: 50 }),
	agentStatus: mysqlEnum(['active','inactive','maintenance']).default('active').notNull(),
	capabilities: text(),
	isCoordinator: int().default(0).notNull(),
	gender: mysqlEnum(['male','female']).default('male').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	avatarUrl: text(),
	age: int(),
},
(table) => [
	index("agents_name_unique").on(table.name),
]);

export const aiAdvisoryScores = mysqlTable("aiAdvisoryScores", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	criterionId: int().notNull(),
	suggestedScore: int(),
	reasoning: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const cfCostItems = mysqlTable("cf_cost_items", {
	id: int().autoincrement().notNull(),
	cfProjectId: int().notNull().references(() => cfProjects.id, { onDelete: "cascade" } ),
	name: varchar({ length: 500 }).notNull(),
	category: mysqlEnum(['land','land_registration','development_setup','design_engineering','consultants','authority_fees','contractor','marketing_sales','administration','developer_fee','contingency','other']).notNull(),
	totalAmount: bigint({ mode: "number" }).notNull(),
	paymentType: mysqlEnum(['lump_sum','milestone','monthly_fixed','progress_based','sales_linked']).notNull(),
	paymentParams: text(),
	phaseAllocation: text(),
	fundingSource: mysqlEnum(['developer','escrow','mixed']).default('developer').notNull(),
	escrowEligible: tinyint().default(0).notNull(),
	phaseTag: mysqlEnum(['pre_dev','construction','handover','all']).default('pre_dev').notNull(),
	sortOrder: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const cfFiles = mysqlTable("cf_files", {
	id: int().autoincrement().notNull(),
	cfProjectId: int().notNull().references(() => cfProjects.id, { onDelete: "cascade" } ),
	fileName: varchar({ length: 500 }).notNull(),
	fileUrl: text().notNull(),
	fileKey: varchar({ length: 500 }).notNull(),
	mimeType: varchar({ length: 100 }),
	fileSize: int(),
	category: varchar({ length: 100 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const cfProjects = mysqlTable("cf_projects", {
	id: int().autoincrement().notNull(),
	projectId: int().references(() => projects.id, { onDelete: "cascade" } ),
	userId: int().notNull().references(() => users.id),
	name: varchar({ length: 500 }).notNull(),
	startDate: varchar({ length: 20 }).notNull(),
	designApprovalMonths: int().default(6).notNull(),
	reraSetupMonths: int().default(3).notNull(),
	constructionMonths: int().default(16).notNull(),
	handoverMonths: int().default(2).notNull(),
	preDevMonths: int().default(6).notNull(),
	salesEnabled: tinyint().default(0).notNull(),
	salesStartMonth: int(),
	salesVelocityUnits: int(),
	salesVelocityAed: bigint({ mode: "number" }),
	salesVelocityType: mysqlEnum(['units','aed']).default('aed'),
	totalSalesRevenue: bigint({ mode: "number" }),
	buyerPlanBookingPct: decimal({ precision: 5, scale: 2 }).default('20'),
	buyerPlanConstructionPct: decimal({ precision: 5, scale: 2 }).default('30'),
	buyerPlanHandoverPct: decimal({ precision: 5, scale: 2 }).default('50'),
	escrowDepositPct: decimal({ precision: 5, scale: 2 }).default('20'),
	contractorAdvancePct: decimal({ precision: 5, scale: 2 }).default('10'),
	liquidityBufferPct: decimal({ precision: 5, scale: 2 }).default('5'),
	constructionCostTotal: bigint({ mode: "number" }),
	buaSqft: int(),
	constructionCostPerSqft: int(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const cfScenarios = mysqlTable("cf_scenarios", {
	id: int().autoincrement().notNull(),
	cfProjectId: int().notNull().references(() => cfProjects.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	isDefault: tinyint().default(0).notNull(),
	salesStartMonthDelta: int().default(0),
	constructionDurationDelta: int().default(0),
	mobilizationPctOverride: decimal({ precision: 5, scale: 2 }),
	buyerPlanBookingPct: decimal({ precision: 5, scale: 2 }),
	buyerPlanConstructionPct: decimal({ precision: 5, scale: 2 }),
	buyerPlanHandoverPct: decimal({ precision: 5, scale: 2 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const chatHistory = mysqlTable("chatHistory", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	agent: varchar({ length: 50 }).notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const commandCenterChat = mysqlTable("commandCenterChat", {
	id: int().autoincrement().notNull(),
	memberId: varchar({ length: 50 }).notNull(),
	chatRole: mysqlEnum(['member','salwa']).notNull(),
	content: text().notNull(),
	metadata: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const commandCenterEvaluations = mysqlTable("commandCenterEvaluations", {
	id: int().autoincrement().notNull(),
	sessionId: varchar({ length: 100 }).notNull(),
	projectId: int().notNull().references(() => projects.id),
	consultantId: int().notNull().references(() => consultants.id),
	memberId: varchar({ length: 50 }).notNull(),
	scoresJson: text().notNull(),
	totalScore: decimal({ precision: 5, scale: 2 }),
	notes: text(),
	isComplete: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const commandCenterItems = mysqlTable("commandCenterItems", {
	id: int().autoincrement().notNull(),
	bubbleType: mysqlEnum(['reports','requests','meeting_minutes','evaluations','announcements']).notNull(),
	title: varchar({ length: 500 }).notNull(),
	content: longtext(),
	summary: text(),
	itemPriority: mysqlEnum(['normal','important','urgent']).default('normal').notNull(),
	itemStatus: mysqlEnum(['active','archived','pending_response','resolved']).default('active').notNull(),
	createdByMemberId: varchar({ length: 50 }).notNull(),
	targetMemberIds: text(),
	requiresResponse: int().default(0).notNull(),
	responseDeadline: timestamp({ mode: 'string' }),
	attachments: text(),
	projectId: int().references(() => projects.id),
	consultantId: int().references(() => consultants.id),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const commandCenterMembers = mysqlTable("commandCenterMembers", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	nameAr: varchar({ length: 255 }).notNull(),
	memberRole: mysqlEnum(['admin','executive']).notNull(),
	memberId: varchar({ length: 50 }).notNull(),
	accessToken: varchar({ length: 128 }).notNull(),
	greeting: varchar({ length: 500 }),
	avatarUrl: varchar({ length: 1000 }),
	isActive: int().default(1).notNull(),
	lastAccessAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("commandCenterMembers_memberId_unique").on(table.memberId),
	index("commandCenterMembers_accessToken_unique").on(table.accessToken),
]);

export const commandCenterNotifications = mysqlTable("commandCenterNotifications", {
	id: int().autoincrement().notNull(),
	memberId: varchar({ length: 50 }).notNull(),
	title: varchar({ length: 500 }).notNull(),
	message: text(),
	notificationType: mysqlEnum(['new_item','response','evaluation','urgent','system']).default('system').notNull(),
	relatedItemId: int(),
	isRead: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const commandCenterResponses = mysqlTable("commandCenterResponses", {
	id: int().autoincrement().notNull(),
	itemId: int().notNull().references(() => commandCenterItems.id, { onDelete: "cascade" } ),
	memberId: varchar({ length: 50 }).notNull(),
	responseText: text().notNull(),
	responseType: mysqlEnum(['approval','rejection','comment','question']).default('comment').notNull(),
	attachmentUrl: text(),
	attachmentName: varchar({ length: 500 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const committeeDecisions = mysqlTable("committeeDecisions", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	selectedConsultantId: int().references(() => consultants.id),
	decisionType: varchar({ length: 50 }),
	negotiationTarget: text(),
	committeeNotes: text(),
	aiAnalysis: text(),
	aiRecommendation: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
	decisionBasis: varchar({ length: 100 }),
	justification: text(),
	negotiationConditions: text(),
	aiPostDecisionAnalysis: text(),
	isConfirmed: int().default(0),
	confirmedAt: timestamp({ mode: 'string' }),
	confirmedBy: varchar({ length: 255 }),
	sessionId: int().references(() => evaluationSessions.id, { onDelete: "cascade" } ),
	aiPostDecisionAnalysisAr: text(),
});

export const competitionPricing = mysqlTable("competition_pricing", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	projectId: int().notNull().references(() => projects.id),
	aiSmartReport: longtext(),
	aiRecommendationsJson: text(),
	aiReportGeneratedAt: timestamp({ mode: 'string' }),
	optStudioPrice: int().default(0),
	opt1brPrice: int().default(0),
	opt2brPrice: int().default(0),
	opt3brPrice: int().default(0),
	optRetailSmallPrice: int().default(0),
	optRetailMediumPrice: int().default(0),
	optRetailLargePrice: int().default(0),
	optOfficeSmallPrice: int().default(0),
	optOfficeMediumPrice: int().default(0),
	optOfficeLargePrice: int().default(0),
	baseStudioPrice: int().default(0),
	base1brPrice: int().default(0),
	base2brPrice: int().default(0),
	base3brPrice: int().default(0),
	baseRetailSmallPrice: int().default(0),
	baseRetailMediumPrice: int().default(0),
	baseRetailLargePrice: int().default(0),
	baseOfficeSmallPrice: int().default(0),
	baseOfficeMediumPrice: int().default(0),
	baseOfficeLargePrice: int().default(0),
	consStudioPrice: int().default(0),
	cons1brPrice: int().default(0),
	cons2brPrice: int().default(0),
	cons3brPrice: int().default(0),
	consRetailSmallPrice: int().default(0),
	consRetailMediumPrice: int().default(0),
	consRetailLargePrice: int().default(0),
	consOfficeSmallPrice: int().default(0),
	consOfficeMediumPrice: int().default(0),
	consOfficeLargePrice: int().default(0),
	paymentBookingPct: decimal({ precision: 5, scale: 2 }).default('10'),
	paymentBookingTiming: varchar({ length: 255 }).default('عند التوقيع'),
	paymentConstructionPct: decimal({ precision: 5, scale: 2 }).default('60'),
	paymentConstructionTiming: varchar({ length: 255 }).default('أثناء الإنشاء'),
	paymentHandoverPct: decimal({ precision: 5, scale: 2 }).default('30'),
	paymentHandoverTiming: varchar({ length: 255 }).default('عند التسليم'),
	paymentDeferredPct: decimal({ precision: 5, scale: 2 }).default('0'),
	paymentDeferredTiming: varchar({ length: 255 }),
	activeScenario: varchar({ length: 20 }).default('base'),
	approvedRevenue: bigint({ mode: 'number' }).default(0),
	isApproved: int().default(0).notNull(),
	approvedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const consultantDetails = mysqlTable("consultantDetails", {
	id: int().autoincrement().notNull(),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	phone2: varchar({ length: 20 }),
	location: varchar({ length: 255 }),
	classification: varchar({ length: 100 }),
	weight: varchar({ length: 100 }),
	yearsOfExperience: int(),
	numberOfEngineers: int(),
	notableClients: text(),
	contactPerson: varchar({ length: 255 }),
	contactPersonPhone: varchar({ length: 20 }),
	contactPersonEmail: varchar({ length: 320 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
},
(table) => [
	index("consultantId").on(table.consultantId),
]);

export const consultantNotes = mysqlTable("consultantNotes", {
	id: int().autoincrement().notNull(),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	userId: int().notNull().references(() => users.id),
	title: varchar({ length: 255 }),
	content: text().notNull(),
	category: varchar({ length: 100 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const consultantPortfolio = mysqlTable("consultantPortfolio", {
	id: int().autoincrement().notNull(),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	imageUrl: varchar({ length: 500 }),
	projectType: varchar({ length: 100 }),
	location: varchar({ length: 255 }),
	year: varchar({ length: 10 }),
	area: varchar({ length: 100 }),
	sortOrder: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const consultantProfiles = mysqlTable("consultantProfiles", {
	id: int().autoincrement().notNull(),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	companyNameAr: varchar({ length: 255 }),
	founded: varchar({ length: 50 }),
	headquarters: varchar({ length: 255 }),
	website: varchar({ length: 500 }),
	employeeCount: varchar({ length: 100 }),
	specializations: text(),
	keyProjects: text(),
	certifications: text(),
	overview: text(),
	strengths: text(),
	weaknesses: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("consultantProfiles_consultantId_unique").on(table.consultantId),
]);

export const consultantProposals = mysqlTable("consultantProposals", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	consultantId: int().references(() => consultants.id),
	projectId: int().references(() => projects.id),
	title: varchar({ length: 500 }).notNull(),
	fileUrl: varchar({ length: 1000 }).notNull(),
	fileKey: varchar({ length: 500 }).notNull(),
	fileName: varchar({ length: 255 }).notNull(),
	fileSize: int(),
	mimeType: varchar({ length: 100 }),
	aiSummary: text(),
	aiKeyPoints: text(),
	aiStrengths: text(),
	aiWeaknesses: text(),
	aiRecommendation: text(),
	aiScore: int(),
	extractedText: text(),
	analysisStatus: mysqlEnum(['pending','processing','completed','failed']).default('pending').notNull(),
	analysisError: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	aiScope: text(),
	aiExclusions: text(),
	aiAdditionalWorks: text(),
	aiSupervisionTerms: text(),
	aiTimeline: text(),
	aiPaymentTerms: text(),
	aiConditions: text(),
	aiTeamComposition: text(),
	aiDeliverables: text(),
	aiFinancialSummary: text(),
	aiWarnings: text(),
	preprocessingStats: text(),
	filteredText: text(),
});

export const consultants = mysqlTable("consultants", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 20 }),
	specialization: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const contractTypes = mysqlTable("contractTypes", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	name: varchar({ length: 255 }).notNull(),
	nameEn: varchar({ length: 255 }),
	code: varchar({ length: 50 }),
	category: varchar({ length: 100 }),
	description: text(),
	isDefault: int().default(0).notNull(),
	sortOrder: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const costsCashFlow = mysqlTable("costs_cash_flow", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	aiSmartReport: longtext(),
	aiRecommendationsJson: text(),
	aiReportGeneratedAt: timestamp({ mode: 'string' }),
	landPrice: int().default(0),
	agentCommissionLandPct: decimal({ precision: 5, scale: 2 }).default('1'),
	landRegistrationPct: decimal({ precision: 5, scale: 2 }).default('4'),
	soilInvestigation: int().default(0),
	topographySurvey: int().default(0),
	designFeePct: decimal({ precision: 5, scale: 2 }).default('2'),
	supervisionFeePct: decimal({ precision: 5, scale: 2 }).default('2'),
	authoritiesFee: int().default(0),
	separationFeePerM2: int().default(40),
	constructionCostPerSqft: int().default(0),
	communityFee: int().default(0),
	contingenciesPct: decimal({ precision: 5, scale: 2 }).default('2'),
	developerFeePct: decimal({ precision: 5, scale: 2 }).default('5'),
	agentCommissionSalePct: decimal({ precision: 5, scale: 2 }).default('5'),
	marketingPct: decimal({ precision: 5, scale: 2 }).default('2'),
	reraOffplanFee: int().default(150000),
	reraUnitFee: int().default(850),
	nocFee: int().default(10000),
	escrowFee: int().default(140000),
	bankCharges: int().default(20000),
	surveyorFees: int().default(12000),
	reraAuditFees: int().default(18000),
	reraInspectionFees: int().default(70000),
	comoProfitSharePct: decimal({ precision: 5, scale: 2 }).default('15'),
	projectDurationMonths: int().default(36),
	constructionStartMonth: int().default(6),
	constructionDurationMonths: int().default(24),
	salesStartMonth: int().default(1),
	salesDurationMonths: int().default(30),
	salesPhase1Pct: decimal({ precision: 5, scale: 2 }).default('30'),
	salesPhase2Pct: decimal({ precision: 5, scale: 2 }).default('40'),
	salesPhase3Pct: decimal({ precision: 5, scale: 2 }).default('30'),
	isApproved: int().default(0).notNull(),
	approvedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const dashboardData = mysqlTable("dashboardData", {
	id: int().autoincrement().notNull(),
	dataKey: varchar({ length: 255 }).notNull(),
	dataValue: longtext(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
},
(table) => [
	index("dataKey").on(table.dataKey),
]);

export const designsAndPermits = mysqlTable("designsAndPermits", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	architecturalDesignStatus: varchar({ length: 100 }),
	architecturalDesignDate: varchar({ length: 50 }),
	architecturalDesignFileUrl: varchar({ length: 1000 }),
	architecturalDesignFileKey: varchar({ length: 500 }),
	engineeringDesignStatus: varchar({ length: 100 }),
	engineeringDesignDate: varchar({ length: 50 }),
	engineeringDesignFileUrl: varchar({ length: 1000 }),
	engineeringDesignFileKey: varchar({ length: 500 }),
	buildingPermitStatus: varchar({ length: 100 }),
	buildingPermitNumber: varchar({ length: 100 }),
	buildingPermitDate: varchar({ length: 50 }),
	buildingPermitExpiryDate: varchar({ length: 50 }),
	buildingPermitFileUrl: varchar({ length: 1000 }),
	buildingPermitFileKey: varchar({ length: 500 }),
	municipalityDesignApprovalStatus: varchar({ length: 100 }),
	municipalityDesignApprovalDate: varchar({ length: 50 }),
	designRequirements: text(),
	buildingConditions: text(),
	designConsultationFees: int(),
	buildingPermitFees: int(),
	municipalityDesignReviewFees: int(),
	designNotes: text(),
	consultantAnalysis: text(),
	completionStatus: varchar({ length: 100 }).default('pending'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const documentIndex = mysqlTable("documentIndex", {
	id: int().autoincrement().notNull(),
	sourceType: mysqlEnum(['google_drive','email_attachment','upload','agent_output']).notNull(),
	sourceId: varchar({ length: 255 }),
	sourcePath: varchar({ length: 1000 }),
	sourceName: varchar({ length: 500 }).notNull(),
	fileType: mysqlEnum(['pdf','excel','word','image','text','google_doc','google_sheet','google_slides','csv','other']).notNull(),
	mimeType: varchar({ length: 255 }),
	fileSizeBytes: int(),
	extractedText: longtext(),
	extractedTextLength: int(),
	structuredData: longtext(),
	summary: text(),
	category: varchar({ length: 100 }),
	projectId: int(),
	consultantId: int(),
	tags: text(),
	language: varchar({ length: 10 }),
	indexStatus: mysqlEnum(['pending','processing','indexed','failed','needs_update']).default('pending').notNull(),
	indexError: text(),
	indexedBy: varchar({ length: 50 }),
	searchVector: text(),
	lastAccessedAt: timestamp({ mode: 'string' }),
	accessCount: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const emailCheckLog = mysqlTable("emailCheckLog", {
	id: int().autoincrement().notNull(),
	status: mysqlEnum(['success','failed']).default('success'),
	emailCount: int().default(0),
	error: text(),
	checkedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
},
(table) => [
	index("checkedAt").on(table.checkedAt),
]);

export const emailLog = mysqlTable("emailLog", {
	id: int().autoincrement().notNull(),
	messageId: varchar({ length: 500 }),
	fromEmail: varchar({ length: 255 }).notNull(),
	subject: varchar({ length: 500 }),
	preview: text(),
	attachmentCount: int().default(0),
	status: mysqlEnum(['received','approved','replied','archived']).default('received'),
	receivedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	processedAt: timestamp({ mode: 'string' }),
},
(table) => [
	index("messageId").on(table.messageId),
]);

export const emailNotifications = mysqlTable("email_notifications", {
	id: int().autoincrement().notNull(),
	userId: int("user_id").notNull(),
	emailUid: int("email_uid").notNull(),
	fromEmail: varchar("from_email", { length: 255 }).notNull(),
	fromName: varchar("from_name", { length: 255 }),
	subject: varchar({ length: 500 }).notNull(),
	preview: text(),
	receivedAt: bigint("received_at", { mode: "number" }).notNull(),
	isRead: int("is_read").default(0),
	isDismissed: int("is_dismissed").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const evaluationApprovals = mysqlTable("evaluationApprovals", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	evaluatorName: varchar({ length: 100 }).notNull(),
	isApproved: int().default(0).notNull(),
	approvedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("unique_project_evaluator").on(table.projectId, table.evaluatorName),
]);

export const evaluationResults = mysqlTable("evaluationResults", {
	id: int().autoincrement().notNull(),
	sessionId: int().notNull().references(() => evaluationSessions.id, { onDelete: "cascade" } ),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	technicalScoreAverage: decimal({ precision: 5, scale: 2 }),
	financialScore: decimal({ precision: 5, scale: 2 }),
	finalScore: decimal({ precision: 5, scale: 2 }),
	rank: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const evaluationScores = mysqlTable("evaluationScores", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	criterionId: int().notNull(),
	score: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const evaluationSessionMembers = mysqlTable("evaluationSessionMembers", {
	id: int().autoincrement().notNull(),
	sessionId: int().notNull().references(() => evaluationSessions.id, { onDelete: "cascade" } ),
	evaluatorName: varchar({ length: 100 }).notNull(),
	status: mysqlEnum(['pending','in_progress','completed']).default('pending').notNull(),
	completedAt: timestamp({ mode: 'string' }),
});

export const evaluationSessions = mysqlTable("evaluationSessions", {
	id: int().autoincrement().notNull(),
	sessionId: varchar({ length: 100 }),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	consultantId: int().references(() => consultants.id, { onDelete: "cascade" } ),
	title: varchar({ length: 500 }),
	description: text(),
	isRevealed: int().default(0).notNull(),
	completedCount: int().default(0).notNull(),
	requiredCount: int().default(3).notNull(),
	createdByMemberId: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	status: mysqlEnum(['pending','in_progress','completed']).default('pending').notNull(),
	completedAt: timestamp({ mode: 'string' }),
},
(table) => [
	index("evaluationSessions_sessionId_unique").on(table.sessionId),
]);

export const evaluatorScores = mysqlTable("evaluatorScores", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	consultantId: int().notNull().references(() => consultants.id),
	criterionId: int().notNull(),
	evaluatorName: varchar({ length: 100 }).notNull(),
	score: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP'),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow(),
	sessionId: int().references(() => evaluationSessions.id, { onDelete: "cascade" } ),
});

export const feasibilityStudies = mysqlTable("feasibilityStudies", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	projectName: varchar({ length: 500 }).notNull(),
	community: varchar({ length: 255 }),
	plotNumber: varchar({ length: 100 }),
	projectDescription: varchar({ length: 255 }),
	landUse: varchar({ length: 255 }),
	plotArea: int(),
	plotAreaM2: int(),
	gfaResidential: int(),
	gfaRetail: int(),
	gfaOffices: int(),
	totalGfa: int(),
	saleableResidentialPct: int().default(95),
	saleableRetailPct: int().default(97),
	saleableOfficesPct: int().default(95),
	estimatedBua: int(),
	numberOfUnits: int(),
	landPrice: int(),
	agentCommissionLandPct: int().default(1),
	soilInvestigation: int(),
	topographySurvey: int(),
	authoritiesFee: int(),
	constructionCostPerSqft: int(),
	communityFee: int(),
	designFeePct: int().default(2),
	supervisionFeePct: int().default(2),
	separationFeePerM2: int().default(40),
	contingenciesPct: int().default(2),
	developerFeePct: int().default(5),
	agentCommissionSalePct: int().default(5),
	marketingPct: int().default(2),
	reraOffplanFee: int().default(150000),
	reraUnitFee: int().default(850),
	nocFee: int().default(10000),
	escrowFee: int().default(140000),
	bankCharges: int().default(20000),
	surveyorFees: int().default(12000),
	reraAuditFees: int().default(18000),
	reraInspectionFees: int().default(70000),
	residentialSalePrice: int(),
	retailSalePrice: int(),
	officesSalePrice: int(),
	comoProfitSharePct: int().default(15),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	projectId: int().references(() => projects.id, { onDelete: "set null" } ),
	scenarioName: varchar({ length: 255 }),
	aiSummary: text(),
	marketAnalysis: text(),
	competitorAnalysis: text(),
	priceRecommendation: text(),
});

export const financialData = mysqlTable("financialData", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	designType: varchar({ length: 20 }).default('pct'),
	designValue: decimal({ precision: 15, scale: 2 }),
	supervisionType: varchar({ length: 20 }).default('pct'),
	supervisionValue: decimal({ precision: 15, scale: 2 }),
	proposalLink: varchar({ length: 500 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const knowledgeBase = mysqlTable("knowledgeBase", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	type: mysqlEnum(['decision','evaluation','pattern','insight','lesson']).notNull(),
	title: varchar({ length: 500 }).notNull(),
	content: text().notNull(),
	summary: text(),
	tags: text(),
	relatedProjectId: int().references(() => projects.id),
	relatedConsultantId: int().references(() => consultants.id),
	relatedAgentAssignmentId: int().references(() => agentAssignments.id),
	sourceAgent: varchar({ length: 50 }),
	importance: mysqlEnum(['low','medium','high','critical']).default('medium').notNull(),
	viewCount: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const legalSetupRecords = mysqlTable("legalSetupRecords", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	titleDeedStatus: varchar({ length: 100 }),
	titleDeedNumber: varchar({ length: 100 }),
	titleDeedDate: varchar({ length: 50 }),
	ddaRegistrationStatus: varchar({ length: 100 }),
	ddaRegistrationNumber: varchar({ length: 100 }),
	ddaRegistrationDate: varchar({ length: 50 }),
	municipalityApprovalStatus: varchar({ length: 100 }),
	municipalityApprovalNumber: varchar({ length: 100 }),
	municipalityApprovalDate: varchar({ length: 50 }),
	legalObligations: text(),
	restrictionsAndConditions: text(),
	registrationFees: int(),
	legalConsultationFees: int(),
	governmentFeesTotal: int(),
	legalNotes: text(),
	farouqAnalysis: text(),
	completionStatus: varchar({ length: 100 }).default('pending'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const marketOverview = mysqlTable("marketOverview", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	aiSmartReport: longtext(),
	aiRecommendationsJson: text(),
	aiReportGeneratedAt: timestamp({ mode: 'string' }),
	residentialStudioPct: decimal({ precision: 5, scale: 2 }).default('0'),
	residentialStudioAvgArea: int().default(0),
	residentialStudioCount: int().default(0),
	residential1brPct: decimal({ precision: 5, scale: 2 }).default('0'),
	residential1brAvgArea: int().default(0),
	residential1brCount: int().default(0),
	residential2brPct: decimal({ precision: 5, scale: 2 }).default('0'),
	residential2brAvgArea: int().default(0),
	residential2brCount: int().default(0),
	residential3brPct: decimal({ precision: 5, scale: 2 }).default('0'),
	residential3brAvgArea: int().default(0),
	residential3brCount: int().default(0),
	retailSmallPct: decimal({ precision: 5, scale: 2 }).default('0'),
	retailSmallAvgArea: int().default(0),
	retailSmallCount: int().default(0),
	retailMediumPct: decimal({ precision: 5, scale: 2 }).default('0'),
	retailMediumAvgArea: int().default(0),
	retailMediumCount: int().default(0),
	retailLargePct: decimal({ precision: 5, scale: 2 }).default('0'),
	retailLargeAvgArea: int().default(0),
	retailLargeCount: int().default(0),
	officeSmallPct: decimal({ precision: 5, scale: 2 }).default('0'),
	officeSmallAvgArea: int().default(0),
	officeSmallCount: int().default(0),
	officeMediumPct: decimal({ precision: 5, scale: 2 }).default('0'),
	officeMediumAvgArea: int().default(0),
	officeMediumCount: int().default(0),
	officeLargePct: decimal({ precision: 5, scale: 2 }).default('0'),
	officeLargeAvgArea: int().default(0),
	officeLargeCount: int().default(0),
	finishingQuality: varchar({ length: 100 }).default('ممتاز'),
	isApproved: int().default(0).notNull(),
	approvedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const meetingFiles = mysqlTable("meetingFiles", {
	id: int().autoincrement().notNull(),
	meetingId: int().notNull().references(() => meetings.id, { onDelete: "cascade" } ),
	fileName: varchar({ length: 255 }).notNull(),
	fileUrl: varchar({ length: 1000 }).notNull(),
	fileKey: varchar({ length: 500 }).notNull(),
	fileType: varchar({ length: 50 }).notNull(),
	mimeType: varchar({ length: 100 }),
	fileSize: int(),
	extractedText: text(),
	uploadedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const meetingMessages = mysqlTable("meetingMessages", {
	id: int().autoincrement().notNull(),
	meetingId: int().notNull().references(() => meetings.id, { onDelete: "cascade" } ),
	speakerId: varchar({ length: 100 }).notNull(),
	speakerType: mysqlEnum(['user','agent']).notNull(),
	messageText: text().notNull(),
	audioUrl: varchar({ length: 1000 }),
	replyToId: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const meetingParticipants = mysqlTable("meetingParticipants", {
	id: int().autoincrement().notNull(),
	meetingId: int().notNull().references(() => meetings.id, { onDelete: "cascade" } ),
	agentId: int().notNull().references(() => agents.id),
	participantRole: mysqlEnum(['participant','observer']).default('participant').notNull(),
	joinedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const meetings = mysqlTable("meetings", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	title: varchar({ length: 500 }).notNull(),
	topic: text(),
	meetingStatus: mysqlEnum(['preparing','in_progress','completed','cancelled']).default('preparing').notNull(),
	createdBy: varchar({ length: 100 }).default('user').notNull(),
	startedAt: timestamp({ mode: 'string' }),
	endedAt: timestamp({ mode: 'string' }),
	minutesSummary: text(),
	decisionsJson: text(),
	extractedTasksJson: text(),
	knowledgeItemsJson: text(),
	audioRecordingUrl: varchar({ length: 1000 }),
	fullTranscript: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const modelUsageLog = mysqlTable("modelUsageLog", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	agent: varchar({ length: 50 }).notNull(),
	model: varchar({ length: 100 }).notNull(),
	responseTimeMs: int().notNull(),
	success: mysqlEnum(['true','false']).default('true').notNull(),
	isFallback: mysqlEnum(['true','false']).default('false').notNull(),
	inputTokens: int(),
	outputTokens: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const oauthTokens = mysqlTable("oauthTokens", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id, { onDelete: "cascade" } ),
	provider: varchar({ length: 50 }).notNull(),
	accessToken: text().notNull(),
	refreshToken: text(),
	expiresAt: timestamp({ mode: 'string' }),
	scope: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("oauthTokens_userId_unique").on(table.userId),
]);

export const projectCapitalSettings = mysqlTable("projectCapitalSettings", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	startDate: varchar({ length: 10 }).notNull(),
	totalBudget: decimal({ precision: 15, scale: 2 }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("projectCapitalSettings_projectId_unique").on(table.projectId),
]);

export const projectConsultants = mysqlTable("projectConsultants", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	consultantId: int().notNull().references(() => consultants.id, { onDelete: "cascade" } ),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const projectContracts = mysqlTable("projectContracts", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	contractTypeId: int().notNull().references(() => contractTypes.id),
	title: varchar({ length: 500 }).notNull(),
	contractNumber: varchar({ length: 100 }),
	partyA: varchar({ length: 255 }),
	partyB: varchar({ length: 255 }),
	contractValue: decimal({ precision: 15, scale: 2 }),
	currency: varchar({ length: 10 }).default('AED'),
	signDate: varchar({ length: 50 }),
	startDate: varchar({ length: 50 }),
	endDate: varchar({ length: 50 }),
	fileUrl: varchar({ length: 1000 }),
	fileKey: varchar({ length: 500 }),
	fileName: varchar({ length: 255 }),
	driveFileId: varchar({ length: 100 }),
	contractStatus: mysqlEnum(['draft','active','expired','terminated','renewed','pending']).default('draft').notNull(),
	contractAnalysisStatus: mysqlEnum(['not_analyzed','analyzing','completed','failed']).default('not_analyzed').notNull(),
	analysisSummary: text(),
	analysisKeyDates: text(),
	analysisPenalties: text(),
	analysisObligations: text(),
	analysisRisks: text(),
	analysisParties: text(),
	analysisTermination: text(),
	analysisNotes: text(),
	analysisFullJson: text(),
	analyzedAt: timestamp({ mode: 'string' }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const projectKpis = mysqlTable("projectKpis", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	name: varchar({ length: 500 }).notNull(),
	nameAr: varchar({ length: 500 }),
	description: text(),
	kpiCategory: mysqlEnum(['financial','timeline','quality','safety','sales','customer','operational']).default('operational').notNull(),
	targetValue: decimal({ precision: 15, scale: 2 }),
	currentValue: decimal({ precision: 15, scale: 2 }),
	unit: varchar({ length: 50 }),
	kpiTrend: mysqlEnum(['up','down','stable','na']).default('na').notNull(),
	kpiStatus: mysqlEnum(['on_track','at_risk','off_track','achieved','not_started']).default('not_started').notNull(),
	lastUpdatedBy: varchar({ length: 255 }),
	notes: text(),
	createdByMemberId: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const projectMilestones = mysqlTable("projectMilestones", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	title: varchar({ length: 500 }).notNull(),
	titleAr: varchar({ length: 500 }),
	description: text(),
	milestoneCategory: mysqlEnum(['planning','design','permits','construction','handover','sales','other']).default('other').notNull(),
	plannedStartDate: varchar({ length: 50 }),
	plannedEndDate: varchar({ length: 50 }),
	actualStartDate: varchar({ length: 50 }),
	actualEndDate: varchar({ length: 50 }),
	progressPercent: int().default(0).notNull(),
	milestoneStatus: mysqlEnum(['not_started','in_progress','delayed','completed','on_hold','cancelled']).default('not_started').notNull(),
	milestonePriority: mysqlEnum(['low','medium','high','critical']).default('medium').notNull(),
	sortOrder: int().default(0).notNull(),
	assignedTo: varchar({ length: 255 }),
	notes: text(),
	createdByMemberId: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const projectPhases = mysqlTable("projectPhases", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull().references(() => projects.id, { onDelete: "cascade" } ),
	phaseNumber: int().notNull(),
	phaseName: varchar({ length: 255 }).notNull(),
	startDate: varchar({ length: 10 }).notNull(),
	durationMonths: int().notNull(),
	endDate: varchar({ length: 10 }),
	estimatedCost: decimal({ precision: 15, scale: 2 }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const phaseActivities = mysqlTable("phaseActivities", {
	id: int().autoincrement().notNull(),
	phaseId: int().notNull().references(() => projectPhases.id, { onDelete: "cascade" } ),
	activityNumber: int().notNull(),
	activityName: varchar({ length: 255 }).notNull(),
	description: text(),
	startDate: varchar({ length: 10 }).notNull(),
	durationMonths: int().notNull(),
	endDate: varchar({ length: 10 }),
	estimatedCost: decimal({ precision: 15, scale: 2 }),
	progress: int().default(0).notNull(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const phaseCostLinks = mysqlTable("phaseCostLinks", {
	id: int().autoincrement().notNull(),
	phaseId: int().notNull().references(() => projectPhases.id, { onDelete: "cascade" } ),
	activityId: int().references(() => phaseActivities.id, { onDelete: "cascade" } ),
	costItemId: int().notNull().references(() => cfCostItems.id, { onDelete: "cascade" } ),
	allocatedAmount: decimal({ precision: 15, scale: 2 }).notNull(),
	allocationPercentage: decimal({ precision: 5, scale: 2 }),
	startMonth: varchar({ length: 10 }).notNull(),
	endMonth: varchar({ length: 10 }).notNull(),
	distributionType: mysqlEnum(['lump_sum','linear','milestone','custom']).default('linear').notNull(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const projects = mysqlTable("projects", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	bua: int(),
	pricePerSqft: int(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	plotNumber: varchar({ length: 50 }),
	areaCode: varchar({ length: 50 }),
	driveFolderId: varchar({ length: 100 }),
	titleDeedNumber: varchar({ length: 100 }),
	ddaNumber: varchar({ length: 100 }),
	masterDevRef: varchar({ length: 100 }),
	plotAreaSqm: decimal({ precision: 12, scale: 2 }),
	plotAreaSqft: decimal({ precision: 12, scale: 2 }),
	gfaSqm: decimal({ precision: 12, scale: 2 }),
	gfaSqft: decimal({ precision: 12, scale: 2 }),
	permittedUse: varchar({ length: 255 }),
	ownershipType: varchar({ length: 255 }),
	subdivisionRestrictions: text(),
	masterDevName: varchar({ length: 255 }),
	masterDevAddress: varchar({ length: 500 }),
	sellerName: varchar({ length: 255 }),
	sellerAddress: varchar({ length: 500 }),
	buyerName: varchar({ length: 255 }),
	buyerNationality: varchar({ length: 100 }),
	buyerPassport: varchar({ length: 50 }),
	buyerAddress: varchar({ length: 500 }),
	buyerPhone: varchar({ length: 50 }),
	buyerEmail: varchar({ length: 320 }),
	electricityAllocation: varchar({ length: 100 }),
	waterAllocation: varchar({ length: 100 }),
	sewageAllocation: varchar({ length: 100 }),
	tripAm: varchar({ length: 50 }),
	tripLt: varchar({ length: 50 }),
	tripPm: varchar({ length: 50 }),
	effectiveDate: varchar({ length: 50 }),
	constructionPeriod: varchar({ length: 255 }),
	constructionStartDate: varchar({ length: 255 }),
	completionDate: varchar({ length: 255 }),
	constructionConditions: text(),
	saleRestrictions: text(),
	resaleConditions: text(),
	communityCharges: text(),
	registrationAuthority: varchar({ length: 255 }),
	adminFee: int(),
	clearanceFee: int(),
	compensationAmount: int(),
	governingLaw: text(),
	disputeResolution: text(),
	manualBuaSqft: decimal({ precision: 14, scale: 2 }),
	soilTestFee: decimal({ precision: 14, scale: 2 }),
	topographicSurveyFee: decimal({ precision: 14, scale: 2 }),
	reraUnitRegFee: decimal({ precision: 14, scale: 2 }),
	developerNocFee: decimal({ precision: 14, scale: 2 }),
	escrowAccountFee: decimal({ precision: 14, scale: 2 }),
	bankFees: decimal({ precision: 14, scale: 2 }),
	communityFees: decimal({ precision: 14, scale: 2 }),
	surveyorFees: decimal({ precision: 14, scale: 2 }),
	reraAuditReportFee: decimal({ precision: 14, scale: 2 }),
	reraInspectionReportFee: decimal({ precision: 14, scale: 2 }),
	reraProjectRegFee: decimal({ precision: 14, scale: 2 }),
	officialBodiesFees: decimal({ precision: 14, scale: 2 }),
	landPrice: decimal({ precision: 14, scale: 2 }),
	agentCommissionLandPct: decimal({ precision: 5, scale: 2 }),
	estimatedConstructionPricePerSqft: decimal({ precision: 14, scale: 2 }),
	designFeePct: decimal({ precision: 5, scale: 2 }),
	supervisionFeePct: decimal({ precision: 5, scale: 2 }),
	separationFeePerSqft: decimal({ precision: 10, scale: 2 }),
	salesCommissionPct: decimal({ precision: 5, scale: 2 }),
	marketingPct: decimal({ precision: 5, scale: 2 }),
	developerFeePct: decimal({ precision: 5, scale: 2 }).default('5'),
	gfaResidentialSqft: decimal({ precision: 14, scale: 2 }),
	gfaRetailSqft: decimal({ precision: 14, scale: 2 }),
	gfaOfficesSqft: decimal({ precision: 14, scale: 2 }),
	saleableResidentialPct: decimal({ precision: 5, scale: 2 }).default('95'),
	saleableRetailPct: decimal({ precision: 5, scale: 2 }).default('97'),
	saleableOfficesPct: decimal({ precision: 5, scale: 2 }).default('95'),
	preConMonths: int().default(6),
	constructionMonths: int().default(16),
	handoverMonths: int().default(2),
	startDate: varchar({ length: 20 }),
	financingScenario: varchar({ length: 50 }).default('offplan_escrow'),
});

export const proposalComparisons = mysqlTable("proposalComparisons", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	projectId: int().references(() => projects.id),
	title: varchar({ length: 500 }).notNull(),
	proposalIds: text().notNull(),
	comparisonResult: text(),
	aiRecommendation: text(),
	winnerProposalId: int().references(() => consultantProposals.id),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const sentEmails = mysqlTable("sent_emails", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id),
	toEmail: varchar({ length: 320 }).notNull(),
	toName: varchar({ length: 255 }),
	subject: varchar({ length: 500 }).notNull(),
	body: longtext().notNull(),
	inReplyTo: varchar({ length: 500 }),
	originalEmailUid: int(),
	cc: varchar({ length: 1000 }),
	status: mysqlEnum(['sent','failed','pending']).default('sent').notNull(),
	errorMessage: text(),
	sentBy: varchar({ length: 50 }).default('salwa').notNull(),
	agentName: varchar({ length: 50 }).default('salwa'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const specialistKnowledge = mysqlTable("specialistKnowledge", {
	id: int().autoincrement().notNull(),
	knowledgeDomain: mysqlEnum(['rera_law','dubai_municipality','building_codes','market_prices','como_context','como_people','como_preferences','como_workflow','consultant_info','project_standards','general']).notNull(),
	category: varchar({ length: 100 }).notNull(),
	title: varchar({ length: 500 }).notNull(),
	content: longtext().notNull(),
	keywords: text(),
	source: varchar({ length: 255 }),
	sourceUrl: varchar({ length: 1000 }),
	isActive: int().default(1).notNull(),
	validFrom: timestamp({ mode: 'string' }),
	validUntil: timestamp({ mode: 'string' }),
	addedBy: varchar({ length: 50 }),
	lastUsedAt: timestamp({ mode: 'string' }),
	useCount: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const stageDocuments = mysqlTable("stage_documents", {
	id: int().autoincrement().notNull(),
	stageItemId: int().notNull(),
	projectId: int().notNull(),
	fileName: varchar({ length: 500 }).notNull(),
	fileUrl: text().notNull(),
	fileKey: varchar({ length: 500 }).notNull(),
	mimeType: varchar({ length: 100 }),
	fileSize: int(),
	uploadedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("idx_stage_docs_item").on(table.stageItemId),
	index("idx_stage_docs_project").on(table.projectId),
]);

export const stageItems = mysqlTable("stage_items", {
	id: int().autoincrement().notNull(),
	projectId: int().notNull(),
	phaseNumber: int().notNull(),
	sectionKey: varchar({ length: 20 }).notNull(),
	itemIndex: int().notNull(),
	title: text().notNull(),
	status: mysqlEnum(['not_started','in_progress','completed']).default('not_started').notNull(),
	isCustom: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	linkedTaskId: int(),
	dueDate: timestamp({ mode: 'string' }),
},
(table) => [
	index("idx_stage_items_project").on(table.projectId),
	index("idx_stage_items_phase").on(table.projectId, table.phaseNumber),
	index("idx_stage_items_section").on(table.projectId, table.sectionKey),
]);

export const taskCategories = mysqlTable("taskCategories", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	color: varchar({ length: 50 }).default('#8b5cf6'),
	icon: varchar({ length: 50 }),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	sortOrder: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("name").on(table.name),
]);

export const taskExecutionLogs = mysqlTable("taskExecutionLogs", {
	id: int().autoincrement().notNull(),
	taskId: int().references(() => tasks.id),
	meetingId: int().references(() => meetings.id),
	agent: varchar({ length: 50 }).notNull(),
	taskTitle: varchar({ length: 500 }).notNull(),
	actionPlanJson: text(),
	totalSteps: int().default(0).notNull(),
	completedSteps: int().default(0).notNull(),
	executionStatus: mysqlEnum(['planning','executing','verifying','completed','partial','failed','retrying']).default('planning').notNull(),
	attempt: int().default(1).notNull(),
	maxAttempts: int().default(2).notNull(),
	toolsUsedJson: text(),
	toolCallCount: int().default(0).notNull(),
	writeToolCount: int().default(0).notNull(),
	stepResultsJson: text(),
	verified: int().default(0).notNull(),
	verificationDetails: text(),
	dataChangesJson: text(),
	agentResponse: text(),
	errorMessage: text(),
	startedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	completedAt: timestamp({ mode: 'string' }),
	durationMs: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const taskProjects = mysqlTable("taskProjects", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	color: varchar({ length: 50 }).default('#6366f1'),
	icon: varchar({ length: 50 }),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	sortOrder: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("name").on(table.name),
]);

export const tasks = mysqlTable("tasks", {
	id: int().autoincrement().notNull(),
	title: varchar({ length: 500 }).notNull(),
	description: text(),
	project: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }),
	owner: varchar({ length: 255 }).notNull(),
	priority: mysqlEnum(['high','medium','low']).default('medium').notNull(),
	status: mysqlEnum(['new','progress','hold','done','cancelled']).default('new').notNull(),
	progress: int().default(0).notNull(),
	dueDate: varchar({ length: 20 }),
	attachment: varchar({ length: 1000 }),
	source: mysqlEnum(['manual','agent','command']).default('manual').notNull(),
	sourceAgent: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);


// Consultants & Technical Specialists Registry
export const consultantsRegistry = mysqlTable("consultants_registry", {
	id: int().autoincrement().notNull().primaryKey(),
	companyName: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	contactPerson: varchar({ length: 255 }),
	mobileNumber: varchar({ length: 20 }),
	emailAddress: varchar({ length: 255 }),
	website: varchar({ length: 255 }),
	status: mysqlEnum(['quoted_only', 'under_review', 'appointed', 'not_selected']).default('quoted_only').notNull(),
	notes: text(),
	userId: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("consultants_registry_userId").on(table.userId),
	index("consultants_registry_category").on(table.category),
	index("consultants_registry_status").on(table.status),
]);

// Consultants Registry - File Uploads
export const consultantsRegistryFiles = mysqlTable("consultants_registry_files", {
	id: int().autoincrement().notNull().primaryKey(),
	consultantId: int().notNull(),
	fileName: varchar({ length: 255 }).notNull(),
	fileKey: varchar({ length: 500 }).notNull(), // S3 key
	fileUrl: varchar({ length: 500 }).notNull(), // S3 URL
	fileType: varchar({ length: 50 }),
	fileSizeBytes: int(),
	uploadedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("consultants_registry_files_consultantId").on(table.consultantId),
]);

// Consultants Registry - Categories (dynamic)
export const consultantsCategories = mysqlTable("consultants_categories", {
	id: int().autoincrement().notNull().primaryKey(),
	categoryName: varchar({ length: 100 }).notNull(),
	userId: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("consultants_categories_userId").on(table.userId),
]);


// Joelle 10-Stage Market Analysis Workflow
export const joelleAnalysisStages = mysqlTable("joelle_analysis_stages", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int().notNull(),
	stageNumber: int().notNull(), // 1-10
	stageName: varchar({ length: 255 }).notNull(),
	stageStatus: mysqlEnum(['pending', 'running', 'completed', 'error']).default('pending').notNull(),
	stageOutput: longtext(), // The report/analysis text (markdown)
	stageDataJson: longtext(), // Structured data from this stage (JSON)
	errorMessage: text(),
	startedAt: timestamp({ mode: 'string' }),
	completedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("joelle_stages_user_project").on(table.userId, table.projectId),
	index("joelle_stages_project_stage").on(table.projectId, table.stageNumber),
]);

// Joelle Generated Reports (Stage 9 output - 5 separate reports)
export const joelleReports = mysqlTable("joelle_reports", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int().notNull(),
	reportType: mysqlEnum(['market_intelligence', 'competitive_landscape', 'product_strategy', 'pricing_strategy', 'executive_summary', 'competitive_analysis', 'demand_forecast', 'risk_analysis']).notNull(),
	reportTitle: varchar({ length: 500 }).notNull(),
	reportContent: longtext(), // Full report markdown
	reportDataJson: longtext(), // Structured data if any
	generatedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("joelle_reports_user_project").on(table.userId, table.projectId),
	index("joelle_reports_type").on(table.reportType),
]);

// ═══════════════════════════════════════════
// Market Reports Knowledge Base
// ═══════════════════════════════════════════
export const marketReports = mysqlTable("market_reports", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	source: mysqlEnum("source", ['CBRE', 'JLL', 'Knight_Frank', 'Savills', 'Colliers', 'Cushman_Wakefield', 'DXBInteract', 'Property_Monitor', 'Bayut', 'Property_Finder', 'DLD', 'Other']).notNull(),
	reportTitle: varchar({ length: 500 }).notNull(),
	reportType: mysqlEnum("report_type", ['market_overview', 'residential', 'commercial', 'office', 'hospitality', 'mixed_use', 'land', 'quarterly', 'annual', 'special']).notNull(),
	region: varchar({ length: 255 }),
	community: varchar({ length: 255 }),
	reportDate: varchar({ length: 50 }),
	reportYear: int(),
	reportQuarter: int(),
	fileName: varchar({ length: 500 }).notNull(),
	fileKey: varchar({ length: 500 }).notNull(),
	fileUrl: text().notNull(),
	fileSizeBytes: int(),
	mimeType: varchar({ length: 100 }),
	extractedText: longtext(),
	aiSummary: longtext(),
	keyMetrics: longtext(),
	tags: text(),
	processingStatus: mysqlEnum("processing_status", ['uploaded', 'extracting', 'summarizing', 'ready', 'error']).default('uploaded').notNull(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("market_reports_user").on(table.userId),
	index("market_reports_source").on(table.source),
	index("market_reports_community").on(table.community),
	index("market_reports_year_quarter").on(table.reportYear, table.reportQuarter),
]);

// ═══════════════════════════════════════════
// Project Risk Scores (from Engine 9)
// ═══════════════════════════════════════════
export const projectRiskScores = mysqlTable("project_risk_scores", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int().notNull(),
	pmriScore: decimal({ precision: 5, scale: 2 }),
	riskLevel: mysqlEnum("risk_level", ['low', 'medium', 'high', 'critical']).default('medium').notNull(),
	marketRisk: decimal({ precision: 5, scale: 2 }),
	financialRisk: decimal({ precision: 5, scale: 2 }),
	competitiveRisk: decimal({ precision: 5, scale: 2 }),
	regulatoryRisk: decimal({ precision: 5, scale: 2 }),
	executionRisk: decimal({ precision: 5, scale: 2 }),
	marketRiskDetails: longtext(),
	financialRiskDetails: longtext(),
	competitiveRiskDetails: longtext(),
	regulatoryRiskDetails: longtext(),
	executionRiskDetails: longtext(),
	mitigationStrategies: longtext(),
	analysisDate: timestamp({ mode: 'string' }),
	dataSourcesUsed: text(),
	confidenceLevel: decimal({ precision: 5, scale: 2 }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("risk_scores_user_project").on(table.userId, table.projectId),
	index("risk_scores_level").on(table.riskLevel),
]);

// ═══════════════════════════════════════════
// Self-Learning: Prediction Records
// ═══════════════════════════════════════════
export const predictionRecords = mysqlTable("prediction_records", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int().notNull(),
	predictionType: mysqlEnum("prediction_type", ['price_per_sqft', 'total_revenue', 'absorption_rate', 'sell_out_months', 'demand_units', 'construction_cost', 'roi', 'irr']).notNull(),
	predictedValue: decimal({ precision: 15, scale: 2 }).notNull(),
	predictedUnit: varchar({ length: 50 }),
	predictionDate: timestamp({ mode: 'string' }).notNull(),
	targetDate: timestamp({ mode: 'string' }),
	engineVersion: varchar({ length: 50 }),
	confidenceLevel: decimal({ precision: 5, scale: 2 }),
	inputDataJson: longtext(),
	methodology: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("predictions_user_project").on(table.userId, table.projectId),
	index("predictions_type").on(table.predictionType),
]);

// ═══════════════════════════════════════════
// Self-Learning: Actual Outcomes
// ═══════════════════════════════════════════
export const actualOutcomes = mysqlTable("actual_outcomes", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int().notNull(),
	predictionId: int(),
	outcomeType: mysqlEnum("outcome_type", ['price_per_sqft', 'total_revenue', 'absorption_rate', 'sell_out_months', 'demand_units', 'construction_cost', 'roi', 'irr']).notNull(),
	actualValue: decimal({ precision: 15, scale: 2 }).notNull(),
	actualUnit: varchar({ length: 50 }),
	recordedDate: timestamp({ mode: 'string' }).notNull(),
	source: varchar({ length: 255 }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("outcomes_user_project").on(table.userId, table.projectId),
	index("outcomes_prediction").on(table.predictionId),
]);

// ═══════════════════════════════════════════
// Self-Learning: Model Accuracy Tracking
// ═══════════════════════════════════════════
export const modelAccuracyLog = mysqlTable("model_accuracy_log", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int(),
	predictionType: mysqlEnum("accuracy_prediction_type", ['price_per_sqft', 'total_revenue', 'absorption_rate', 'sell_out_months', 'demand_units', 'construction_cost', 'roi', 'irr']).notNull(),
	mape: decimal({ precision: 8, scale: 4 }),
	biasDirection: mysqlEnum("bias_direction", ['over', 'under', 'neutral']).default('neutral'),
	biasAmount: decimal({ precision: 15, scale: 2 }),
	sampleSize: int(),
	adjustmentApplied: longtext(),
	periodStart: timestamp({ mode: 'string' }),
	periodEnd: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("accuracy_user").on(table.userId),
	index("accuracy_type").on(table.predictionType),
]);

// ============================================================
// PROJECT LIFECYCLE MANAGEMENT (Stages → Services → Requirements)
// ============================================================

/** Master list of lifecycle stages (STG-01 … STG-05, etc.) */
export const lifecycleStages = mysqlTable("lifecycle_stages", {
  id: int().autoincrement().notNull().primaryKey(),
  stageCode: varchar({ length: 30 }).notNull().unique(),   // e.g. STG-02
  nameAr: varchar({ length: 200 }).notNull(),
  nameEn: varchar({ length: 200 }),
  category: varchar({ length: 100 }),
  isActive: tinyint().notNull().default(1),
  descriptionAr: text(),
  defaultStatus: mysqlEnum("defaultStatus", ['not_started','in_progress','completed','locked']).default('not_started'),
  sortOrder: int().default(0),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("lc_stage_code").on(table.stageCode),
]);

/** Master list of services/transactions inside a stage */
export const lifecycleServices = mysqlTable("lifecycle_services", {
  id: int().autoincrement().notNull().primaryKey(),
  serviceCode: varchar({ length: 50 }).notNull().unique(),  // e.g. SRV-RERA-PROJ-REG
  stageCode: varchar({ length: 30 }).notNull(),
  nameAr: varchar({ length: 200 }).notNull(),
  descriptionAr: text(),
  externalParty: varchar({ length: 200 }),
  internalOwner: varchar({ length: 200 }),
  isMandatory: tinyint().default(1),
  expectedDurationDays: int().default(7),
  sortOrder: int().default(0),
  /** Comma-separated service codes this service depends on */
  dependsOn: text(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("lc_svc_stage").on(table.stageCode),
]);

/** Master list of requirements (checklist items) for each service */
export const lifecycleRequirements = mysqlTable("lifecycle_requirements", {
  id: int().autoincrement().notNull().primaryKey(),
  requirementCode: varchar({ length: 60 }).notNull().unique(),
  serviceCode: varchar({ length: 50 }).notNull(),
  reqType: mysqlEnum("reqType", ['document','data','approval','action']).default('document'),
  nameAr: varchar({ length: 300 }).notNull(),
  descriptionAr: text(),
  sourceNote: varchar({ length: 300 }),
  isMandatory: tinyint().default(1),
  timing: varchar({ length: 100 }).default('قبل التقديم'),
  internalOwner: varchar({ length: 200 }),
  sortOrder: int().default(0),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("lc_req_svc").on(table.serviceCode),
]);

/** Per-project instance of a service (tracks dates + operational status) */
export const projectServiceInstances = mysqlTable("project_service_instances", {
  id: int().autoincrement().notNull().primaryKey(),
  projectId: int().notNull(),
  serviceCode: varchar({ length: 50 }).notNull(),
  stageCode: varchar({ length: 30 }).notNull(),
  operationalStatus: mysqlEnum("operationalStatus", ['not_started','in_progress','completed','locked','submitted']).default('not_started'),
  plannedStartDate: varchar({ length: 20 }),
  plannedDueDate: varchar({ length: 20 }),
  actualStartDate: varchar({ length: 20 }),
  actualCloseDate: varchar({ length: 20 }),
  notes: text(),
  submittedAt: timestamp({ mode: 'string' }),
  submittedByUserId: int(),
  updatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("psi_project").on(table.projectId),
  index("psi_service").on(table.serviceCode),
]);

/** Per-project status of each requirement (the actual checklist) */
export const projectRequirementStatus = mysqlTable("project_requirement_status", {
  id: int().autoincrement().notNull().primaryKey(),
  projectId: int().notNull(),
  serviceCode: varchar({ length: 50 }).notNull(),
  requirementCode: varchar({ length: 60 }).notNull(),
  status: mysqlEnum("status", ['pending','completed','not_applicable']).default('pending'),
  fileUrl: text(),
  fileKey: text(),
  notes: text(),
  completedByUserId: int(),
  completedAt: timestamp({ mode: 'string' }),
  updatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("prs_project").on(table.projectId),
  index("prs_svc_req").on(table.serviceCode, table.requirementCode),
]);

/** Per-project stage status (overrides defaultStatus per project) */
export const projectStageStatus = mysqlTable("project_stage_status", {
  id: int().autoincrement().notNull().primaryKey(),
  projectId: int().notNull(),
  stageCode: varchar({ length: 30 }).notNull(),
  status: mysqlEnum("status", ['not_started','in_progress','completed','locked']).default('not_started'),
  updatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("pss_project").on(table.projectId),
]);

/** Master list of data fields per service (with project card mapping) */
export const stageFieldDefinitions = mysqlTable("stage_field_definitions", {
  id: int().autoincrement().notNull().primaryKey(),
  serviceCode: varchar({ length: 50 }).notNull(),
  fieldKey: varchar({ length: 80 }).notNull(),
  labelAr: varchar({ length: 200 }).notNull(),
  labelEn: varchar({ length: 200 }),
  fieldType: varchar({ length: 30 }).default('text'),
  source: mysqlEnum("source", ['project_fact_sheet','manual_input','company_settings','ai_agent']).default('manual_input'),
  requiredLevel: mysqlEnum("requiredLevel", ['required','optional','recommended']).default('required'),
  stageGroup: varchar({ length: 100 }),
  notes: text(),
  projectCardField: varchar({ length: 80 }),
  isMandatory: tinyint().default(1),
  sortOrder: int().default(0),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("sfd_service").on(table.serviceCode),
]);

/** Per-project values for each field (with source tracking) */
export const projectStageFieldValues = mysqlTable("project_stage_field_values", {
  id: int().autoincrement().notNull().primaryKey(),
  projectId: int().notNull(),
  serviceCode: varchar({ length: 50 }).notNull(),
  fieldKey: varchar({ length: 80 }).notNull(),
  value: text(),
  valueSource: mysqlEnum("valueSource", ['project_card','manual']).default('manual'),
  syncedAt: timestamp({ mode: 'string' }),
  updatedByUserId: int(),
  updatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("psfv_project_svc").on(table.projectId, table.serviceCode),
]);

/** Per-project documents for each requirement */
export const projectStageDocuments = mysqlTable("project_stage_documents", {
  id: int().autoincrement().notNull().primaryKey(),
  projectId: int().notNull(),
  serviceCode: varchar({ length: 50 }).notNull(),
  requirementCode: varchar({ length: 60 }).notNull(),
  fileName: varchar({ length: 300 }).notNull(),
  fileUrl: text().notNull(),
  fileKey: text().notNull(),
  mimeType: varchar({ length: 100 }),
  fileSizeBytes: int(),
  docStatus: mysqlEnum("docStatus", ['uploaded_pending_review','approved','rejected','not_uploaded']).default('uploaded_pending_review'),
  rejectionReason: text(),
  uploadedByUserId: int(),
  reviewedByUserId: int(),
  reviewedAt: timestamp({ mode: 'string' }),
  uploadedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
  index("psd_project_svc").on(table.projectId, table.serviceCode),
  index("psd_req").on(table.requirementCode),
]);

// ─────────────────────────────────────────────────────────────
// CONSULTANT PROPOSAL ANALYSIS MODULE (تحليل عروض الاستشاريين)
// ─────────────────────────────────────────────────────────────

// Table 1: cpa_building_categories
export const cpaBuildinCategories = mysqlTable("cpa_building_categories", {
  id: int().autoincrement().notNull().primaryKey(),
  code: varchar({ length: 20 }).notNull(),
  label: varchar({ length: 100 }).notNull(),
  buaMinSqft: decimal({ precision: 12, scale: 2 }),
  buaMaxSqft: decimal({ precision: 12, scale: 2 }),
  description: text(),
  sortOrder: int().notNull().default(0),
  isActive: tinyint().notNull().default(1),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Table 2: cpa_scope_sections
export const cpaScopeSections = mysqlTable("cpa_scope_sections", {
  id: int().autoincrement().notNull().primaryKey(),
  code: varchar({ length: 50 }).notNull(),
  label: varchar({ length: 200 }).notNull(),
  sortOrder: int().notNull().default(0),
  isActive: tinyint().notNull().default(1),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Table 3: cpa_scope_items
export const cpaScopeItems = mysqlTable("cpa_scope_items", {
  id: int().autoincrement().notNull().primaryKey(),
  itemNumber: int().notNull(),
  code: varchar({ length: 50 }).notNull(),
  label: varchar({ length: 200 }).notNull(),
  sectionId: int(),
  defaultType: mysqlEnum("cpa_si_defaultType", ['CORE', 'GREEN', 'RED', 'CONTRACTOR']).notNull().default('CORE'),
  description: text(),
  sortOrder: int().notNull().default(0),
  isActive: tinyint().notNull().default(1),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Table 4: cpa_scope_category_matrix
export const cpaScopeCategoryMatrix = mysqlTable("cpa_scope_category_matrix", {
  id: int().autoincrement().notNull().primaryKey(),
  scopeItemId: int().notNull(),
  buildingCategoryId: int().notNull(),
  status: mysqlEnum("cpa_scm_status", ['INCLUDED', 'GREEN', 'RED', 'CONTRACTOR', 'NOT_REQUIRED']).notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_scm_item_cat").on(table.scopeItemId, table.buildingCategoryId),
]);

// Table 5: cpa_scope_reference_costs
export const cpaScopeReferenceCosts = mysqlTable("cpa_scope_reference_costs", {
  id: int().autoincrement().notNull().primaryKey(),
  scopeItemId: int().notNull(),
  buildingCategoryId: int().notNull(),
  costAed: decimal({ precision: 15, scale: 2 }),
  notes: text(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_src_item_cat").on(table.scopeItemId, table.buildingCategoryId),
]);

// Table 6: cpa_supervision_roles
export const cpaSupervisionRoles = mysqlTable("cpa_supervision_roles", {
  id: int().autoincrement().notNull().primaryKey(),
  code: varchar({ length: 50 }).notNull(),
  label: varchar({ length: 200 }).notNull(),
  grade: varchar({ length: 50 }),
  teamType: mysqlEnum("cpa_sr_teamType", ['SITE', 'HEAD_OFFICE']).notNull().default('SITE'),
  monthlyRateAed: decimal({ precision: 12, scale: 2 }).notNull(),
  sortOrder: int().notNull().default(0),
  isActive: tinyint().notNull().default(1),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Table 7: cpa_supervision_baseline
export const cpaSupervisionBaseline = mysqlTable("cpa_supervision_baseline", {
  id: int().autoincrement().notNull().primaryKey(),
  supervisionRoleId: int().notNull(),
  buildingCategoryId: int().notNull(),
  requiredAllocationPct: decimal({ precision: 5, scale: 2 }).notNull().default('0'),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_sb_role_cat").on(table.supervisionRoleId, table.buildingCategoryId),
]);

// Table 8: cpa_consultants_master
export const cpaConsultantsMaster = mysqlTable("cpa_consultants_master", {
  id: int().autoincrement().notNull().primaryKey(),
  code: varchar({ length: 50 }).notNull(),
  legalName: varchar({ length: 300 }).notNull(),
  tradeName: varchar({ length: 300 }),
  registrationNo: varchar({ length: 100 }),
  specialties: text(),
  contactEmail: varchar({ length: 200 }),
  contactPhone: varchar({ length: 50 }),
  isActive: tinyint().notNull().default(1),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Table 9: cpa_projects
export const cpaProjects = mysqlTable("cpa_projects", {
  id: int().autoincrement().notNull().primaryKey(),
  projectId: int().notNull(),
  plotNumber: varchar({ length: 50 }).notNull(),
  location: varchar({ length: 300 }),
  projectType: mysqlEnum("cpa_proj_type", ['RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'OTHER']).default('RESIDENTIAL'),
  description: varchar({ length: 500 }),
  buaSqft: decimal({ precision: 12, scale: 2 }).notNull(),
  buildingCategoryId: int(),
  constructionCostPerSqft: decimal({ precision: 10, scale: 2 }).notNull(),
  durationMonths: int().notNull(),
  status: mysqlEnum("cpa_proj_status", ['ACTIVE', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_proj_project_id").on(table.projectId),
]);

// Table 10: cpa_project_consultants
export const cpaProjectConsultants = mysqlTable("cpa_project_consultants", {
  id: int().autoincrement().notNull().primaryKey(),
  cpaProjectId: int().notNull(),
  consultantId: int().notNull(),
  proposalDate: varchar({ length: 20 }),
  proposalReference: varchar({ length: 200 }),
  designFeeAmount: decimal({ precision: 15, scale: 2 }),
  designFeeMethod: mysqlEnum("cpa_pc_dfm", ['LUMP_SUM', 'PERCENTAGE', 'MONTHLY_RATE']),
  designFeePercentage: decimal({ precision: 7, scale: 4 }),
  supervisionFeeAmount: decimal({ precision: 15, scale: 2 }),
  supervisionFeeMethod: mysqlEnum("cpa_pc_sfm", ['LUMP_SUM', 'PERCENTAGE', 'MONTHLY_RATE']),
  supervisionFeePercentage: decimal({ precision: 7, scale: 4 }),
  supervisionStatedDurationMonths: int(),
  supervisionSubmitted: tinyint().notNull().default(0),
  importJson: longtext(),
  status: mysqlEnum("cpa_pc_status", ['DRAFT', 'CONFIRMED', 'EVALUATED']).default('DRAFT'),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_pc_project").on(table.cpaProjectId),
  index("cpa_pc_consultant").on(table.consultantId),
]);

// Table 11: cpa_consultant_scope_coverage
export const cpaConsultantScopeCoverage = mysqlTable("cpa_consultant_scope_coverage", {
  id: int().autoincrement().notNull().primaryKey(),
  projectConsultantId: int().notNull(),
  scopeItemId: int().notNull(),
  coverageStatus: mysqlEnum("cpa_csc_status", ['INCLUDED', 'EXCLUDED', 'NOT_MENTIONED']).notNull().default('NOT_MENTIONED'),
  notes: text(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_csc_pc_item").on(table.projectConsultantId, table.scopeItemId),
]);

// Table 12: cpa_consultant_supervision_team
export const cpaConsultantSupervisionTeam = mysqlTable("cpa_consultant_supervision_team", {
  id: int().autoincrement().notNull().primaryKey(),
  projectConsultantId: int().notNull(),
  supervisionRoleId: int().notNull(),
  proposedAllocationPct: decimal({ precision: 5, scale: 2 }).notNull().default('0'),
  proposedMonthlyRate: decimal({ precision: 12, scale: 2 }),
  notes: text(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_cst_pc_role").on(table.projectConsultantId, table.supervisionRoleId),
]);

// Table 13: cpa_evaluation_results
export const cpaEvaluationResults = mysqlTable("cpa_evaluation_results", {
  id: int().autoincrement().notNull().primaryKey(),
  projectConsultantId: int().notNull(),
  quotedDesignFee: decimal({ precision: 15, scale: 2 }),
  designScopeGapCost: decimal({ precision: 15, scale: 2 }),
  trueDesignFee: decimal({ precision: 15, scale: 2 }),
  quotedSupervisionFee: decimal({ precision: 15, scale: 2 }),
  supervisionGapCost: decimal({ precision: 15, scale: 2 }),
  adjustedSupervisionFee: decimal({ precision: 15, scale: 2 }),
  totalTrueCost: decimal({ precision: 15, scale: 2 }),
  evalRank: int(),
  canRank: tinyint().notNull().default(1),
  calculationNotes: longtext(),
  calculatedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cpa_er_pc").on(table.projectConsultantId),
]);

// ═══════════════════════════════════════════
// Project Phase Delays (persisted from Capital Scheduling)
// ═══════════════════════════════════════════
export const projectPhaseDelays = mysqlTable("project_phase_delays", {
	id: int().autoincrement().notNull().primaryKey(),
	userId: int().notNull(),
	projectId: int().notNull(),
	designDelay: int().default(0).notNull(),
	offplanDelay: int().default(0).notNull(),
	constructionDelay: int().default(0).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("ppd_user_project").on(table.userId, table.projectId),
]);

// ═══════════════════════════════════════════
// Cost Distribution Rules — قواعد توزيع التكاليف
// The master table that defines how each cost line item is distributed
// across project phases and months. This is the foundation for all
// financial schedules and capital planning reports.
// ═══════════════════════════════════════════
export const costDistributionRules = mysqlTable("cost_distribution_rules", {
  id: int().autoincrement().notNull().primaryKey(),

  // ── Identity ────────────────────────────────────────────────────
  sortOrder: int("sort_order").default(0).notNull(),        // display order
  itemKey: varchar("item_key", { length: 100 }).notNull(),  // stable code (e.g. "land_cost")
  nameAr: varchar("name_ar", { length: 255 }).notNull(),    // Arabic label
  nameEn: varchar("name_en", { length: 255 }),              // English label (optional)

  // ── Amount ──────────────────────────────────────────────────────
  // How is the amount determined?
  //   "fixed"   — a hard AED amount stored in `fixedAmount`
  //   "pct_construction" — % of construction cost
  //   "pct_revenue"      — % of total revenue
  //   "pct_land"         — % of land price
  amountType: mysqlEnum("amount_type", ["fixed", "pct_construction", "pct_revenue", "pct_land"]).notNull(),
  fixedAmount: decimal("fixed_amount", { precision: 18, scale: 2 }),  // used when amountType = "fixed"
  pctValue: decimal("pct_value", { precision: 8, scale: 4 }),         // used for pct_* types (e.g. 0.0200 = 2%)

  // ── Source ──────────────────────────────────────────────────────
  // Who pays this item?
  source: mysqlEnum("source", ["investor", "escrow"]).notNull(),

  // ── Phase ───────────────────────────────────────────────────────
  // Which project phase does this item primarily belong to?
  //   1 = land (already paid)
  //   2 = design & approvals
  //   3 = off-plan registration
  //   4 = construction
  primaryPhase: mysqlEnum("primary_phase", ["land", "design", "offplan", "construction", "handover"]).notNull(),

  // ── Distribution Method ─────────────────────────────────────────
  // How is the amount spread over time?
  //   "lump_sum"          — single payment at a specific relative month
  //   "equal_spread"      — divided equally across phase duration
  //   "split_ratio"       — split across multiple phases by ratio (stored in splitRatioJson)
  //   "sales_linked"      — proportional to monthly revenue
  //   "periodic"          — fixed payment every N months
  //   "custom"            — fully custom (stored in customJson)
  distributionMethod: mysqlEnum("distribution_method", [
    "lump_sum", "equal_spread", "split_ratio", "sales_linked", "periodic", "custom"
  ]).notNull(),

  // Relative month within the phase for lump_sum (1 = first month, -1 = last month)
  relativeMonth: int("relative_month").default(1),

  // For split_ratio: JSON array of {phase, ratio} e.g. [{"phase":"design","ratio":0.3},...]
  splitRatioJson: text("split_ratio_json"),

  // For periodic: interval in months and amount per period
  periodicIntervalMonths: int("periodic_interval_months"),
  periodicAmount: decimal("periodic_amount", { precision: 18, scale: 2 }),

  // For custom: free-form JSON for complex distributions
  customJson: text("custom_json"),

  // ── Notes ───────────────────────────────────────────────────────
  notes: text("notes"),

  // ── Audit ───────────────────────────────────────────────────────
  isActive: tinyint("is_active").default(1).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("cdr_item_key").on(table.itemKey),
  index("cdr_sort_order").on(table.sortOrder),
]);

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT CASH FLOW SETTINGS — إعدادات التدفق النقدي للمشروع
// Stores per-project, per-scenario configuration for each cash flow item.
// Each row represents one cost/revenue line item's time-distribution settings.
// ═══════════════════════════════════════════════════════════════════════════
export const projectCashFlowSettings = mysqlTable("project_cash_flow_settings", {
  id: int().autoincrement().notNull().primaryKey(),

  // ── Project + Scenario ──────────────────────────────────────────────────
  projectId: int("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  // Which financing scenario these settings apply to
  scenario: mysqlEnum("scenario", ["offplan_escrow", "offplan_construction", "no_offplan"]).notNull().default("offplan_escrow"),

  // ── Item Identity ────────────────────────────────────────────────────────
  // Stable key matching the item in investorCashFlow.ts (e.g. "land_price", "construction_cost")
  itemKey: varchar("item_key", { length: 100 }).notNull(),
  // Display label in Arabic
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  // Category for grouping (cost/revenue)
  category: mysqlEnum("category", [
    "land", "design", "offplan_reg", "construction", "marketing_sales",
    "admin", "developer_fee", "revenue", "other"
  ]).notNull().default("other"),
  // Display section in جدول الانعكاس (overrides category-based mapping)
  section: mysqlEnum("section", ["paid", "design", "offplan", "construction", "escrow"]).default("construction"),
  // Whether this item is visible/active for the current scenario
  isActive: tinyint("is_active").notNull().default(1),
  // Sort order for display
  sortOrder: int("sort_order").notNull().default(0),

  // ── Amount (pulled from fact sheet / feasibility study at runtime) ───────
  // The amount is NOT stored here — it's always pulled live from the project data.
  // These fields only override the amount if the user wants a manual override.
  amountOverride: decimal("amount_override", { precision: 18, scale: 2 }),

  // ── Time Distribution Settings ───────────────────────────────────────────
  // Distribution method:
  //   "lump_sum"    — single payment at a specific month
  //   "equal_spread" — divided equally from startMonth to endMonth
  //   "custom"      — fully custom per-month amounts stored in customJson
  distributionMethod: mysqlEnum("distribution_method", [
    "lump_sum", "equal_spread", "custom"
  ]).notNull().default("equal_spread"),

  // For lump_sum: which month (1-based relative to project start)
  lumpSumMonth: int("lump_sum_month"),

  // For equal_spread: start and end month (1-based relative to project start)
  startMonth: int("start_month"),
  endMonth: int("end_month"),

  // For custom: JSON array of {month: number, amount: number} or {month: number, pct: number}
  customJson: text("custom_json"),

  // ── Funding Source ───────────────────────────────────────────────────────
  // Who pays this item?
  fundingSource: mysqlEnum("funding_source", ["investor", "escrow"]).notNull().default("investor"),

  // ── Notes ────────────────────────────────────────────────────────────────
  notes: text("notes"),

  // ── Audit ────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
  index("pcfs_project_scenario").on(table.projectId, table.scenario),
  index("pcfs_item_key").on(table.itemKey),
]);

// ── Business Partners & Vendors Registry ─────────────────────────────────────
export const businessPartners = mysqlTable("business_partners", {
  id: int("id").autoincrement().notNull(),
  // Company Info
  companyName: varchar("company_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  contactPerson: varchar("contact_person", { length: 255 }),
  mobileNumber: varchar("mobile_number", { length: 50 }),
  emailAddress: varchar("email_address", { length: 255 }),
  website: varchar("website", { length: 255 }),
  status: mysqlEnum("status", ["quoted_only", "under_review", "appointed", "not_selected"]).default("quoted_only").notNull(),
  notes: text("notes"),
  // Documents (S3 URLs)
  commercialLicenseUrl: text("commercial_license_url"),
  commercialLicenseName: varchar("commercial_license_name", { length: 255 }),
  vatCertificateUrl: text("vat_certificate_url"),
  vatCertificateName: varchar("vat_certificate_name", { length: 255 }),
  authorizedSignatoryDocUrl: text("authorized_signatory_doc_url"),
  authorizedSignatoryDocName: varchar("authorized_signatory_doc_name", { length: 255 }),
  otherDocumentsJson: text("other_documents_json"), // JSON array of {url, name}
  // Bank Account Details
  beneficiaryName: varchar("beneficiary_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 100 }),
  iban: varchar("iban", { length: 100 }),
  bankName: varchar("bank_name", { length: 255 }),
  branchName: varchar("branch_name", { length: 255 }),
  currency: varchar("currency", { length: 10 }).default("AED"),
  bankNotes: text("bank_notes"),
  // Authorized Signatory
  signatoryName: varchar("signatory_name", { length: 255 }),
  signatoryTitle: varchar("signatory_title", { length: 255 }),
  signatoryEmail: varchar("signatory_email", { length: 255 }),
  signatoryPhone: varchar("signatory_phone", { length: 50 }),
  signatoryImageUrl: text("signatory_image_url"),
  // Audit
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
});

// ── Payment Requests ──────────────────────────────────────────────────────────
export const paymentRequests = mysqlTable("payment_requests", {
  id: int("id").autoincrement().notNull(),
  requestNumber: varchar("request_number", { length: 50 }).notNull(), // PAY-2026-001
  partnerId: int("partner_id").notNull().references(() => businessPartners.id),
  projectName: varchar("project_name", { length: 255 }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("AED").notNull(),
  // Approved Quote
  approvedQuoteUrl: text("approved_quote_url"),
  approvedQuoteName: varchar("approved_quote_name", { length: 255 }),
  // Contract Document
  contractUrl: text("contract_url"),
  contractName: varchar("contract_name", { length: 255 }),
  // Additional Attachments (JSON array of {url, name})
  additionalAttachments: text("additional_attachments"),
  // Auto-generated Payment Order PDF
  paymentOrderPdfUrl: text("payment_order_pdf_url"),
  // Status: new → pending_wael → pending_sheikh → approved / rejected / needs_revision / disbursed
  status: mysqlEnum("status", ["new", "pending_wael", "pending_sheikh", "approved", "rejected", "needs_revision", "disbursed"]).default("new").notNull(),
  // Wael Review
  waelReviewedAt: timestamp("wael_reviewed_at", { mode: "string" }),
  waelDecision: mysqlEnum("wael_decision", ["approved", "rejected", "needs_revision"]),
  waelNotes: text("wael_notes"),
  // Sheikh Issa Review
  sheikhReviewedAt: timestamp("sheikh_reviewed_at", { mode: "string" }),
  sheikhDecision: mysqlEnum("sheikh_decision", ["approved", "rejected", "needs_revision"]),
  sheikhNotes: text("sheikh_notes"),
  // Finance Email
  financeEmailSentAt: timestamp("finance_email_sent_at", { mode: "string" }),
  // Disbursement
  disbursedAt: timestamp("disbursed_at", { mode: "string" }),
  disbursedBy: int("disbursed_by").references(() => users.id),
  disbursementNote: text("disbursement_note"),
  // Stamp
  stampedQuoteUrl: text("stamped_quote_url"),
  // Submitter
  submittedBy: int("submitted_by").references(() => users.id),
  // Archive
  isArchived: tinyint("is_archived").default(0).notNull(),
  archivedAt: timestamp("archived_at", { mode: "string" }),
  // Audit
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
});

// ── Portfolio Scenarios ───────────────────────────────────────────────────────
// Stores user-saved capital portfolio view settings (option selections, delays, visibility)
export const portfolioScenarios = mysqlTable("portfolio_scenarios", {
  id: int("id").autoincrement().notNull(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull().default("الإعداد الافتراضي"),
  isDefault: tinyint("is_default").default(0).notNull(),
  // JSON blob: { projectSettings: { [projectId]: { option, designDelay, offplanDelay, constructionDelay, hidden } } }
  settings: text("settings").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
});

// ── Approval Settings ─────────────────────────────────────────────────────────
// Stores configurable approver info for payment request workflow
export const approvalSettings = mysqlTable("approval_settings", {
  id: int("id").autoincrement().notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
});

// ── General Requests & Inquiries ──────────────────────────────────────────────
// Non-financial requests: proposal approval, contract approval, meeting request, Zoom, inquiry, decision
export const generalRequests = mysqlTable("general_requests", {
  id: int("id").autoincrement().notNull(),
  requestNumber: varchar("request_number", { length: 50 }).notNull(), // REQ-2026-001
  requestType: mysqlEnum("request_type", [
    "proposal_approval",   // اعتماد عرض
    "contract_approval",   // اعتماد عقد
    "meeting_request",     // طلب اجتماع
    "zoom_meeting",        // اجتماع زووم
    "inquiry",             // استفسار
    "decision_request",    // طلب قرار
    "other",               // أخرى
  ]).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  description: text("description").notNull(),
  projectName: varchar("project_name", { length: 255 }),
  // Linked project (from projects table — centralised source)
  projectId: int("project_id").references(() => projects.id),
  relatedParty: varchar("related_party", { length: 255 }), // consultant / contractor / partner name
  // Linked partner (from businessPartners table)
  partnerId: int("partner_id").references(() => businessPartners.id),
  // Attachment (e.g., proposal PDF, contract draft) — kept for backwards compat
  attachmentUrl: text("attachment_url"),
  attachmentName: varchar("attachment_name", { length: 255 }),
  // Contract document
  contractUrl: text("contract_url"),
  contractName: varchar("contract_name", { length: 255 }),
  // Additional attachments (JSON array of {url, name})
  additionalAttachments: text("additional_attachments"),
  // Unified multi-file attachments (JSON array of {name, url, size?, type?})
  attachmentsJson: text("attachments_json"),
  // Official approval document PDF (generated on Sheikh Issa approval)
  approvalDocumentUrl: text("approval_document_url"),
  // Recommended company for proposal_approval type
  recommendedCompanyId: int("recommended_company_id").references(() => businessPartners.id),
  recommendedCompanyName: varchar("recommended_company_name", { length: 255 }),
  // Proposed meeting date/time (for meeting requests)
  proposedDate: varchar("proposed_date", { length: 100 }),
  // Status: new → pending_wael → pending_sheikh → approved / rejected / needs_revision
  status: mysqlEnum("status", ["new", "pending_wael", "pending_sheikh", "approved", "rejected", "needs_revision"]).default("new").notNull(),
  // Wael Review
  waelReviewedAt: timestamp("wael_reviewed_at", { mode: "string" }),
  waelDecision: mysqlEnum("wael_decision", ["approved", "rejected", "needs_revision"]),
  waelNotes: text("wael_notes"),
  // Sheikh Issa Review
  sheikhReviewedAt: timestamp("sheikh_reviewed_at", { mode: "string" }),
  sheikhDecision: mysqlEnum("sheikh_decision", ["approved", "rejected", "needs_revision"]),
  sheikhNotes: text("sheikh_notes"),
  // Finance Email (sent after approval)
  financeEmailSentAt: timestamp("finance_email_sent_at", { mode: "string" }),
  // Submitter
  submittedBy: int("submitted_by").references(() => users.id),
  // Archive
  isArchived: tinyint("is_archived").default(0).notNull(),
  archivedAt: timestamp("archived_at", { mode: "string" }),
  // Audit
  createdAt: timestamp("created_at", { mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
});
