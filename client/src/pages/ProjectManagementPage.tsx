import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, FileText, BarChart3, ClipboardList, TrendingUp, Landmark, SlidersHorizontal, Wallet, Shield } from "lucide-react";
import { CashFlowProvider } from "@/contexts/CashFlowContext";
import FactSheetPage from "./FactSheetPage";
import FeasibilityStudyPage from "./FeasibilityStudyPage";
import DevelopmentStagesPage from "./DevelopmentStagesPage";
import ExcelCashFlowPage from "./ExcelCashFlowPage";
import EscrowCashFlowPage from "./EscrowCashFlowPage";
import FinancialCommandCenter from "./FinancialCommandCenter";
import CapitalPlanningDashboard from "./CapitalPlanningDashboard";
import ProgramCashFlowPage from "./ProgramCashFlowPage";
import RiskDashboardPage from "./RiskDashboardPage";

type View = "icons" | "fact-sheet" | "feasibility" | "cashflow" | "escrow" | "development-stages" | "financial-command" | "capital-planning" | "program-cashflow" | "risk-dashboard";

const ICONS_CONFIG = [
  {
    id: "fact-sheet" as View,
    label: "بطاقة بيانات المشروع",
    description: "المعلومات الأساسية والتفاصيل الفنية",
    emoji: "📋",
    icon: FileText,
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    bgClass: "from-amber-50 to-amber-100",
    borderClass: "border-amber-200",
    textClass: "text-amber-700",
    shadow: "rgba(245, 158, 11, 0.3)",
  },
  {
    id: "feasibility" as View,
    label: "دراسة الجدوى",
    description: "التحليل المالي والعوائد المتوقعة",
    emoji: "📊",
    icon: BarChart3,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    bgClass: "from-blue-50 to-blue-100",
    borderClass: "border-blue-200",
    textClass: "text-blue-700",
    shadow: "rgba(59, 130, 246, 0.3)",
  },
  {
    id: "cashflow" as View,
    label: "مصاريف المستثمر",
    description: "التمويل المباشر المطلوب من المستثمر",
    emoji: "💰",
    icon: TrendingUp,
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    bgClass: "from-emerald-50 to-emerald-100",
    borderClass: "border-emerald-200",
    textClass: "text-emerald-700",
    shadow: "rgba(16, 185, 129, 0.3)",
  },
  {
    id: "escrow" as View,
    label: "حساب الضمان (الإسكرو)",
    description: "مصاريف البناء + إيرادات المبيعات",
    emoji: "🏦",
    icon: Landmark,
    gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    bgClass: "from-indigo-50 to-indigo-100",
    borderClass: "border-indigo-200",
    textClass: "text-indigo-700",
    shadow: "rgba(99, 102, 241, 0.3)",
  },
  {
    id: "development-stages" as View,
    label: "مراحل التطوير",
    description: "الجدول الزمني ومتابعة التنفيذ",
    emoji: "🏗️",
    icon: ClipboardList,
    gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    bgClass: "from-purple-50 to-purple-100",
    borderClass: "border-purple-200",
    textClass: "text-purple-700",
    shadow: "rgba(139, 92, 246, 0.3)",
  },
  {
    id: "program-cashflow" as View,
    label: "برنامج العمل والتدفقات",
    description: "خطة العمل الشهرية والتدفقات النقدية",
    emoji: "💹",
    icon: Wallet,
    gradient: "linear-gradient(135deg, #0d9488, #0f766e)",
    bgClass: "from-teal-50 to-teal-100",
    borderClass: "border-teal-200",
    textClass: "text-teal-700",
    shadow: "rgba(13, 148, 136, 0.3)",
  },
  {
    id: "capital-planning" as View,
    label: "محاكي تخطيط رأس المال",
    description: "محاكاة التمويل وتخطيط رأس المال",
    emoji: "🏛️",
    icon: Building2,
    gradient: "linear-gradient(135deg, #f59e0b, #b45309)",
    bgClass: "from-yellow-50 to-yellow-100",
    borderClass: "border-yellow-200",
    textClass: "text-yellow-700",
    shadow: "rgba(245, 158, 11, 0.3)",
  },
  {
    id: "financial-command" as View,
    label: "مركز القيادة المالي",
    description: "دمج المشاريع وتحريك التواريخ",
    emoji: "🎯",
    icon: SlidersHorizontal,
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    bgClass: "from-red-50 to-red-100",
    borderClass: "border-red-200",
    textClass: "text-red-700",
    shadow: "rgba(239, 68, 68, 0.3)",
  },
  {
    id: "risk-dashboard" as View,
    label: "لوحة المخاطر",
    description: "تحليل وإدارة مخاطر المشاريع",
    emoji: "🛡️",
    icon: Shield,
    gradient: "linear-gradient(135deg, #e11d48, #be123c)",
    bgClass: "from-rose-50 to-rose-100",
    borderClass: "border-rose-200",
    textClass: "text-rose-700",
    shadow: "rgba(225, 29, 72, 0.3)",
  },
];

export default function ProjectManagementPage() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<View>("icons");

  return (
    <CashFlowProvider>
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
                <span className="text-lg">{ICONS_CONFIG.find(c => c.id === activeView)?.emoji}</span>
                <h1 className="text-sm font-bold text-foreground">
                  {ICONS_CONFIG.find(c => c.id === activeView)?.label}
                </h1>
              </div>
              {/* Quick nav between cashflow and escrow */}
              {(activeView === "cashflow" || activeView === "escrow") && (
                <div className="mr-auto flex items-center gap-1">
                  <button
                    onClick={() => setActiveView("cashflow")}
                    className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                      activeView === "cashflow" 
                        ? "bg-emerald-600 text-white" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    💰 مصاريف المستثمر
                  </button>
                  <button
                    onClick={() => setActiveView("escrow")}
                    className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                      activeView === "escrow" 
                        ? "bg-indigo-600 text-white" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    🏦 حساب الضمان
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* Icons View */}
      {activeView === "icons" && (
        <main className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">إدارة المشاريع</h2>
            <p className="text-sm text-muted-foreground">اختر القسم المطلوب</p>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-3 gap-5">
            {ICONS_CONFIG.map((item) => {
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className="group relative flex flex-col items-center text-center p-5 rounded-2xl border bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Icon Circle */}
                  <div
                    className="w-18 h-18 rounded-2xl flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300"
                    style={{ background: item.gradient, boxShadow: `0 8px 24px ${item.shadow}`, width: '72px', height: '72px' }}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                  </div>

                  {/* Label */}
                  <h3 className="text-xs font-bold text-foreground mb-1 leading-tight">{item.label}</h3>
                  <p className="text-[10px] text-muted-foreground leading-tight">{item.description}</p>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {/* Content Views */}
      {activeView === "fact-sheet" && <FactSheetPage embedded />}
      {activeView === "feasibility" && <FeasibilityStudyPage embedded />}
      {activeView === "cashflow" && (
        <main className="max-w-[98%] mx-auto py-4">
          <ExcelCashFlowPage />
        </main>
      )}
      {activeView === "escrow" && (
        <main className="max-w-[98%] mx-auto py-4">
          <EscrowCashFlowPage />
        </main>
      )}
      {activeView === "development-stages" && <DevelopmentStagesPage embedded />}
      {activeView === "program-cashflow" && (
        <main className="max-w-[98%] mx-auto py-4">
          <ProgramCashFlowPage />
        </main>
      )}
      {activeView === "capital-planning" && (
        <main className="max-w-[98%] mx-auto py-4">
          <CapitalPlanningDashboard embedded />
        </main>
      )}
      {activeView === "financial-command" && (
        <main className="max-w-[98%] mx-auto py-4">
          <FinancialCommandCenter />
        </main>
      )}
      {activeView === "risk-dashboard" && (
        <main className="max-w-[98%] mx-auto py-4">
          <RiskDashboardPage embedded />
        </main>
      )}
    </div>
    </CashFlowProvider>
  );
}
