import { useState } from "react";
import { CashFlowProvider } from "@/contexts/CashFlowContext";
import FinancialFeasibilityTab from "./FinancialFeasibilityTab";
import TimeDistributionTab from "./TimeDistributionTab";
import ExcelCashFlowPage from "./ExcelCashFlowPage";
import EscrowCashFlowPage from "./EscrowCashFlowPage";
import FinancialCommandCenter from "./FinancialCommandCenter";
import { Wallet, Landmark, BarChart3, FileBarChart2, CalendarRange } from "lucide-react";

const TABS = [
  {
    id: "feasibility" as const,
    label: "ملخص الجدوى المالية",
    description: "إجمالي التكاليف والإيرادات والأرباح",
    icon: FileBarChart2,
    emoji: "📊",
    color: "violet",
  },
  {
    id: "distribution" as const,
    label: "التوزيع الزمني للمصاريف",
    description: "جميع بنود التكاليف موزعة شهرياً",
    icon: CalendarRange,
    emoji: "📅",
    color: "amber",
  },
  {
    id: "investor" as const,
    label: "خطة رأس مال المشروع",
    description: "التمويل المباشر المطلوب شهرياً",
    icon: Wallet,
    emoji: "💰",
    color: "emerald",
  },
  {
    id: "escrow" as const,
    label: "التدفقات النقدية وحساب الضمان",
    description: "مصاريف البناء + إيرادات المبيعات",
    icon: Landmark,
    emoji: "🏦",
    color: "indigo",
  },
  {
    id: "command" as const,
    label: "مركز القيادة",
    description: "جميع المشاريع معاً + تحريك التواريخ",
    icon: BarChart3,
    emoji: "🎯",
    color: "rose",
  },
] as const;

type TabId = typeof TABS[number]["id"];

export default function CashFlowHub({ embedded }: { embedded?: boolean } = {}) {
  const [activeTab, setActiveTab] = useState<TabId>("feasibility");

  const tabColors: Record<TabId, { active: string; ring: string; dot: string }> = {
    feasibility: {
      active: "bg-violet-600 text-white shadow-lg shadow-violet-200",
      ring: "ring-violet-500/20",
      dot: "bg-violet-500",
    },
    distribution: {
      active: "bg-amber-600 text-white shadow-lg shadow-amber-200",
      ring: "ring-amber-500/20",
      dot: "bg-amber-500",
    },
    investor: {
      active: "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
      ring: "ring-emerald-500/20",
      dot: "bg-emerald-500",
    },
    escrow: {
      active: "bg-indigo-600 text-white shadow-lg shadow-indigo-200",
      ring: "ring-indigo-500/20",
      dot: "bg-indigo-500",
    },
    command: {
      active: "bg-rose-600 text-white shadow-lg shadow-rose-200",
      ring: "ring-rose-500/20",
      dot: "bg-rose-500",
    },
  };

  return (
    <CashFlowProvider>
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

              {/* Active tab indicator line */}
              <div className="mr-auto flex items-center gap-2 text-[10px] text-gray-400">
                <div className={`w-2 h-2 rounded-full ${tabColors[activeTab].dot}`} />
                <span>
                  {activeTab === "feasibility" && "إجمالي التكاليف والإيرادات والأرباح ونسبة العائد"}
                  {activeTab === "distribution" && "كل بند من التكاليف موزع على أشهر المشروع"}
                  {activeTab === "investor" && "كم يحتاج المستثمر أن يدفع كل شهر؟"}
                  {activeTab === "escrow" && "كم في حساب الضمان وكم يخرج منه؟"}
                  {activeTab === "command" && "كم تكلفة جميع المشاريع معاً؟"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-[98%] mx-auto py-3">
          {activeTab === "feasibility" && <FinancialFeasibilityTab />}
          {activeTab === "distribution" && <TimeDistributionTab />}
          {activeTab === "investor" && <ExcelCashFlowPage embedded />}
          {activeTab === "escrow" && <EscrowCashFlowPage embedded />}
          {activeTab === "command" && <FinancialCommandCenter embedded />}
        </div>
      </div>
    </CashFlowProvider>
  );
}
