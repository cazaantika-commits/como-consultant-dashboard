import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Brain, BarChart3, Layers } from "lucide-react";
import FactSheetPage from "./FactSheetPage";
import KnowledgeHubPage from "./KnowledgeHubPage";
import FinancialPlanningHubPage from "./FinancialPlanningHubPage";
import CapitalSchedulingPage from "./CapitalSchedulingPage";

type View = "icons" | "fact-sheet" | "knowledge" | "financial" | "capital-portfolio";

const SECTIONS = [
  {
    id: "fact-sheet" as View,
    label: "بطاقة المشروع",
    icon: FileText,
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    shadow: "rgba(245, 158, 11, 0.35)",
    borderColor: "#f59e0b",
    emoji: "📋",
    description: "بيانات المشروع والمعلومات الأساسية",
  },
  {
    id: "knowledge" as View,
    label: "المعرفة والتحليل",
    icon: Brain,
    gradient: "linear-gradient(135deg, #7c3aed, #db2777)",
    shadow: "rgba(124, 58, 237, 0.35)",
    borderColor: "#7c3aed",
    emoji: "🧠",
    description: "الدراسات والأبحاث والبيانات والمخاطر",
  },
  {
    id: "financial" as View,
    label: "التخطيط المالي",
    icon: BarChart3,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    shadow: "rgba(59, 130, 246, 0.35)",
    borderColor: "#3b82f6",
    emoji: "📊",
    description: "الجدوى المالية والتدفقات النقدية وجدول التكاليف",
  },
  {
    id: "capital-portfolio" as View,
    label: "محفظة رأس المال للمشاريع",
    icon: Layers,
    gradient: "linear-gradient(135deg, #059669, #10b981)",
    shadow: "rgba(5, 150, 105, 0.35)",
    borderColor: "#059669",
    emoji: "💼",
    description: "جدولة رأس المال لجميع المشاريع",
  },
];

export default function ProjectManagementPage() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<View>("icons");

  // Sub-views
  if (activeView === "fact-sheet") {
    return <FactSheetPage embedded onBack={() => setActiveView("icons")} />;
  }
  if (activeView === "knowledge") {
    return <KnowledgeHubPage onBack={() => setActiveView("icons")} />;
  }
  if (activeView === "financial") {
    return <FinancialPlanningHubPage onBack={() => setActiveView("icons")} />;
  }
  if (activeView === "capital-portfolio") {
    return <CapitalSchedulingPage embedded onBack={() => setActiveView("icons")} />;
  }

  // Icons grid
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
            <ArrowRight className="w-4 h-4" />
            الرئيسية
          </Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-foreground">الدراسات والتخطيط الاستراتيجي</h1>
          </div>
        </div>
      </header>

      {/* 4 Cards Grid */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground mb-2">الدراسات والتخطيط الاستراتيجي</h2>
          <p className="text-sm text-muted-foreground">اختر القسم المطلوب للبدء</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveView(section.id)}
                className="group relative rounded-2xl border bg-card text-right overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl p-6"
                style={{
                  borderColor: section.borderColor + "40",
                  boxShadow: `0 4px 20px ${section.shadow}`,
                }}
              >
                {/* Background gradient overlay */}
                <div
                  className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
                  style={{ background: section.gradient }}
                />
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
                  style={{ backgroundColor: section.borderColor }}
                />

                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: section.gradient, boxShadow: `0 4px 14px ${section.shadow}` }}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Emoji badge */}
                <div className="absolute top-5 left-5 text-3xl opacity-20 group-hover:opacity-40 transition-opacity">
                  {section.emoji}
                </div>

                {/* Text */}
                <h3 className="text-base font-bold text-foreground mb-1 relative z-10">{section.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed relative z-10">{section.description}</p>

                {/* Arrow */}
                <div
                  className="mt-4 flex items-center gap-1 text-xs font-medium transition-colors relative z-10"
                  style={{ color: section.borderColor }}
                >
                  <span>فتح القسم</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
