import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, FileText, BarChart3, Wallet, Shield, CheckCircle2, AlertCircle, Circle, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import FactSheetPage from "./FactSheetPage";
import FeasibilityStudyPage from "./FeasibilityStudyPage";
import CashFlowHub from "./CashFlowHub";
import WorkProgramHub from "./WorkProgramHub";
import RiskDashboardPage from "./RiskDashboardPage";
import MarketReportsPage from "./MarketReportsPage";

type View = "icons" | "fact-sheet" | "feasibility" | "cashflow-hub" | "work-program" | "risk-dashboard" | "market-reports";

const SECTIONS = [
  {
    id: "fact-sheet" as View,
    label: "بطاقة المشروع",
    icon: FileText,
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    shadow: "rgba(245, 158, 11, 0.3)",
    borderColor: "#f59e0b",
    statusKey: "fact-sheet",
  },
  {
    id: "feasibility" as View,
    label: "دراسة الجدوى",
    icon: BarChart3,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    shadow: "rgba(59, 130, 246, 0.3)",
    borderColor: "#3b82f6",
    statusKey: "feasibility",
  },
  {
    id: "cashflow-hub" as View,
    label: "التدفقات النقدية",
    icon: Wallet,
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    shadow: "rgba(16, 185, 129, 0.3)",
    borderColor: "#10b981",
    statusKey: "cashflow",
  },
  {
    id: "work-program" as View,
    label: "برنامج العمل",
    icon: Building2,
    gradient: "linear-gradient(135deg, #0d9488, #0f766e)",
    shadow: "rgba(13, 148, 136, 0.3)",
    borderColor: "#0d9488",
    statusKey: "program-cashflow",
  },
  {
    id: "risk-dashboard" as View,
    label: "لوحة المخاطر",
    icon: Shield,
    gradient: "linear-gradient(135deg, #e11d48, #be123c)",
    shadow: "rgba(225, 29, 72, 0.3)",
    borderColor: "#e11d48",
    statusKey: "risk-dashboard",
  },
  {
    id: "market-reports" as View,
    label: "تقارير السوق",
    icon: TrendingUp,
    gradient: "linear-gradient(135deg, #0891b2, #06b6d4)",
    shadow: "rgba(8, 145, 178, 0.3)",
    borderColor: "#0891b2",
    statusKey: "market-reports",
  },
];

function StatusDot({ status }: { status: "complete" | "partial" | "empty" }) {
  if (status === "complete") {
    return (
      <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow ring-2 ring-white">
        <CheckCircle2 className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (status === "partial") {
    return (
      <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow ring-2 ring-white">
        <AlertCircle className="w-3 h-3 text-white" />
      </div>
    );
  }
  return (
    <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center shadow ring-2 ring-white">
      <Circle className="w-2.5 h-2.5 text-white" />
    </div>
  );
}

export default function ProjectManagementPage() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<View>("icons");

  const statusQuery = trpc.sectionStatus.getAll.useQuery(undefined, {
    enabled: activeView === "icons",
    staleTime: 30_000,
  });

  const getSectionStatus = (sectionId: string): "complete" | "partial" | "empty" => {
    if (!statusQuery.data?.sectionSummary) return "empty";
    const keyMap: Record<string, string[]> = {
      "cashflow-hub": ["cashflow", "escrow", "financial-command"],
      "work-program": ["program-cashflow", "capital-planning"],
    };
    const keys = keyMap[sectionId] || [sectionId];
    let hasComplete = false;
    let hasPartial = false;
    for (const key of keys) {
      const summary = statusQuery.data.sectionSummary[key];
      if (!summary) continue;
      if (summary.complete > 0) hasComplete = true;
      if (summary.partial > 0) hasPartial = true;
    }
    if (hasComplete) return "partial";
    if (hasPartial) return "partial";
    return "empty";
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          {activeView === "icons" ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                الرئيسية
              </Button>
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-white" />
                </div>
                <h1 className="text-sm font-bold text-foreground">إدارة المشاريع</h1>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setActiveView("icons")} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                العودة
              </Button>
              <div className="h-5 w-px bg-border" />
              <div className="flex items-center gap-2">
                {(() => {
                  const config = SECTIONS.find(c => c.id === activeView);
                  return config ? (
                    <>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: config.gradient }}
                      >
                        <config.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h1 className="text-sm font-bold text-foreground">{config.label}</h1>
                    </>
                  ) : null;
                })()}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Icons View - Clean grid, no stepper, no descriptions */}
      {activeView === "icons" && (
        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">إدارة المشاريع</h2>
            <p className="text-sm text-muted-foreground">اختر القسم المطلوب</p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {SECTIONS.map((item) => {
              const sectionStatus = getSectionStatus(item.statusKey);
              return (
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

                  {/* Status Dot */}
                  {statusQuery.data && <StatusDot status={sectionStatus} />}

                  {/* Icon */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300"
                    style={{ background: item.gradient, boxShadow: `0 8px 24px ${item.shadow}` }}
                  >
                    <item.icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Label only - no description */}
                  <h3 className="text-sm font-bold text-foreground leading-tight">{item.label}</h3>
                </button>
              );
            })}
          </div>

          {/* Status Legend */}
          {statusQuery.data && (
            <div className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground mt-8">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>مكتمل</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>يحتاج بيانات</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-300" />
                <span>فارغ</span>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Content Views */}
      {activeView === "fact-sheet" && <FactSheetPage embedded />}
      {activeView === "feasibility" && <FeasibilityStudyPage embedded />}
      {activeView === "cashflow-hub" && (
        <main className="py-1">
          <CashFlowHub embedded />
        </main>
      )}
      {activeView === "work-program" && (
        <main className="py-1">
          <WorkProgramHub embedded />
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
