import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Settings2, FileBarChart2 } from "lucide-react";

type ActiveView = "main" | "settings" | "reports";
type SettingsTab = "cost" | "o1" | "o2" | "o3";
type ReportsTab = "feasibility" | "capital-plan" | "escrow";

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "cost", label: "إعدادات التكاليف" },
  { id: "o1", label: "O1 — إيداع ضمان" },
  { id: "o2", label: "O2 — دفعة إنجاز" },
  { id: "o3", label: "O3 — بدون أوف بلان" },
];

const REPORTS_TABS: { id: ReportsTab; label: string }[] = [
  { id: "feasibility", label: "ملخص الجدوى المالية" },
  { id: "capital-plan", label: "خطة رأس مال المشروع" },
  { id: "escrow", label: "التدفقات النقدية وحساب الضمان" },
];

const SETTINGS_URLS: Record<SettingsTab, string> = {
  cost: "/cost-settings.html",
  o1: "/o1-settings.html",
  o2: "/o2-settings.html",
  o3: "/o3-settings.html",
};

const REPORTS_URLS: Record<ReportsTab, string> = {
  feasibility: "/feasibility-summary.html",
  "capital-plan": "/capital-plan.html",
  escrow: "/escrow-cashflow.html",
};

export default function FinancialPlanningHubPage({ onBack }: { onBack: () => void }) {
  const [activeView, setActiveView] = useState<ActiveView>("main");
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("cost");
  const [activeReportsTab, setActiveReportsTab] = useState<ReportsTab>("feasibility");

  const viewTitle = activeView === "settings" ? "إعدادات التدفق" : activeView === "reports" ? "التقارير المالية" : "التخطيط المالي";

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeView !== "main") {
                setActiveView("main");
              } else {
                onBack();
              }
            }}
            className="gap-1.5 shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            {activeView !== "main" ? "العودة للتخطيط المالي" : "العودة"}
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-sm font-bold text-foreground">{viewTitle}</h1>
        </div>

        {/* Settings sub-tabs */}
        {activeView === "settings" && (
          <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeSettingsTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Reports sub-tabs */}
        {activeView === "reports" && (
          <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
            {REPORTS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveReportsTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeReportsTab === tab.id
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

      <main>
        {activeView === "main" && (
          <div className="max-w-7xl mx-auto px-4 py-12">
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
                <span className="text-sm font-bold text-foreground">التقارير المالية</span>
                <span className="text-xs text-muted-foreground">3 تقارير</span>
              </button>
            </div>
          </div>
        )}

        {activeView === "settings" && (
          <iframe
            src={SETTINGS_URLS[activeSettingsTab]}
            className="w-full border-0"
            style={{ height: "calc(100vh - 110px)" }}
          />
        )}

        {activeView === "reports" && (
          <iframe
            src={REPORTS_URLS[activeReportsTab]}
            className="w-full border-0"
            style={{ height: "calc(100vh - 110px)" }}
          />
        )}
      </main>
    </div>
  );
}
