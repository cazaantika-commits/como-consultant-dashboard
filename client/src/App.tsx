import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
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
import ConsultantPortalPage from "./pages/ConsultantPortalPage";
import ConsultantGuidePage from "./pages/ConsultantGuidePage";
import CPAPage from "./pages/CPAPage";
import ConsultantKnowPage from "./pages/ConsultantKnowPage";
import ConsultantRecommendPage from "./pages/ConsultantRecommendPage";
import ConsultantEvaluationPage from "./pages/ConsultantEvaluationPage";
import ConsultantCommitteePage from "./pages/ConsultantCommitteePage";
import CommitteeDecisionPage from "./pages/CommitteeDecisionPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import GoogleConnectPage from "./pages/GoogleConnectPage";
import ContractsRegistryPage from "./pages/ContractsRegistryPage";
import KnowledgeHubPage from "./pages/KnowledgeHubPage";
import FeasibilityStudyPage from "./pages/FeasibilityStudyPage";
import DevelopmentStagesPage from "./pages/DevelopmentStagesPage";
import ExecutiveCashFlowPage from "./pages/ProjectCashFlowSimplified";
import ProgramCashFlowPage from "./pages/ProgramCashFlowPage";
import BusinessPartnersRegistry from "./pages/BusinessPartnersRegistry";
import PaymentRequests from "./pages/PaymentRequests";
import DevelopmentPhasesPage from "./pages/DevelopmentPhasesPage";
import ProjectLifecyclePage from "./pages/ProjectLifecyclePage";
import { ContractAuditPage } from "./pages/ContractAuditPage";
import CostDistributionRulesPage from "./pages/CostDistributionRulesPage";
import WorkSchedulePage from "./pages/WorkSchedulePage";
import UserManagementPage from "./pages/UserManagementPage";
import ApprovalSettings from "./pages/ApprovalSettings";
import GeneralRequests from "./pages/GeneralRequests";
import { ReadOnlyGuard } from "./components/ReadOnlyGuard";
import V2InvestorCashFlow from "./pages/V2InvestorCashFlow";
import V2EscrowCashFlow from "./pages/V2EscrowCashFlow";
import V2Feasibility from "./pages/V2Feasibility";
import V2Timeline from "./pages/V2Timeline";
import V2Hub from "./pages/V2Hub";
import BateekhaPage from "./pages/BateekhaPage";
import ProjectLaunchGatePage from "./pages/ProjectLaunchGatePage";
import ProjectReferencePage from "./pages/ProjectReferencePage";
import ConsultantAppointmentPackPage from "./pages/ConsultantAppointmentPackPage";
import ContractDeliverablesPage from "./pages/ContractDeliverablesPage";
import TestProjectPage from "./pages/TestProjectPage";
import ComoNextTodayPage from "./pages/ComoNextTodayPage";
import SaraPage from "./pages/SaraPage";
import ComoNextProjectPage from "./pages/ComoNextProjectPage";
import ComoNextProjectOpeningPage from "./pages/ComoNextProjectOpeningPage";
import ProjectManagementPage from "./pages/ProjectManagementPage";
import MajanFinanceWorkspace from "./pages/MajanFinanceWorkspace";

function FinancialWorkspaceRedirect({ tab }: { tab: string }) {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  params.set("tab", tab);
  return <Redirect to={`/bateekha?${params.toString()}`} />;
}

function LegacyProjectRedirect() {
  const id = typeof window === "undefined" ? "" : window.location.pathname.split("/").filter(Boolean).pop();
  return <Redirect to={id ? `/como-next/projects/${id}` : "/project-management"} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/como-next" />} />
      <Route path="/gateway" component={Home} />
      <Route path="/consultant-dashboard" component={() => <Redirect to="/consultant-portal" />} />
      <Route path="/consultant-profiles" component={() => <Redirect to="/consultant-know" />} />
      <Route path="/consultant-profile/:id" component={ConsultantDetailPage} />
      <Route path="/drive" component={DriveBrowserPage} />
      <Route path="/tasks" component={() => <Redirect to="/como-next?section=actions" />} />
      <Route path="/agent-dashboard" component={() => <Redirect to="/sara" />} />
      {/* These pages are also accessible as tabs inside Project Management */}
      <Route path="/feasibility" component={FeasibilityStudyPage} />
      <Route path="/feasibility-study" component={FeasibilityStudyPage} />
      <Route path="/development-stages" component={() => <Redirect to="/development-phases" />} />
      <Route path="/cash-flow" component={() => <Redirect to="/bateekha" />} />
      <Route path="/project-lifecycle" component={ProjectLifecyclePage} />
      <Route path="/program-cashflow" component={ProgramCashFlowPage} />
      <Route path="/excel-cashflow" component={() => <FinancialWorkspaceRedirect tab="cashflows" />} />
      <Route path="/escrow-cashflow" component={() => <FinancialWorkspaceRedirect tab="escrow" />} />
      <Route path="/consultants-registry" component={() => <Redirect to="/consultant-know" />} />
      <Route path="/business-partners-registry" component={BusinessPartnersRegistry} />
      <Route path="/payment-requests" component={PaymentRequests} />
      <Route path="/general-requests" component={GeneralRequests} />
      <Route path="/consultant-portal" component={ConsultantPortalPage} />
      <Route path="/consultant-guide" component={ConsultantGuidePage} />
      <Route path="/consultant-proposals" component={CPAPage} />
      <Route path="/consultant-know" component={ConsultantKnowPage} />
      <Route path="/consultant-evaluation" component={ConsultantEvaluationPage} />
      <Route path="/consultant-recommend" component={() => <Redirect to="/consultant-proposals" />} />
      <Route path="/consultant-committee" component={() => <Redirect to="/consultant-proposals" />} />
      <Route path="/committee-decision" component={CommitteeDecisionPage} />
      <Route path="/model-stats" component={() => <Redirect to="/sara" />} />
      <Route path="/agent-assignments" component={() => <Redirect to="/sara" />} />
      <Route path="/agent-assignments-summary" component={() => <Redirect to="/sara" />} />
      <Route path="/conversation-history" component={() => <Redirect to="/sara" />} />
      <Route path="/task-settings" component={() => <Redirect to="/sara" />} />
      <Route path="/knowledge-base" component={KnowledgeBasePage} />
      <Route path="/proposals" component={() => <Redirect to="/consultant-proposals" />} />
      <Route path="/meetings" component={() => <Redirect to="/como-next?section=meetings" />} />
      <Route path="/meetings/new" component={() => <Redirect to="/como-next?section=meetings" />} />
      <Route path="/meetings/tracking" component={() => <Redirect to="/como-next?section=meetings" />} />
      <Route path="/execution-dashboard" component={() => <Redirect to="/como-next" />} />
      <Route path="/google-connect" component={GoogleConnectPage} />
      <Route path="/project/:id" component={LegacyProjectRedirect} />
      <Route path="/projects/:id" component={LegacyProjectRedirect} />
      <Route path="/contracts" component={ContractsRegistryPage} />
      <Route path="/news-manage" component={() => <Redirect to="/" />} />
      <Route path="/activity-monitor" component={() => <Redirect to="/como-next" />} />
      <Route path="/specialist-knowledge" component={() => <Redirect to="/como-next?section=specialists" />} />
      <Route path="/knowledge-analysis" component={KnowledgeHubPage} />
      <Route path="/sent-emails" component={() => <Redirect to="/como-next?section=communications" />} />
      <Route path="/executive" component={() => <Redirect to="/como-next" />} />
      <Route path="/command-center" component={() => <Redirect to="/sara" />} />
      <Route path="/meetings/:id" component={() => <Redirect to="/como-next?section=meetings" />} />
      <Route path="/market-reports" component={() => <Redirect to="/knowledge-analysis" />} />
      <Route path="/risk-dashboard" component={() => <Redirect to="/project-management" />} />
      <Route path="/development-phases" component={DevelopmentPhasesPage} />
      <Route path="/work-schedule" component={WorkSchedulePage} />
      <Route path="/self-learning" component={() => <Redirect to="/knowledge-analysis" />} />
      <Route path="/contract-audit" component={() => <Redirect to="/contracts" />} />
      <Route path="/cost-distribution-rules" component={CostDistributionRulesPage} />
      <Route path="/cashflow-settings" component={() => <FinancialWorkspaceRedirect tab="settings" />} />
      <Route path="/cashflow-reflection" component={() => <FinancialWorkspaceRedirect tab="cashflows" />} />
      <Route path="/cashflow-comparison" component={() => <FinancialWorkspaceRedirect tab="cashflows" />} />
      <Route path="/engine-comparison" component={() => <FinancialWorkspaceRedirect tab="cashflows" />} />
      <Route path="/project-card" component={() => <FinancialWorkspaceRedirect tab="general" />} />
      <Route path="/project-card-offplan" component={() => <FinancialWorkspaceRedirect tab="general" />} />
      <Route path="/project-card-post-completion" component={() => <FinancialWorkspaceRedirect tab="general" />} />
      <Route path="/pricing" component={() => <FinancialWorkspaceRedirect tab="sales" />} />
      <Route path="/investor-capital-plan" component={() => <FinancialWorkspaceRedirect tab="capital_portfolio" />} />
      <Route path="/investor-cashflow-schedule" component={() => <FinancialWorkspaceRedirect tab="cashflows" />} />
      <Route path="/escrow-cashflow-schedule" component={() => <FinancialWorkspaceRedirect tab="escrow" />} />
      <Route path="/v2/investor-cashflow" component={V2InvestorCashFlow} />
      <Route path="/v2/escrow-cashflow" component={V2EscrowCashFlow} />
      <Route path="/v2/feasibility" component={V2Feasibility} />
      <Route path="/v2/wael-sales" component={() => <FinancialWorkspaceRedirect tab="sales" />} />
      <Route path="/v2/payment-plan" component={() => <FinancialWorkspaceRedirect tab="sales" />} />
      <Route path="/v2/timeline" component={() => <Redirect to="/development-phases" />} />
      <Route path="/v2" component={V2Hub} />
      <Route path="/majan-finance" component={MajanFinanceWorkspace} />
      <Route path="/bateekha" component={BateekhaPage} />
      <Route path="/test-project" component={TestProjectPage} />
      <Route path="/project-management" component={ProjectManagementPage} />
      <Route path="/como-next/projects/:id" component={ComoNextProjectPage} />
      <Route path="/como-next/project-opening" component={ComoNextProjectOpeningPage} />
      <Route path="/como-next" component={ComoNextTodayPage} />
      <Route path="/sara" component={SaraPage} />
      <Route path="/project-launch/:projectId" component={ProjectLaunchGatePage} />
      <Route path="/project-launch"><Redirect to="/project-management" /></Route>
      <Route path="/project-reference" component={ProjectReferencePage} />
      <Route path="/consultant-appointment-pack" component={ConsultantAppointmentPackPage} />
      <Route path="/contract-deliverables" component={ContractDeliverablesPage} />
      <Route path="/user-management" component={UserManagementPage} />
      <Route path="/approval-settings" component={ApprovalSettings} />
      <Route path="/internal-messages" component={() => <Redirect to="/como-next?section=communications" />} />
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
