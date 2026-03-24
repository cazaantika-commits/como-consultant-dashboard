import { useState } from "react";
import { Settings, FileBarChart2, Wallet, Landmark, Layers } from "lucide-react";
import PortfolioAllScenariosPage from "./PortfolioAllScenariosPage";

type ViewId = "settings" | "feasibility" | "capital" | "escrow" | "portfolio";

export default function CashFlowHub({ embedded }: { embedded?: boolean } = {}) {
  const [activeView, setActiveView] = useState<ViewId | null>(null);

  const settingsIcon = {
    id: "settings" as const,
    label: "إعدادات التدفقات",
    icon: Settings,
    emoji: "⚙️",
    color: "from-slate-600 to-slate-800",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
  };

  const reportTabs = [
    {
      id: "feasibility" as const,
      label: "ملخص الجدوى المالية",
      icon: FileBarChart2,
      emoji: "📊",
      activeClass: "bg-violet-600 text-white shadow-lg shadow-violet-200",
    },
    {
      id: "capital" as const,
      label: "خطة رأس مال المشروع",
      icon: Wallet,
      emoji: "💰",
      activeClass: "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
    },
    {
      id: "escrow" as const,
      label: "التدفقات النقدية وحساب الضمان",
      icon: Landmark,
      emoji: "🏦",
      activeClass: "bg-indigo-600 text-white shadow-lg shadow-indigo-200",
    },
    {
      id: "portfolio" as const,
      label: "محفظة المشاريع — السيناريوهات",
      icon: Layers,
      emoji: "📁",
      activeClass: "bg-gray-700 text-white shadow-lg shadow-gray-300",
    },
  ];

  const getIframeSrc = (view: ViewId): string => {
    switch (view) {
      case "settings": return "/cost-settings.html";
      case "feasibility": return "/feasibility-summary.html";
      case "capital": return "/capital-plan.html";
      case "escrow": return "/escrow-cashflow.html";
      case "portfolio": return ""; // handled as React component
    }
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-gray-50"} dir="rtl">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-[98%] mx-auto px-4">
          <div className="flex items-center gap-3 py-3 overflow-x-auto">
            {/* Settings Icon */}
            <button
              onClick={() => setActiveView("settings")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap border ${
                activeView === "settings"
                  ? "bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-200 border-slate-600"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-slate-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="font-bold">{settingsIcon.label}</span>
            </button>

            {/* Separator */}
            <div className="h-8 w-px bg-gray-300 mx-1 flex-shrink-0" />

            {/* Report Tabs */}
            {reportTabs.map((tab) => {
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? tab.activeClass
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="text-base">{tab.emoji}</span>
                  <span className="font-bold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full" style={{ height: "calc(100vh - 70px)" }}>
        {activeView === "portfolio" ? (
          <div className="w-full h-full overflow-auto">
            <PortfolioAllScenariosPage />
          </div>
        ) : activeView ? (
          <iframe
            key={activeView}
            src={getIframeSrc(activeView)}
            className="w-full h-full border-0"
            title={activeView}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-6xl mb-4">📊</span>
            <p className="text-lg font-medium text-gray-500">اختر من القائمة أعلاه</p>
            <p className="text-sm text-gray-400 mt-1">إعدادات التدفقات أو أحد التقارير المالية</p>
          </div>
        )}
      </div>
    </div>
  );
}
