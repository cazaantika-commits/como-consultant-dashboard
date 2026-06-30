import { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Settings2, FileBarChart2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

// Lazy-load heavy pages to keep initial bundle small
const CashFlowSettingsPage = lazy(() => import("./CashFlowSettingsPage"));
const FeasibilityStudyPage = lazy(() => import("./FeasibilityStudyPage"));
const CapitalScheduleTablePage = lazy(() => import("./CapitalScheduleTablePage"));
const EscrowCashFlowPage = lazy(() => import("./EscrowCashFlowPage"));

type ActiveView = "main" | "settings" | "reports";
type SettingsTab = "cost" | "o1" | "o2" | "o3";
type ReportsTab = "feasibility" | "capital" | "escrow";
type Scenario = "offplan_escrow" | "offplan_construction" | "no_offplan";

const LAST_FP_PROJECT_KEY = "como_last_fp_project_id";

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "cost", label: "إعدادات التكاليف" },
  { id: "o1", label: "السيناريو الأول O1" },
  { id: "o2", label: "السيناريو الثاني O2" },
  { id: "o3", label: "السيناريو الثالث O3" },
];

const REPORTS_TABS: { id: ReportsTab; label: string }[] = [
  { id: "feasibility", label: "ملخص الجدوى المالية" },
  { id: "capital", label: "خطة رأس مال المشروع" },
  { id: "escrow", label: "التدفقات النقدية وحساب الضمان" },
];

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

/** Map settings tab → forced scenario (undefined = use DB scenario) */
function scenarioForTab(tab: SettingsTab): Scenario | undefined {
  if (tab === "o1") return "offplan_escrow";
  if (tab === "o2") return "offplan_construction";
  if (tab === "o3") return "no_offplan";
  return undefined; // "cost" tab uses DB scenario
}

export default function FinancialPlanningHubPage({ onBack }: { onBack: () => void }) {
  const [activeView, setActiveView] = useState<ActiveView>("main");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("cost");
  const [activeReportsTab, setActiveReportsTab] = useState<ReportsTab>("feasibility");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem(LAST_FP_PROJECT_KEY);
    return saved ? Number(saved) : null;
  });

  const { data: projectsList } = trpc.projects.list.useQuery();

  useEffect(() => {
    if (projectsList && projectsList.length > 0 && !selectedProjectId) {
      const first = (projectsList[0] as any).id;
      setSelectedProjectId(first);
      localStorage.setItem(LAST_FP_PROJECT_KEY, String(first));
    }
  }, [projectsList, selectedProjectId]);

  const viewTitle =
    activeView === "settings"
      ? "إعدادات التدفق"
      : activeView === "reports"
        ? "تقارير التخطيط المالي"
        : "التخطيط المالي";

  const activeTabs = activeView === "settings" ? SETTINGS_TABS : activeView === "reports" ? REPORTS_TABS : [];
  const activeTabId = activeView === "settings" ? activeSettingsTab : activeReportsTab;

  const selectedProject = (projectsList as any[])?.find((p: any) => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeView !== "main") setActiveView("main");
              else onBack();
            }}
            className="gap-1.5 shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            {activeView !== "main" ? "العودة للتخطيط المالي" : "العودة"}
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-sm font-bold text-foreground">{viewTitle}</h1>

          {/* Project selector */}
          <div className="mr-auto flex items-center gap-2">
            <select
              value={selectedProjectId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setSelectedProjectId(id);
                if (id) localStorage.setItem(LAST_FP_PROJECT_KEY, String(id));
              }}
              className="text-xs h-8 px-2 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="">اختر المشروع...</option>
              {(projectsList as any[])?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedProject && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {selectedProject.name}
              </span>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        {activeView !== "main" && (
          <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
            {activeTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (activeView === "settings") setActiveSettingsTab(tab.id as SettingsTab);
                  else setActiveReportsTab(tab.id as ReportsTab);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTabId === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main icons */}
      {activeView === "main" && (
        <main className="max-w-7xl mx-auto px-4 py-12">
          {!selectedProjectId && (
            <div className="text-center mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              اختر مشروعاً من القائمة أعلاه لعرض الإعدادات والتقارير
            </div>
          )}
          <div className="flex flex-wrap gap-6 justify-center">
            <button
              onClick={() => selectedProjectId && setActiveView("settings")}
              className={`group flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all w-56 ${
                selectedProjectId
                  ? "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                  : "border-border/50 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg group-hover:scale-110 transition-transform">
                <Settings2 className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-bold text-foreground">إعدادات التدفق</span>
              <span className="text-xs text-muted-foreground">4 سيناريوهات</span>
            </button>

            <button
              onClick={() => selectedProjectId && setActiveView("reports")}
              className={`group flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all w-56 ${
                selectedProjectId
                  ? "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                  : "border-border/50 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg group-hover:scale-110 transition-transform">
                <FileBarChart2 className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-bold text-foreground">تقارير التخطيط المالي</span>
              <span className="text-xs text-muted-foreground">3 تقارير</span>
            </button>
          </div>
        </main>
      )}

      {/* No project selected warning in sub-views */}
      {activeView !== "main" && !selectedProjectId && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-amber-800 text-sm font-medium">اختر مشروعاً من القائمة أعلاه أولاً</p>
          </div>
        </div>
      )}

      {/* React page content — Settings */}
      {activeView === "settings" && selectedProjectId && (
        <Suspense fallback={<PageLoader />}>
          <CashFlowSettingsPage
            key={`settings-${activeSettingsTab}-${selectedProjectId}`}
            embedded
            initialProjectId={selectedProjectId}
            initialScenario={scenarioForTab(activeSettingsTab)}
          />
        </Suspense>
      )}

      {/* React page content — Reports */}
      {activeView === "reports" && selectedProjectId && activeReportsTab === "feasibility" && (
        <Suspense fallback={<PageLoader />}>
          <FeasibilityStudyPage
            key={`feasibility-${selectedProjectId}`}
            embedded
            initialProjectId={selectedProjectId}
          />
        </Suspense>
      )}
      {activeView === "reports" && selectedProjectId && activeReportsTab === "capital" && (
        <Suspense fallback={<PageLoader />}>
          <CapitalScheduleTablePage
            key={`capital-${selectedProjectId}`}
            embedded
            initialProjectId={selectedProjectId}
          />
        </Suspense>
      )}
      {activeView === "reports" && selectedProjectId && activeReportsTab === "escrow" && (
        <Suspense fallback={<PageLoader />}>
          <EscrowCashFlowPage
            key={`escrow-${selectedProjectId}`}
            embedded
            initialProjectId={selectedProjectId}
          />
        </Suspense>
      )}
    </div>
  );
}
