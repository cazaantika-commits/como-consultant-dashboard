import { relations } from "drizzle-orm/relations";
import { projects, aiAdvisoryScores, consultants, cfProjects, cfCostItems, cfFiles, users, cfScenarios, commandCenterEvaluations, commandCenterItems, commandCenterResponses, committeeDecisions, evaluationSessions, competitionPricing, consultantDetails, consultantNotes, consultantPortfolio, consultantProfiles, consultantProposals, contractTypes, costsCashFlow, designsAndPermits, evaluationApprovals, evaluationResults, evaluationScores, evaluationSessionMembers, evaluatorScores, feasibilityStudies, financialData, knowledgeBase, agentAssignments, legalSetupRecords, marketOverview, meetings, meetingFiles, meetingMessages, meetingParticipants, agents, oauthTokens, projectCapitalSettings, projectConsultants, projectContracts, projectKpis, projectMilestones, projectPhases, proposalComparisons, sentEmails, tasks, taskExecutionLogs } from "./schema";

export const aiAdvisoryScoresRelations = relations(aiAdvisoryScores, ({one}) => ({
	project: one(projects, {
		fields: [aiAdvisoryScores.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [aiAdvisoryScores.consultantId],
		references: [consultants.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	aiAdvisoryScores: many(aiAdvisoryScores),
	cfProjects: many(cfProjects),
	commandCenterEvaluations: many(commandCenterEvaluations),
	commandCenterItems: many(commandCenterItems),
	committeeDecisions: many(committeeDecisions),
	competitionPricings: many(competitionPricing),
	consultantProposals: many(consultantProposals),
	costsCashFlows: many(costsCashFlow),
	designsAndPermits: many(designsAndPermits),
	evaluationApprovals: many(evaluationApprovals),
	evaluationResults: many(evaluationResults),
	evaluationScores: many(evaluationScores),
	evaluationSessions: many(evaluationSessions),
	evaluatorScores: many(evaluatorScores),
	feasibilityStudies: many(feasibilityStudies),
	financialData: many(financialData),
	knowledgeBases: many(knowledgeBase),
	legalSetupRecords: many(legalSetupRecords),
	marketOverviews: many(marketOverview),
	projectCapitalSettings: many(projectCapitalSettings),
	projectConsultants: many(projectConsultants),
	projectContracts: many(projectContracts),
	projectKpis: many(projectKpis),
	projectMilestones: many(projectMilestones),
	projectPhases: many(projectPhases),
	user: one(users, {
		fields: [projects.userId],
		references: [users.id]
	}),
	proposalComparisons: many(proposalComparisons),
}));

export const consultantsRelations = relations(consultants, ({one, many}) => ({
	aiAdvisoryScores: many(aiAdvisoryScores),
	commandCenterEvaluations: many(commandCenterEvaluations),
	commandCenterItems: many(commandCenterItems),
	committeeDecisions: many(committeeDecisions),
	consultantDetails: many(consultantDetails),
	consultantNotes: many(consultantNotes),
	consultantPortfolios: many(consultantPortfolio),
	consultantProfiles: many(consultantProfiles),
	consultantProposals: many(consultantProposals),
	user: one(users, {
		fields: [consultants.userId],
		references: [users.id]
	}),
	evaluationResults: many(evaluationResults),
	evaluationScores: many(evaluationScores),
	evaluationSessions: many(evaluationSessions),
	evaluatorScores: many(evaluatorScores),
	financialData: many(financialData),
	knowledgeBases: many(knowledgeBase),
	projectConsultants: many(projectConsultants),
}));

export const cfCostItemsRelations = relations(cfCostItems, ({one}) => ({
	cfProject: one(cfProjects, {
		fields: [cfCostItems.cfProjectId],
		references: [cfProjects.id]
	}),
}));

export const cfProjectsRelations = relations(cfProjects, ({one, many}) => ({
	cfCostItems: many(cfCostItems),
	cfFiles: many(cfFiles),
	project: one(projects, {
		fields: [cfProjects.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [cfProjects.userId],
		references: [users.id]
	}),
	cfScenarios: many(cfScenarios),
}));

export const cfFilesRelations = relations(cfFiles, ({one}) => ({
	cfProject: one(cfProjects, {
		fields: [cfFiles.cfProjectId],
		references: [cfProjects.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	cfProjects: many(cfProjects),
	competitionPricings: many(competitionPricing),
	consultantNotes: many(consultantNotes),
	consultants: many(consultants),
	contractTypes: many(contractTypes),
	costsCashFlows: many(costsCashFlow),
	designsAndPermits: many(designsAndPermits),
	feasibilityStudies: many(feasibilityStudies),
	legalSetupRecords: many(legalSetupRecords),
	marketOverviews: many(marketOverview),
	oauthTokens: many(oauthTokens),
	projectContracts: many(projectContracts),
	projects: many(projects),
	sentEmails: many(sentEmails),
}));

export const cfScenariosRelations = relations(cfScenarios, ({one}) => ({
	cfProject: one(cfProjects, {
		fields: [cfScenarios.cfProjectId],
		references: [cfProjects.id]
	}),
}));

export const commandCenterEvaluationsRelations = relations(commandCenterEvaluations, ({one}) => ({
	project: one(projects, {
		fields: [commandCenterEvaluations.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [commandCenterEvaluations.consultantId],
		references: [consultants.id]
	}),
}));

export const commandCenterItemsRelations = relations(commandCenterItems, ({one, many}) => ({
	project: one(projects, {
		fields: [commandCenterItems.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [commandCenterItems.consultantId],
		references: [consultants.id]
	}),
	commandCenterResponses: many(commandCenterResponses),
}));

export const commandCenterResponsesRelations = relations(commandCenterResponses, ({one}) => ({
	commandCenterItem: one(commandCenterItems, {
		fields: [commandCenterResponses.itemId],
		references: [commandCenterItems.id]
	}),
}));

export const committeeDecisionsRelations = relations(committeeDecisions, ({one}) => ({
	project: one(projects, {
		fields: [committeeDecisions.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [committeeDecisions.selectedConsultantId],
		references: [consultants.id]
	}),
	evaluationSession: one(evaluationSessions, {
		fields: [committeeDecisions.sessionId],
		references: [evaluationSessions.id]
	}),
}));

export const evaluationSessionsRelations = relations(evaluationSessions, ({one, many}) => ({
	committeeDecisions: many(committeeDecisions),
	evaluationResults: many(evaluationResults),
	evaluationSessionMembers: many(evaluationSessionMembers),
	project: one(projects, {
		fields: [evaluationSessions.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [evaluationSessions.consultantId],
		references: [consultants.id]
	}),
	evaluatorScores: many(evaluatorScores),
}));

export const competitionPricingRelations = relations(competitionPricing, ({one}) => ({
	user: one(users, {
		fields: [competitionPricing.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [competitionPricing.projectId],
		references: [projects.id]
	}),
}));

export const consultantDetailsRelations = relations(consultantDetails, ({one}) => ({
	consultant: one(consultants, {
		fields: [consultantDetails.consultantId],
		references: [consultants.id]
	}),
}));

export const consultantNotesRelations = relations(consultantNotes, ({one}) => ({
	consultant: one(consultants, {
		fields: [consultantNotes.consultantId],
		references: [consultants.id]
	}),
	user: one(users, {
		fields: [consultantNotes.userId],
		references: [users.id]
	}),
}));

export const consultantPortfolioRelations = relations(consultantPortfolio, ({one}) => ({
	consultant: one(consultants, {
		fields: [consultantPortfolio.consultantId],
		references: [consultants.id]
	}),
}));

export const consultantProfilesRelations = relations(consultantProfiles, ({one}) => ({
	consultant: one(consultants, {
		fields: [consultantProfiles.consultantId],
		references: [consultants.id]
	}),
}));

export const consultantProposalsRelations = relations(consultantProposals, ({one, many}) => ({
	consultant: one(consultants, {
		fields: [consultantProposals.consultantId],
		references: [consultants.id]
	}),
	project: one(projects, {
		fields: [consultantProposals.projectId],
		references: [projects.id]
	}),
	proposalComparisons: many(proposalComparisons),
}));

export const contractTypesRelations = relations(contractTypes, ({one, many}) => ({
	user: one(users, {
		fields: [contractTypes.userId],
		references: [users.id]
	}),
	projectContracts: many(projectContracts),
}));

export const costsCashFlowRelations = relations(costsCashFlow, ({one}) => ({
	user: one(users, {
		fields: [costsCashFlow.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [costsCashFlow.projectId],
		references: [projects.id]
	}),
}));

export const designsAndPermitsRelations = relations(designsAndPermits, ({one}) => ({
	user: one(users, {
		fields: [designsAndPermits.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [designsAndPermits.projectId],
		references: [projects.id]
	}),
}));

export const evaluationApprovalsRelations = relations(evaluationApprovals, ({one}) => ({
	project: one(projects, {
		fields: [evaluationApprovals.projectId],
		references: [projects.id]
	}),
}));

export const evaluationResultsRelations = relations(evaluationResults, ({one}) => ({
	evaluationSession: one(evaluationSessions, {
		fields: [evaluationResults.sessionId],
		references: [evaluationSessions.id]
	}),
	project: one(projects, {
		fields: [evaluationResults.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [evaluationResults.consultantId],
		references: [consultants.id]
	}),
}));

export const evaluationScoresRelations = relations(evaluationScores, ({one}) => ({
	project: one(projects, {
		fields: [evaluationScores.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [evaluationScores.consultantId],
		references: [consultants.id]
	}),
}));

export const evaluationSessionMembersRelations = relations(evaluationSessionMembers, ({one}) => ({
	evaluationSession: one(evaluationSessions, {
		fields: [evaluationSessionMembers.sessionId],
		references: [evaluationSessions.id]
	}),
}));

export const evaluatorScoresRelations = relations(evaluatorScores, ({one}) => ({
	project: one(projects, {
		fields: [evaluatorScores.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [evaluatorScores.consultantId],
		references: [consultants.id]
	}),
	evaluationSession: one(evaluationSessions, {
		fields: [evaluatorScores.sessionId],
		references: [evaluationSessions.id]
	}),
}));

export const feasibilityStudiesRelations = relations(feasibilityStudies, ({one}) => ({
	user: one(users, {
		fields: [feasibilityStudies.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [feasibilityStudies.projectId],
		references: [projects.id]
	}),
}));

export const financialDataRelations = relations(financialData, ({one}) => ({
	project: one(projects, {
		fields: [financialData.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [financialData.consultantId],
		references: [consultants.id]
	}),
}));

export const knowledgeBaseRelations = relations(knowledgeBase, ({one}) => ({
	project: one(projects, {
		fields: [knowledgeBase.relatedProjectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [knowledgeBase.relatedConsultantId],
		references: [consultants.id]
	}),
	agentAssignment: one(agentAssignments, {
		fields: [knowledgeBase.relatedAgentAssignmentId],
		references: [agentAssignments.id]
	}),
}));

export const agentAssignmentsRelations = relations(agentAssignments, ({many}) => ({
	knowledgeBases: many(knowledgeBase),
}));

export const legalSetupRecordsRelations = relations(legalSetupRecords, ({one}) => ({
	user: one(users, {
		fields: [legalSetupRecords.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [legalSetupRecords.projectId],
		references: [projects.id]
	}),
}));

export const marketOverviewRelations = relations(marketOverview, ({one}) => ({
	user: one(users, {
		fields: [marketOverview.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [marketOverview.projectId],
		references: [projects.id]
	}),
}));

export const meetingFilesRelations = relations(meetingFiles, ({one}) => ({
	meeting: one(meetings, {
		fields: [meetingFiles.meetingId],
		references: [meetings.id]
	}),
}));

export const meetingsRelations = relations(meetings, ({many}) => ({
	meetingFiles: many(meetingFiles),
	meetingMessages: many(meetingMessages),
	meetingParticipants: many(meetingParticipants),
	taskExecutionLogs: many(taskExecutionLogs),
}));

export const meetingMessagesRelations = relations(meetingMessages, ({one}) => ({
	meeting: one(meetings, {
		fields: [meetingMessages.meetingId],
		references: [meetings.id]
	}),
}));

export const meetingParticipantsRelations = relations(meetingParticipants, ({one}) => ({
	meeting: one(meetings, {
		fields: [meetingParticipants.meetingId],
		references: [meetings.id]
	}),
	agent: one(agents, {
		fields: [meetingParticipants.agentId],
		references: [agents.id]
	}),
}));

export const agentsRelations = relations(agents, ({many}) => ({
	meetingParticipants: many(meetingParticipants),
}));

export const oauthTokensRelations = relations(oauthTokens, ({one}) => ({
	user: one(users, {
		fields: [oauthTokens.userId],
		references: [users.id]
	}),
}));

export const projectCapitalSettingsRelations = relations(projectCapitalSettings, ({one}) => ({
	project: one(projects, {
		fields: [projectCapitalSettings.projectId],
		references: [projects.id]
	}),
}));

export const projectConsultantsRelations = relations(projectConsultants, ({one}) => ({
	project: one(projects, {
		fields: [projectConsultants.projectId],
		references: [projects.id]
	}),
	consultant: one(consultants, {
		fields: [projectConsultants.consultantId],
		references: [consultants.id]
	}),
}));

export const projectContractsRelations = relations(projectContracts, ({one}) => ({
	user: one(users, {
		fields: [projectContracts.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [projectContracts.projectId],
		references: [projects.id]
	}),
	contractType: one(contractTypes, {
		fields: [projectContracts.contractTypeId],
		references: [contractTypes.id]
	}),
}));

export const projectKpisRelations = relations(projectKpis, ({one}) => ({
	project: one(projects, {
		fields: [projectKpis.projectId],
		references: [projects.id]
	}),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({one}) => ({
	project: one(projects, {
		fields: [projectMilestones.projectId],
		references: [projects.id]
	}),
}));

export const projectPhasesRelations = relations(projectPhases, ({one}) => ({
	project: one(projects, {
		fields: [projectPhases.projectId],
		references: [projects.id]
	}),
}));

export const proposalComparisonsRelations = relations(proposalComparisons, ({one}) => ({
	project: one(projects, {
		fields: [proposalComparisons.projectId],
		references: [projects.id]
	}),
	consultantProposal: one(consultantProposals, {
		fields: [proposalComparisons.winnerProposalId],
		references: [consultantProposals.id]
	}),
}));

export const sentEmailsRelations = relations(sentEmails, ({one}) => ({
	user: one(users, {
		fields: [sentEmails.userId],
		references: [users.id]
	}),
}));

export const taskExecutionLogsRelations = relations(taskExecutionLogs, ({one}) => ({
	task: one(tasks, {
		fields: [taskExecutionLogs.taskId],
		references: [tasks.id]
	}),
	meeting: one(meetings, {
		fields: [taskExecutionLogs.meetingId],
		references: [meetings.id]
	}),
}));

export const tasksRelations = relations(tasks, ({many}) => ({
	taskExecutionLogs: many(taskExecutionLogs),
}));