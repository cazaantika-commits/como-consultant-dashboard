import { useState } from "react";
import ProgramCashFlowPage from "./ProgramCashFlowPage";
import CapitalPlanningDashboard from "./CapitalPlanningDashboard";
import { ClipboardList, SlidersHorizontal } from "lucide-react";

const TABS = [
  {
    id: "program" as const,
    label: "بنود التكاليف والمراحل",
    description: "إدخال وتوزيع التكاليف على الأشهر",
    icon: ClipboardList,
    emoji: "📋",
    color: "teal",
  },
  {
    id: "simulation" as const,
    label: "محاكاة المحفظة",
    description: "ماذا لو أخّرنا أو ألغينا مشروع؟",
    icon: SlidersHorizontal,
    emoji: "🎛️",
    color: "amber",
  },
] as const;

type TabId = typeof TABS[number]["id"];

export default function WorkProgramHub({ embedded }: { embedded?: boolean } = {}) {
  const [activeTab, setActiveTab] = useState<TabId>("program");

  const tabColors: Record<TabId, { active: string; dot: string }> = {
    program: {
      active: "bg-teal-600 text-white shadow-lg shadow-teal-200",
      dot: "bg-teal-500",
    },
    simulation: {
      active: "bg-amber-600 text-white shadow-lg shadow-amber-200",
      dot: "bg-amber-500",
    },
  };

  return (
    <div className={embedded ? "" : "min-h-screen bg-gray-50"} dir="rtl">
      {/* Tab Navigation */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-[98%] mx-auto px-4">
          <div className="flex items-center gap-2 py-2.5 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const colors = tabColors[tab.id];
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? `${colors.active}`
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="text-base">{tab.emoji}</span>
                  <div className="text-right">
                    <div className="font-bold">{tab.label}</div>
                    {isActive && (
                      <div className="text-[10px] opacity-80 mt-0.5">{tab.description}</div>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Context hint */}
            <div className="mr-auto flex items-center gap-2 text-[10px] text-gray-400">
              <div className={`w-2 h-2 rounded-full ${tabColors[activeTab].dot}`} />
              <span>
                {activeTab === "program" && "أدخل بنود التكاليف ووزّعها على الأشهر لكل مشروع"}
                {activeTab === "simulation" && "استبعد أو أخّر مشاريع وشاهد التأثير على رأس المال"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-[98%] mx-auto py-3">
        {activeTab === "program" && <ProgramCashFlowPage />}
        {activeTab === "simulation" && <CapitalPlanningDashboard embedded />}
      </div>
    </div>
  );
}
