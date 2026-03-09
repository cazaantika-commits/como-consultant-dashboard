import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, FileText, BarChart3, Wallet, HardHat, Shield, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import FactSheetPage from "./FactSheetPage";
import FeasibilityStudyPage from "./FeasibilityStudyPage";
import DevelopmentStagesPage from "./DevelopmentStagesPage";
import CashFlowHub from "./CashFlowHub";
import WorkProgramHub from "./WorkProgramHub";
import RiskDashboardPage from "./RiskDashboardPage";

type View = "icons" | "fact-sheet" | "feasibility" | "cashflow-hub" | "work-program" | "development-stages" | "risk-dashboard";

// الترتيب المنطقي: بطاقة ← دراسة ← تدفقات ← برنامج عمل ← تنفيذ ← مخاطر
const ICONS_CONFIG = [
  {
    id: "fact-sheet" as View,
    number: 1,
    label: "بطاقة بيانات المشروع",
    description: "المعلومات الأساسية والمساحات والتفاصيل الفنية",
    emoji: "📋",
    icon: FileText,
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    shadow: "rgba(245, 158, 11, 0.3)",
    statusKey: "fact-sheet",
  },
  {
    id: "feasibility" as View,
    number: 2,
    label: "دراسة الجدوى",
    description: "بيانات جويل + محرك التحليل + الميزانية والتسعير",
    emoji: "📊",
    icon: BarChart3,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    shadow: "rgba(59, 130, 246, 0.3)",
    statusKey: "feasibility",
  },
  {
    id: "cashflow-hub" as View,
    number: 3,
    label: "التدفقات النقدية",
    description: "مصاريف المستثمر + حساب الضمان + مركز القيادة",
    emoji: "💰",
    icon: Wallet,
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    shadow: "rgba(16, 185, 129, 0.3)",
    statusKey: "cashflow",
  },
  {
    id: "work-program" as View,
    number: 4,
    label: "برنامج العمل",
    description: "بنود التكاليف والمراحل + محاكاة المحفظة",
    emoji: "📋",
    icon: Building2,
    gradient: "linear-gradient(135deg, #0d9488, #0f766e)",
    shadow: "rgba(13, 148, 136, 0.3)",
    statusKey: "program-cashflow",
  },
  {
    id: "development-stages" as View,
    number: 5,
    label: "مراحل التطوير",
    description: "الجدول الزمني ومتابعة التنفيذ الفعلي",
    emoji: "🏗️",
    icon: HardHat,
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    shadow: "rgba(139, 92, 246, 0.3)",
    statusKey: "development-stages",
  },
  {
    id: "risk-dashboard" as View,
    number: 6,
    label: "لوحة المخاطر",
    description: "تحليل وإدارة مخاطر المشاريع",
    emoji: "🛡️",
    icon: Shield,
    gradient: "linear-gradient(135deg, #e11d48, #be123c)",
    shadow: "rgba(225, 29, 72, 0.3)",
    statusKey: "risk-dashboard",
  },
];

function StatusBadge({ status }: { status: "complete" | "partial" | "empty" }) {
  if (status === "complete") {
    return (
      <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-md ring-2 ring-white">
        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }
  if (status === "partial") {
    return (
      <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-md ring-2 ring-white">
        <AlertCircle className="w-3.5 h-3.5 text-white" />
      </div>
    );
  }
  return (
    <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center shadow-md ring-2 ring-white">
      <Circle className="w-3 h-3 text-white" />
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground mt-6">
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
  );
}

export default function ProjectManagementPage() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<View>("icons");

  // Fetch section status
  const statusQuery = trpc.sectionStatus.getAll.useQuery(undefined, {
    enabled: activeView === "icons",
    staleTime: 30_000,
  });

  // Aggregate status across all projects for a section
  const getSectionStatus = (sectionId: string): "complete" | "partial" | "empty" => {
    if (!statusQuery.data?.sectionSummary) return "empty";
    // Map merged sections to their original status keys
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
    if (hasComplete) return "partial"; // merged sections are "partial" until all sub-sections are complete
    if (hasPartial) return "partial";
    return "empty";
  };

  const getSectionTooltip = (sectionId: string): string => {
    if (!statusQuery.data?.sectionSummary) return "";
    const keyMap: Record<string, string[]> = {
      "cashflow-hub": ["cashflow", "escrow", "financial-command"],
      "work-program": ["program-cashflow", "capital-planning"],
    };
    const keys = keyMap[sectionId] || [sectionId];
    const parts: string[] = [];
    for (const key of keys) {
      const s = statusQuery.data.sectionSummary[key];
      if (!s) continue;
      const subParts: string[] = [];
      if (s.complete > 0) subParts.push(`${s.complete} مكتمل`);
      if (s.partial > 0) subParts.push(`${s.partial} جزئي`);
      if (s.empty > 0) subParts.push(`${s.empty} فارغ`);
      parts.push(subParts.join(" · "));
    }
    return parts.join(" | ");
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
                  const config = ICONS_CONFIG.find(c => c.id === activeView);
                  return config ? (
                    <>
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ background: config.gradient }}
                      >
                        {config.number}
                      </div>
                      <span className="text-lg">{config.emoji}</span>
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
        <main className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-foreground mb-2">إدارة المشاريع</h2>
            <p className="text-sm text-muted-foreground">اختر القسم المطلوب — مرتبة حسب تسلسل العمل</p>
          </div>

          {/* Flow indicator */}
          <div className="flex items-center justify-center gap-2 mb-8 text-[10px] text-muted-foreground">
            {ICONS_CONFIG.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ background: item.gradient }}
                  >
                    {item.number}
                  </div>
                  <span className="font-medium text-[10px]">{item.label.split(" ").slice(0, 2).join(" ")}</span>
                </div>
                {idx < ICONS_CONFIG.length - 1 && (
                  <span className="text-muted-foreground/40 text-sm">←</span>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {ICONS_CONFIG.map((item) => {
              const sectionStatus = getSectionStatus(item.statusKey);
              const tooltip = getSectionTooltip(item.statusKey);
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className="group relative flex flex-col items-center text-center p-6 rounded-2xl border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: 'var(--border)' }}
                  title={tooltip}
                >
                  {/* Status Badge */}
                  {statusQuery.data && <StatusBadge status={sectionStatus} />}

                  {/* Number Badge */}
                  <div
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md ring-2 ring-white"
                    style={{ background: item.gradient }}
                  >
                    {item.number}
                  </div>

                  {/* Icon Circle */}
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300"
                    style={{ background: item.gradient, boxShadow: `0 8px 24px ${item.shadow}` }}
                  >
                    <span className="text-3xl">{item.emoji}</span>
                  </div>

                  {/* Label */}
                  <h3 className="text-sm font-bold text-foreground mb-1 leading-tight">{item.label}</h3>
                  <p className="text-[11px] text-muted-foreground leading-tight">{item.description}</p>

                  {/* Status text */}
                  {statusQuery.data && (
                    <div className={`mt-2 text-[9px] font-medium px-2 py-0.5 rounded-full ${
                      sectionStatus === "complete" ? "bg-emerald-50 text-emerald-700" :
                      sectionStatus === "partial" ? "bg-amber-50 text-amber-700" :
                      "bg-gray-50 text-gray-400"
                    }`}>
                      {sectionStatus === "complete" ? "مكتمل" :
                       sectionStatus === "partial" ? "يحتاج بيانات" :
                       "فارغ"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <StatusLegend />

          {/* Summary bar */}
          {statusQuery.data && (
            <div className="mt-6 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span className="font-medium">نسبة الإنجاز الإجمالية</span>
                <span>{statusQuery.data.totalProjects} مشاريع</span>
              </div>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100">
                {(() => {
                  const totalSections = 6 * (statusQuery.data.totalProjects || 1);
                  let completeCount = 0;
                  let partialCount = 0;
                  Object.values(statusQuery.data.sectionSummary || {}).forEach((s: any) => {
                    completeCount += s.complete;
                    partialCount += s.partial;
                  });
                  const completePct = (completeCount / totalSections) * 100;
                  const partialPct = (partialCount / totalSections) * 100;
                  return (
                    <>
                      <div className="bg-emerald-500 rounded-full transition-all" style={{ width: `${completePct}%` }} />
                      <div className="bg-amber-400 rounded-full transition-all" style={{ width: `${partialPct}%` }} />
                    </>
                  );
                })()}
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
      {activeView === "development-stages" && <DevelopmentStagesPage embedded />}
      {activeView === "risk-dashboard" && (
        <main className="max-w-[98%] mx-auto py-4">
          <RiskDashboardPage embedded />
        </main>
      )}
    </div>
  );
}
