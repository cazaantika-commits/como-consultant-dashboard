import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, FileText, BarChart3, FileBarChart2, CalendarRange, Wallet, Landmark, Shield, TrendingUp } from "lucide-react";
import { CashFlowProvider, useCashFlow } from "@/contexts/CashFlowContext";
import FactSheetPage from "./FactSheetPage";
import FeasibilityStudyPage from "./FeasibilityStudyPage";
import FinancialFeasibilityTab from "./FinancialFeasibilityTab";
import TimeDistributionTab from "./TimeDistributionTab";
import ExcelCashFlowPage from "./ExcelCashFlowPage";
import EscrowCashFlowPage from "./EscrowCashFlowPage";
import RiskDashboardPage from "./RiskDashboardPage";
import MarketReportsPage from "./MarketReportsPage";

type SubView = "icons" | "fact-sheet" | "feasibility" | "fin-feasibility" | "time-dist" | "capital" | "escrow" | "risk-dashboard" | "market-reports";

const SUB_SECTIONS = [
  {
    id: "fact-sheet" as SubView,
    label: "بطاقة المشروع",
    icon: FileText,
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    shadow: "rgba(245, 158, 11, 0.3)",
    borderColor: "#f59e0b",
    emoji: "📋",
  },
  {
    id: "feasibility" as SubView,
    label: "دراسة الجدوى",
    icon: BarChart3,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    shadow: "rgba(59, 130, 246, 0.3)",
    borderColor: "#3b82f6",
    emoji: "📊",
  },
  {
    id: "fin-feasibility" as SubView,
    label: "دراسة الجدوى المالية",
    icon: FileBarChart2,
    gradient: "linear-gradient(135deg, #7c3aed, #6d28d9)",
    shadow: "rgba(124, 58, 237, 0.3)",
    borderColor: "#7c3aed",
    emoji: "📈",
  },
  {
    id: "time-dist" as SubView,
    label: "التوزيع الزمني للمصاريف",
    icon: CalendarRange,
    gradient: "linear-gradient(135deg, #d97706, #b45309)",
    shadow: "rgba(217, 119, 6, 0.3)",
    borderColor: "#d97706",
    emoji: "📅",
  },
  {
    id: "capital" as SubView,
    label: "رأس المال المطلوب",
    icon: Wallet,
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    shadow: "rgba(16, 185, 129, 0.3)",
    borderColor: "#10b981",
    emoji: "💰",
  },
  {
    id: "escrow" as SubView,
    label: "حساب الضمان",
    icon: Landmark,
    gradient: "linear-gradient(135deg, #4f46e5, #4338ca)",
    shadow: "rgba(79, 70, 229, 0.3)",
    borderColor: "#4f46e5",
    emoji: "🏦",
  },
  {
    id: "risk-dashboard" as SubView,
    label: "لوحة المخاطر",
    icon: Shield,
    gradient: "linear-gradient(135deg, #e11d48, #be123c)",
    shadow: "rgba(225, 29, 72, 0.3)",
    borderColor: "#e11d48",
    emoji: "🛡️",
  },
  {
    id: "market-reports" as SubView,
    label: "تقارير السوق",
    icon: TrendingUp,
    gradient: "linear-gradient(135deg, #0891b2, #06b6d4)",
    shadow: "rgba(8, 145, 178, 0.3)",
    borderColor: "#0891b2",
    emoji: "📰",
  },
];

function FeasibilityHubInner({ onBack }: { onBack: () => void }) {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const { selectedProjectId, setSelectedProjectId, setDurations } = useCashFlow();
  const [activeView, setActiveView] = useState<SubView>("icons");

  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);
  const currentSection = SUB_SECTIONS.find(s => s.id === activeView);

  // Auto-update durations from project card when project changes (single source of truth)
  useEffect(() => {
    if (!selectedProject) return;
    const preCon = selectedProject.preConMonths ? Number(selectedProject.preConMonths) : 6;
    const construction = selectedProject.constructionMonths ? Number(selectedProject.constructionMonths) : 24;
    const handover = (selectedProject as any).handoverMonths ? Number((selectedProject as any).handoverMonths) : 2;
    setDurations(prev => ({ ...prev, preCon, construction, handover }));
  }, [selectedProject?.id, selectedProject?.preConMonths, selectedProject?.constructionMonths, (selectedProject as any)?.handoverMonths]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={activeView === "icons" ? onBack : () => setActiveView("icons")}
            className="gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            {activeView === "icons" ? "الرئيسية" : "العودة"}
          </Button>
          <div className="h-5 w-px bg-border" />
          {activeView === "icons" ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </div>
              <h1 className="text-sm font-bold text-foreground">دراسة جدوى المشروع</h1>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {currentSection && (
                <>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: currentSection.gradient }}
                  >
                    <currentSection.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h1 className="text-sm font-bold text-foreground">{currentSection.label}</h1>
                </>
              )}
            </div>
          )}

          {/* Project selector always visible in header */}
          <div className="mr-auto">
            <Select
              value={selectedProjectId ? String(selectedProjectId) : ""}
              onValueChange={(val) => setSelectedProjectId(Number(val))}
            >
              <SelectTrigger className="w-[220px] h-8 text-xs bg-card border-border">
                <SelectValue placeholder="اختر المشروع..." />
              </SelectTrigger>
              <SelectContent>
                {projectsQuery.data?.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Icons View */}
      {activeView === "icons" && (
        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">دراسة جدوى المشروع</h2>
            {selectedProject ? (
              <p className="text-sm text-emerald-600 font-medium">
                📁 {selectedProject.name}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                اختر المشروع من القائمة أعلاه ثم انتقل للقسم المطلوب
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-5">
            {SUB_SECTIONS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className="group relative flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
              >
                {/* Top colored accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
                  style={{ backgroundColor: item.borderColor }}
                />

                {/* Icon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: item.gradient, boxShadow: `0 8px 24px ${item.shadow}` }}
                >
                  <item.icon className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-sm font-bold text-foreground leading-tight">{item.label}</h3>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* Sub-section content — pass initialProjectId so each section starts with the selected project */}
      {activeView === "fact-sheet" && (
        <FactSheetPage embedded initialProjectId={selectedProjectId} />
      )}
      {activeView === "feasibility" && (
        <FeasibilityStudyPage embedded initialProjectId={selectedProjectId} />
      )}
      {activeView === "fin-feasibility" && (
        <div className="max-w-[98%] mx-auto py-3">
          <FinancialFeasibilityTab initialProjectId={selectedProjectId} />
        </div>
      )}
      {activeView === "time-dist" && (
        <div className="max-w-[98%] mx-auto py-3">
          <TimeDistributionTab initialProjectId={selectedProjectId} />
        </div>
      )}
      {activeView === "capital" && (
        <main className="py-1">
          <ExcelCashFlowPage embedded initialProjectId={selectedProjectId} />
        </main>
      )}
      {activeView === "escrow" && (
        <main className="py-1">
          <EscrowCashFlowPage embedded initialProjectId={selectedProjectId} />
        </main>
      )}
      {activeView === "risk-dashboard" && (
        <main className="max-w-[98%] mx-auto py-4">
          <RiskDashboardPage embedded />
        </main>
      )}
      {activeView === "market-reports" && (
        <main className="py-1">
          <MarketReportsPage />
        </main>
      )}
    </div>
  );
}

export default function FeasibilityHubPage({ onBack }: { onBack: () => void }) {
  return (
    <CashFlowProvider>
      <FeasibilityHubInner onBack={onBack} />
    </CashFlowProvider>
  );
}
