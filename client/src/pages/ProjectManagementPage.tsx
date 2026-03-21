import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Layers } from "lucide-react";
import FactSheetPage from "./FactSheetPage";
import KnowledgeHubPage from "./KnowledgeHubPage";
import FinancialPlanningHubPage from "./FinancialPlanningHubPage";
import CapitalSchedulingPage from "./CapitalSchedulingPage";

type View = "icons" | "fact-sheet" | "knowledge" | "financial" | "capital-portfolio";

// Custom SVG icon components for each section
const FactSheetIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect x="8" y="4" width="28" height="36" rx="4" fill="white" fillOpacity="0.25"/>
    <rect x="8" y="4" width="28" height="36" rx="4" stroke="white" strokeWidth="2"/>
    <path d="M14 14h16M14 20h16M14 26h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="36" cy="36" r="8" fill="white" fillOpacity="0.3"/>
    <path d="M33 36l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const KnowledgeIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <circle cx="24" cy="18" r="10" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="2"/>
    <path d="M18 18c0-3.3 2.7-6 6-6s6 2.7 6 6c0 2.5-1.5 4.6-3.7 5.5L26 28h-4l-.3-4.5C19.5 22.6 18 20.5 18 18z" fill="white"/>
    <rect x="20" y="30" width="8" height="2.5" rx="1.25" fill="white"/>
    <rect x="21" y="34" width="6" height="2.5" rx="1.25" fill="white"/>
    <path d="M8 38c2-4 5-6 8-7M40 38c-2-4-5-6-8-7" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
  </svg>
);

const FinancialIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect x="4" y="28" width="8" height="14" rx="2" fill="white" fillOpacity="0.5"/>
    <rect x="14" y="20" width="8" height="22" rx="2" fill="white" fillOpacity="0.7"/>
    <rect x="24" y="12" width="8" height="30" rx="2" fill="white"/>
    <rect x="34" y="6" width="8" height="36" rx="2" fill="white" fillOpacity="0.85"/>
    <path d="M6 24l10-8 10-6 10-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
    <circle cx="6" cy="24" r="2.5" fill="white"/>
    <circle cx="16" cy="16" r="2.5" fill="white"/>
    <circle cx="26" cy="10" r="2.5" fill="white"/>
    <circle cx="36" cy="4" r="2.5" fill="white"/>
  </svg>
);

const PortfolioIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
    <rect x="4" y="14" width="18" height="14" rx="3" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="2"/>
    <rect x="26" y="14" width="18" height="14" rx="3" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="2"/>
    <rect x="4" y="32" width="18" height="10" rx="3" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="2"/>
    <rect x="26" y="32" width="18" height="10" rx="3" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="2"/>
    <path d="M13 6h22" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M24 6v8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M10 21h6M30 21h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <path d="M10 38h6M30 38h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SECTIONS = [
  {
    id: "fact-sheet" as View,
    label: "بطاقة المشروع",
    SvgIcon: FactSheetIcon,
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    shadow: "rgba(245, 158, 11, 0.35)",
    borderColor: "#f59e0b",
    description: "بيانات المشروع والمعلومات الأساسية",
  },
  {
    id: "knowledge" as View,
    label: "المعرفة والتحليل",
    SvgIcon: KnowledgeIcon,
    gradient: "linear-gradient(135deg, #7c3aed, #db2777)",
    shadow: "rgba(124, 58, 237, 0.35)",
    borderColor: "#7c3aed",
    description: "الدراسات والأبحاث والبيانات والمخاطر",
  },
  {
    id: "financial" as View,
    label: "التخطيط المالي",
    SvgIcon: FinancialIcon,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    shadow: "rgba(59, 130, 246, 0.35)",
    borderColor: "#3b82f6",
    description: "الجدوى المالية والتدفقات النقدية وجدول التكاليف",
  },
  {
    id: "capital-portfolio" as View,
    label: "محفظة رأس المال للمشاريع",
    SvgIcon: PortfolioIcon,
    gradient: "linear-gradient(135deg, #059669, #10b981)",
    shadow: "rgba(5, 150, 105, 0.35)",
    borderColor: "#059669",
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
            const { SvgIcon } = section;
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

                {/* SVG Icon */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: section.gradient, boxShadow: `0 6px 20px ${section.shadow}` }}
                >
                  <SvgIcon />
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
