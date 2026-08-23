import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CCAuthProvider } from "./contexts/CCAuthContext";
import { OwnerProvider } from "./contexts/OwnerContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import Home from "./pages/Home";
import ConsultantDashboardPage from "./pages/ConsultantDashboardPage";
import ConsultantProfilesPage from "./pages/ConsultantProfilesPage";
import ConsultantDetailPage from "./pages/ConsultantDetailPage";
import DriveBrowserPage from "./pages/DriveBrowserPage";
import TasksPage from "./pages/TasksPage";
import AgentDashboardPage from "./pages/AgentDashboardPage";
import ConsultantPortalPage from "./pages/ConsultantPortalPage";
import ConsultantGuidePage from "./pages/ConsultantGuidePage";
import CPAPage from "./pages/CPAPage";
import ConsultantKnowPage from "./pages/ConsultantKnowPage";
import ConsultantRecommendPage from "./pages/ConsultantRecommendPage";
import ConsultantEvaluationPage from "./pages/ConsultantEvaluationPage";
import ConsultantCommitteePage from "./pages/ConsultantCommitteePage";
import CommitteeDecisionPage from "./pages/CommitteeDecisionPage";
import ModelStatsPage from "./pages/ModelStatsPage";
import AgentAssignmentsPage from "./pages/AgentAssignmentsPage";
import AgentAssignmentsSummaryPage from "./pages/AgentAssignmentsSummaryPage";
import ConversationHistoryPage from "./pages/ConversationHistoryPage";
import TaskSettingsPage from "./pages/TaskSettingsPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import ProposalsPage from "./pages/ProposalsPage";
import MeetingsListPage from "./pages/MeetingsListPage";
import NewMeetingPage from "./pages/NewMeetingPage";
import MeetingRoomPage from "./pages/MeetingRoomPage";
import MeetingTrackingPage from "./pages/MeetingTrackingPage";
import ExecutionDashboardPage from "./pages/ExecutionDashboardPage";
import GoogleConnectPage from "./pages/GoogleConnectPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ContractsRegistryPage from "./pages/ContractsRegistryPage";
import ActivityMonitorPage from "./pages/ActivityMonitorPage";
import SpecialistKnowledgePage from "./pages/SpecialistKnowledgePage";
import KnowledgeHubPage from "./pages/KnowledgeHubPage";
import SentEmailsPage from "./pages/SentEmailsPage";
import ExecutiveVIPPage from "./pages/ExecutiveVIPPage";
import CommandCenterPage from "./pages/CommandCenterPage";
import FeasibilityStudyPage from "./pages/FeasibilityStudyPage";
import DevelopmentStagesPage from "./pages/DevelopmentStagesPage";
import ExecutiveCashFlowPage from "./pages/ProjectCashFlowSimplified";
import ProjectLifecyclePage from "./pages/ProjectLifecycleSimplified";
import ProgramCashFlowPage from "./pages/ProgramCashFlowPage";
import ExcelCashFlowPage from "./pages/ExcelCashFlowPage";
import EscrowCashFlowPage from "./pages/EscrowCashFlowPage";
import ConsultantsRegistry from "./pages/ConsultantsRegistry";
import BusinessPartnersRegistry from "./pages/BusinessPartnersRegistry";
import PaymentRequests from "./pages/PaymentRequests";
import MarketReportsPage from "./pages/MarketReportsPage";
import RiskDashboardPage from "./pages/RiskDashboardPage";
import SelfLearningPage from "./pages/SelfLearningPage";
import DevelopmentPhasesPage from "./pages/DevelopmentPhasesPage";
import { ContractAuditPage } from "./pages/ContractAuditPage";
import NewsTickerManagePage from "./pages/NewsTickerManagePage";
import CostDistributionRulesPage from "./pages/CostDistributionRulesPage";
import WorkSchedulePage from "./pages/WorkSchedulePage";
import CashFlowSettingsPage from "./pages/CashFlowSettingsPage";
import CashFlowReflectionPage from "./pages/CashFlowReflectionPage";
import CashFlowComparisonPage from "./pages/CashFlowComparisonPage";
import EngineComparisonPage from "./pages/EngineComparisonPage";
import ProjectCardOffplanPage from "./pages/ProjectCardOffplanPage";
import ProjectCardPostCompletionPage from "./pages/ProjectCardPostCompletionPage";
import PricingPage from "./pages/PricingPage";
import InvestorCapitalPlanPage from "./pages/InvestorCapitalPlanPage";
import InvestorCashFlowSchedulePage from "./pages/InvestorCashFlowSchedulePage";
import EscrowCashFlowSchedulePage2 from "./pages/EscrowCashFlowSchedulePage2";
import UserManagementPage from "./pages/UserManagementPage";
import ApprovalSettings from "./pages/ApprovalSettings";
import GeneralRequests from "./pages/GeneralRequests";
import InternalMessages from "./pages/InternalMessages";
import { ReadOnlyGuard } from "./components/ReadOnlyGuard";
import V2InvestorCashFlow from "./pages/V2InvestorCashFlow";
import V2Portfolio from "./pages/V2Portfolio";
import V2EscrowCashFlow from "./pages/V2EscrowCashFlow";
import V2Feasibility from "./pages/V2Feasibility";
import V2WaelSales from "./pages/V2WaelSales";
import V2Timeline from "./pages/V2Timeline";
import V2Hub from "./pages/V2Hub";
import BateekhaPage from "./pages/BateekhaPage";
import ProjectLaunchGatePage from "./pages/ProjectLaunchGatePage";
import ConsultantAppointmentPackPage from "./pages/ConsultantAppointmentPackPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/consultant-dashboard" component={ConsultantDashboardPage} />
      <Route path="/consultant-profiles" component={ConsultantProfilesPage} />
      <Route path="/consultant-profile/:id" component={ConsultantDetailPage} />
      <Route path="/drive" component={DriveBrowserPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/agent-dashboard" component={AgentDashboardPage} />
      {/* These pages are also accessible as tabs inside Project Management */}
      <Route path="/feasibility" component={FeasibilityStudyPage} />
      <Route path="/feasibility-study" component={FeasibilityStudyPage} />
      <Route path="/development-stages" component={DevelopmentStagesPage} />
      <Route path="/cash-flow" component={ExecutiveCashFlowPage} />
      <Route path="/project-lifecycle" component={ProjectLifecyclePage} />
      <Route path="/program-cashflow" component={ProgramCashFlowPage} />
      <Route path="/excel-cashflow" component={ExcelCashFlowPage} />
      <Route path="/escrow-cashflow" component={EscrowCashFlowPage} />
      <Route path="/consultants-registry" component={ConsultantsRegistry} />
      <Route path="/business-partners-registry" component={BusinessPartnersRegistry} />
      <Route path="/payment-requests" component={PaymentRequests} />
      <Route path="/general-requests" component={GeneralRequests} />
      <Route path="/consultant-portal" component={ConsultantPortalPage} />
      <Route path="/consultant-guide" component={ConsultantGuidePage} />
      <Route path="/consultant-proposals" component={CPAPage} />
      <Route path="/consultant-know" component={ConsultantKnowPage} />
      <Route path="/consultant-evaluation" component={ConsultantEvaluationPage} />
      <Route path="/consultant-recommend" component={ConsultantRecommendPage} />
      <Route path="/consultant-committee" component={ConsultantCommitteePage} />
      <Route path="/committee-decision" component={CommitteeDecisionPage} />
      <Route path="/model-stats" component={ModelStatsPage} />
      <Route path="/agent-assignments" component={AgentAssignmentsPage} />
      <Route path="/agent-assignments-summary" component={AgentAssignmentsSummaryPage} />
      <Route path="/conversation-history" component={ConversationHistoryPage} />
      <Route path="/task-settings" component={TaskSettingsPage} />
      <Route path="/knowledge-base" component={KnowledgeBasePage} />
      <Route path="/proposals" component={ProposalsPage} />
      <Route path="/meetings" component={MeetingsListPage} />
      <Route path="/meetings/new" component={NewMeetingPage} />
      <Route path="/meetings/tracking" component={MeetingTrackingPage} />
      <Route path="/execution-dashboard" component={ExecutionDashboardPage} />
      <Route path="/google-connect" component={GoogleConnectPage} />
      <Route path="/project/:id" component={ProjectDetailPage} />
      <Route path="/projects/:id" component={ProjectDetailPage} />
      <Route path="/contracts" component={ContractsRegistryPage} />
          <Route path="/news-manage" component={NewsTickerManagePage} />
      <Route path="/activity-monitor" component={ActivityMonitorPage} />
      <Route path="/specialist-knowledge" component={SpecialistKnowledgePage} />
      <Route path="/knowledge-analysis" component={KnowledgeHubPage} />
      <Route path="/sent-emails" component={SentEmailsPage} />
      <Route path="/executive" component={ExecutiveVIPPage} />
      <Route path="/command-center" component={CommandCenterPage} />
      <Route path="/meetings/:id" component={MeetingRoomPage} />
      <Route path="/market-reports" component={MarketReportsPage} />
      <Route path="/risk-dashboard" component={RiskDashboardPage} />
      <Route path="/development-phases" component={DevelopmentPhasesPage} />
      <Route path="/work-schedule" component={WorkSchedulePage} />
      <Route path="/self-learning" component={SelfLearningPage} />
      <Route path="/contract-audit" component={ContractAuditPage} />
      <Route path="/cost-distribution-rules" component={CostDistributionRulesPage} />
      <Route path="/cashflow-settings" component={CashFlowSettingsPage} />
      <Route path="/cashflow-reflection" component={CashFlowReflectionPage} />
      <Route path="/cashflow-comparison" component={CashFlowComparisonPage} />
      <Route path="/engine-comparison" component={EngineComparisonPage} />
      <Route path="/project-card" component={ProjectCardOffplanPage} />
      <Route path="/project-card-offplan" component={ProjectCardOffplanPage} />
      <Route path="/project-card-post-completion" component={ProjectCardPostCompletionPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/investor-capital-plan" component={InvestorCapitalPlanPage} />
      <Route path="/investor-cashflow-schedule" component={InvestorCashFlowSchedulePage} />
      <Route path="/escrow-cashflow-schedule" component={EscrowCashFlowSchedulePage2} />
      <Route path="/v2/investor-cashflow" component={V2InvestorCashFlow} />
      <Route path="/v2/portfolio" component={V2Portfolio} />
      <Route path="/v2/escrow-cashflow" component={V2EscrowCashFlow} />
      <Route path="/v2/feasibility" component={V2Feasibility} />
      <Route path="/v2/wael-sales" component={V2WaelSales} />
      <Route path="/v2/timeline" component={V2Timeline} />
      <Route path="/v2" component={V2Hub} />
      <Route path="/bateekha" component={BateekhaPage} />
      <Route path="/project-launch" component={ProjectLaunchGatePage} />
      <Route path="/consultant-appointment-pack" component={ConsultantAppointmentPackPage} />
      <Route path="/user-management" component={UserManagementPage} />
      <Route path="/approval-settings" component={ApprovalSettings} />
      <Route path="/internal-messages" component={InternalMessages} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <CCAuthProvider>
            <OwnerProvider>
              <ProjectProvider>
                <ReadOnlyGuard>
                  <Router />
                </ReadOnlyGuard>
              </ProjectProvider>
            </OwnerProvider>
          </CCAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
