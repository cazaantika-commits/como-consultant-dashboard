import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ConsultantDashboardPage from "./pages/ConsultantDashboardPage";
import ConsultantProfilesPage from "./pages/ConsultantProfilesPage";
import ConsultantDetailPage from "./pages/ConsultantDetailPage";
import DriveBrowserPage from "./pages/DriveBrowserPage";
import TasksPage from "./pages/TasksPage";
import AgentDashboardPage from "./pages/AgentDashboardPage";
import ConsultantEvaluationPage from "./pages/ConsultantEvaluationPage";
import ConsultantPortalPage from "./pages/ConsultantPortalPage";
import ConsultantGuidePage from "./pages/ConsultantGuidePage";
import ConsultantProposalsPage from "./pages/ConsultantProposalsPage";
import ConsultantKnowPage from "./pages/ConsultantKnowPage";
import ConsultantRecommendPage from "./pages/ConsultantRecommendPage";
import ConsultantCommitteePage from "./pages/ConsultantCommitteePage";
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
import ProjectManagementPage from "./pages/ProjectManagementPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ContractsRegistryPage from "./pages/ContractsRegistryPage";
import FactSheetPage from "./pages/FactSheetPage";
import CommitteeDecisionPage from "./pages/CommitteeDecisionPage";
import ActivityMonitorPage from "./pages/ActivityMonitorPage";
import SpecialistKnowledgePage from "./pages/SpecialistKnowledgePage";
import SentEmailsPage from "./pages/SentEmailsPage";
import ExecutiveVIPPage from "./pages/ExecutiveVIPPage";
import CommandCenterPage from "./pages/CommandCenterPage";
// Replit pages - using simplified versions
import FeasibilityStudyPageReplit from "./pages/FeasibilityStudySimplified";
import DevelopmentStagesPage from "./pages/DevelopmentStagesSimplified";
import ExecutiveCashFlowPage from "./pages/ProjectCashFlowSimplified";
import ProjectLifecyclePage from "./pages/ProjectLifecycleSimplified";

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
      <Route path="/consultant-evaluation" component={ConsultantEvaluationPage} />
      {/* Replit pages - simplified versions */}
      <Route path="/feasibility-study" component={FeasibilityStudyPageReplit} />
      <Route path="/development-stages" component={DevelopmentStagesPage} />
      <Route path="/cash-flow" component={ExecutiveCashFlowPage} />
      <Route path="/project-lifecycle" component={ProjectLifecyclePage} />
      <Route path="/consultant-portal" component={ConsultantPortalPage} />
      <Route path="/consultant-guide" component={ConsultantGuidePage} />
      <Route path="/consultant-proposals" component={ConsultantProposalsPage} />
      <Route path="/consultant-know" component={ConsultantKnowPage} />
      <Route path="/consultant-recommend" component={ConsultantRecommendPage} />
      <Route path="/consultant-committee" component={ConsultantCommitteePage} />
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
      <Route path="/project-management" component={ProjectManagementPage} />
      <Route path="/project/:id" component={ProjectDetailPage} />
      <Route path="/contracts" component={ContractsRegistryPage} />
      <Route path="/fact-sheet" component={FactSheetPage} />
      <Route path="/committee-decision" component={CommitteeDecisionPage} />
      <Route path="/activity-monitor" component={ActivityMonitorPage} />
      <Route path="/specialist-knowledge" component={SpecialistKnowledgePage} />
      <Route path="/sent-emails" component={SentEmailsPage} />
      <Route path="/executive" component={ExecutiveVIPPage} />
      <Route path="/command-center" component={CommandCenterPage} />
      <Route path="/meetings/:id" component={MeetingRoomPage} />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
