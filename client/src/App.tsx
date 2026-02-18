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
import FeasibilityStudyPage from "./pages/FeasibilityStudyPage";

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
      <Route path="/feasibility-study" component={FeasibilityStudyPage} />
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
