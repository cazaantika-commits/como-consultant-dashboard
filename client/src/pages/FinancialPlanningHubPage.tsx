import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Settings2, FileBarChart2, LayoutList, Wallet, Landmark } from "lucide-react";
import { CashFlowProvider, useCashFlow } from "@/contexts/CashFlowContext";
import CashFlowSettingsPage from "./CashFlowSettingsPage";
import FinancialFeasibilityTab from "./FinancialFeasibilityTab";
import CapitalScheduleTablePage from "./CapitalScheduleTablePage";
import ExcelCashFlowPage from "./ExcelCashFlowPage";
import EscrowCashFlowPage from "./EscrowCashFlowPage";

type TabId = "cf-settings" | "fin-feasibility" | "total-costs" | "capital-plan" | "escrow";

const TABS: { id: TabId; label: string; icon: React.ElementType; gradient: string }[] = [
  {
    id: "cf-settings",
    label: "إعدادات التدفق",
    icon: Settings2,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
  },
  {
    id: "fin-feasibility",
    label: "ملخص الجدوى المالية",
    icon: FileBarChart2,
    gradient: "linear-gradient(135deg, #7c3aed, #6d28d9)",
  },
  {
    id: "total-costs",
    label: "التكاليف الكلية للمشروع والجدول الزمني",
    icon: LayoutList,
    gradient: "linear-gradient(135deg, #059669, #10b981)",
  },
  {
    id: "capital-plan",
    label: "خطة رأس مال المشروع",
    icon: Wallet,
    gradient: "linear-gradient(135deg, #d97706, #b45309)",
  },
  {
    id: "escrow",
    label: "التدفقات النقدية وحساب الضمان",
    icon: Landmark,
    gradient: "linear-gradient(135deg, #4f46e5, #4338ca)",
  },
];

function FinancialPlanningHubInner({ onBack }: { onBack: () => void }) {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const { selectedProjectId, setSelectedProjectId } = useCashFlow();
  const [activeTab, setActiveTab] = useState<TabId>("cf-settings");

  // Auto-select first project
  useEffect(() => {
    if (projectsQuery.data && projectsQuery.data.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projectsQuery.data[0].id);
    }
  }, [projectsQuery.data, selectedProjectId]);

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
  const currentTab = TABS.find(t => t.id === activeTab)!;

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
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: currentTab.gradient }}
            >
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
                <SelectItem key={`proj-fp-${p.id}`} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProject && (
            <span className="text-xs text-muted-foreground truncate">({selectedProject.plotNumber || selectedProject.id})</span>
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
        {activeTab === "cf-settings" && (
          <CashFlowSettingsPage
            embedded
            initialProjectId={selectedProjectId}
            onNavigateToReflection={() => setActiveTab("total-costs")}
          />
        )}
        {activeTab === "fin-feasibility" && (
          <div className="max-w-[98%] mx-auto px-4">
            <FinancialFeasibilityTab initialProjectId={selectedProjectId} />
          </div>
        )}
        {activeTab === "total-costs" && (
          <CapitalScheduleTablePage embedded initialProjectId={selectedProjectId} />
        )}
        {activeTab === "capital-plan" && (
          <main className="py-1">
            <ExcelCashFlowPage embedded initialProjectId={selectedProjectId} />
          </main>
        )}
        {activeTab === "escrow" && (
          <main className="py-1">
            <EscrowCashFlowPage embedded initialProjectId={selectedProjectId} />
          </main>
        )}
      </main>
    </div>
  );
}

export default function FinancialPlanningHubPage({ onBack }: { onBack: () => void }) {
  return (
    <CashFlowProvider>
      <FinancialPlanningHubInner onBack={onBack} />
    </CashFlowProvider>
  );
}
