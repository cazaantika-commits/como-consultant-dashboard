import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Settings2, FileBarChart2 } from "lucide-react";

type ActiveView = "main" | "settings" | "reports";

const SETTINGS_TABS = [
  { id: "cost", label: "إعدادات التكاليف", src: "/cost-settings.html" },
  { id: "o1", label: "السيناريو الأول O1", src: "/o1-settings.html" },
  { id: "o2", label: "السيناريو الثاني O2", src: "/o2-settings.html" },
  { id: "o3", label: "السيناريو الثالث O3", src: "/o3-settings.html" },
] as const;

const REPORTS_TABS = [
  { id: "feasibility", label: "ملخص الجدوى المالية", src: "/feasibility-summary.html" },
  { id: "capital", label: "خطة رأس مال المشروع", src: "/capital-plan.html" },
  { id: "escrow", label: "التدفقات النقدية وحساب الضمان", src: "/escrow-cashflow.html" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];
type ReportsTab = (typeof REPORTS_TABS)[number]["id"];

export default function FinancialPlanningHubPage({ onBack }: { onBack: () => void }) {
  const [activeView, setActiveView] = useState<ActiveView>("main");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("cost");
  const [activeReportsTab, setActiveReportsTab] = useState<ReportsTab>("feasibility");

  const viewTitle =
    activeView === "settings"
      ? "إعدادات التدفق"
      : activeView === "reports"
        ? "تقارير التخطيط المالي"
        : "التخطيط المالي";

  const activeTabs = activeView === "settings" ? SETTINGS_TABS : activeView === "reports" ? REPORTS_TABS : [];
  const activeTabId = activeView === "settings" ? activeSettingsTab : activeReportsTab;
  const currentSrc = activeTabs.find((t) => t.id === activeTabId)?.src;

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
          <div className="flex flex-wrap gap-6 justify-center">
            {/* Settings icon */}
            <button
              onClick={() => setActiveView("settings")}
              className="group flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all w-56"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg group-hover:scale-110 transition-transform">
                <Settings2 className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-bold text-foreground">إعدادات التدفق</span>
              <span className="text-xs text-muted-foreground">4 ملفات إعدادات</span>
            </button>

            {/* Reports icon */}
            <button
              onClick={() => setActiveView("reports")}
              className="group flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all w-56"
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

      {/* Iframe content */}
      {activeView !== "main" && currentSrc && (
        <iframe
          key={currentSrc}
          src={currentSrc}
          className="flex-1 w-full border-0"
          style={{ minHeight: "calc(100vh - 7rem)" }}
          title={viewTitle}
        />
      )}
    </div>
  );
}
