import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, BarChart3, AlertCircle, Circle, Layers } from "lucide-react";
import { trpc } from "@/lib/trpc";
import FeasibilityHubPage from "./FeasibilityHubPage";
import WorkProgramHub from "./WorkProgramHub";
import CapitalSchedulingPage from "./CapitalSchedulingPage";

type View = "icons" | "feasibility-hub" | "work-program" | "capital-scheduling";

const SECTIONS = [
  {
    id: "feasibility-hub" as View,
    label: "دراسة جدوى المشروع",
    icon: BarChart3,
    gradient: "linear-gradient(135deg, #059669, #047857)",
    shadow: "rgba(5, 150, 105, 0.3)",
    borderColor: "#059669",
    statusKey: "feasibility-hub",
    description: "بطاقة المشروع، دراسة الجدوى، التدفقات النقدية",
  },
  {
    id: "work-program" as View,
    label: "برنامج العمل",
    icon: Building2,
    gradient: "linear-gradient(135deg, #0d9488, #0f766e)",
    shadow: "rgba(13, 148, 136, 0.3)",
    borderColor: "#0d9488",
    statusKey: "program-cashflow",
    description: "مراحل التطوير والجدول الزمني",
  },
  {
    id: "capital-scheduling" as View,
    label: "محفظة رأس المال للمشاريع",
    icon: Layers,
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    shadow: "rgba(249, 115, 22, 0.35)",
    borderColor: "#f97316",
    statusKey: "capital-scheduling",
    description: "جدولة احتياجات رأس المال لجميع المشاريع",
  },
];

function StatusDot({ status }: { status: "complete" | "partial" | "empty" }) {
  if (status === "complete") {
    return (
      <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow ring-2 ring-white">
        <AlertCircle className="w-3 h-3 text-white" />
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
      "feasibility-hub": ["fact-sheet", "feasibility", "cashflow", "escrow", "financial-command"],
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

  // If feasibility hub is active, render it as a full page
  if (activeView === "feasibility-hub") {
    return <FeasibilityHubPage onBack={() => setActiveView("icons")} />;
  }

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
                <h1 className="text-sm font-bold text-foreground">الدراسات والتخطيط الاستراتيجي</h1>
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

      {/* Icons View */}
      {activeView === "icons" && (
        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">الدراسات والتخطيط الاستراتيجي</h2>
            <p className="text-sm text-muted-foreground">اختر القسم المطلوب</p>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
            {SECTIONS.map((item) => {
              const sectionStatus = getSectionStatus(item.statusKey);
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className="group relative flex flex-col items-center text-center p-8 rounded-2xl bg-card border border-border/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
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
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300"
                    style={{ background: item.gradient, boxShadow: `0 8px 24px ${item.shadow}` }}
                  >
                    <item.icon className="w-10 h-10 text-white" />
                  </div>

                  <h3 className="text-base font-bold text-foreground leading-tight mb-1">{item.label}</h3>
                  <p className="text-[11px] text-muted-foreground">{item.description}</p>
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
      {activeView === "work-program" && (
        <main className="py-1">
          <WorkProgramHub embedded />
        </main>
      )}
      {activeView === "capital-scheduling" && (
        <main className="py-1">
          <CapitalSchedulingPage embedded onBack={() => setActiveView("icons")} />
        </main>
      )}
    </div>
  );
}
