import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, BookOpen, BarChart2, Database, ShieldAlert, DollarSign } from "lucide-react";
import JoelleEngineTab from "@/components/feasibility/JoelleEngineTab";
import JoelleDataManager from "@/components/feasibility/JoelleDataManager";
import CostsCashFlowTab from "@/components/feasibility/CostsCashFlowTab";
import MarketReportsPage from "./MarketReportsPage";
import RiskDashboardPage from "./RiskDashboardPage";

type TabId = "research" | "market-reports" | "data-sources" | "risk" | "pricing";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "research", label: "الدراسات والأبحاث", icon: BookOpen },
  { id: "market-reports", label: "تقارير السوق", icon: BarChart2 },
  { id: "data-sources", label: "البيانات والمصادر", icon: Database },
  { id: "risk", label: "لوحة المخاطر", icon: ShieldAlert },
  { id: "pricing", label: "التسعير والإيرادات", icon: DollarSign },
];

export default function KnowledgeHubPage({ onBack }: { onBack: () => void }) {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("research");

  // Auto-select first project
  useEffect(() => {
    if (projectsQuery.data && projectsQuery.data.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projectsQuery.data[0].id);
    }
  }, [projectsQuery.data, selectedProjectId]);

  // Get studyId for the selected project
  const studiesByProjectQuery = trpc.feasibility.listByProject.useQuery(
    selectedProjectId || 0,
    { enabled: !!selectedProjectId }
  );
  const studyId = studiesByProjectQuery.data?.[0]?.id ?? null;

  // Get community for JoelleDataManager
  const projectQuery = trpc.projects.getById.useQuery(
    selectedProjectId || 0,
    { enabled: !!selectedProjectId }
  );
  const community = (projectQuery.data as any)?.community || "";

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 shrink-0">
            <ArrowRight className="w-4 h-4" />
            العودة
          </Button>
          <div className="h-5 w-px bg-border" />
          {/* Section icon + title */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <currentTab.icon className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-foreground">{currentTab.label}</h1>
          </div>
          <div className="h-5 w-px bg-border" />
          {/* Project selector */}
          <Select
            value={selectedProjectId?.toString() ?? ""}
            onValueChange={(v) => setSelectedProjectId(Number(v))}
          >
            <SelectTrigger className="h-8 text-xs w-52 shrink-0">
              <SelectValue placeholder="اختر مشروعاً..." />
            </SelectTrigger>
            <SelectContent>
              {(projectsQuery.data || []).map((p: any) => (
                <SelectItem key={`proj-kh-${p.id}`} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProject && (
            <span className="text-xs text-muted-foreground truncate">({(selectedProject as any).plotNumber || selectedProject.id})</span>
          )}
        </div>
        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="py-4">
        {activeTab === "research" && (
          <div className="max-w-[98%] mx-auto px-4">
            <JoelleEngineTab projectId={selectedProjectId} studyId={studyId} />
          </div>
        )}
        {activeTab === "market-reports" && (
          <div className="max-w-[98%] mx-auto px-4">
            <MarketReportsPage />
          </div>
        )}
        {activeTab === "data-sources" && (
          <div className="max-w-[98%] mx-auto px-4">
            <JoelleDataManager projectId={selectedProjectId} community={community} />
          </div>
        )}
        {activeTab === "risk" && (
          <RiskDashboardPage embedded initialProjectId={selectedProjectId} />
        )}
        {activeTab === "pricing" && (
          <div className="max-w-[98%] mx-auto px-4">
            <CostsCashFlowTab projectId={selectedProjectId} studyId={studyId} />
          </div>
        )}
      </main>
    </div>
  );
}
