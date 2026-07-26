import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ClipboardList, HardHat, Target, Settings, Calendar, TrendingDown, FileText, Building2, Briefcase } from "lucide-react";

// Lazy load the actual page components
const GeneralInputsPage = lazy(() => import("./GeneralInputsPage"));
const ConstructionInputsPage = lazy(() => import("./ConstructionInputsPage"));
const V2WaelSales = lazy(() => import("./V2WaelSales"));
const SettingsRulesPage = lazy(() => import("./SettingsRulesPage"));
const V2Timeline = lazy(() => import("./V2Timeline"));
const V2InvestorCashFlow = lazy(() => import("./V2InvestorCashFlow"));
const V2Feasibility = lazy(() => import("./V2Feasibility"));
const ConsolidatedInvestorCashFlowPage = lazy(() => import("./ConsolidatedInvestorCashFlowPage"));

type TabId = "general" | "construction" | "sales" | "settings" | "timeline" | "cashflows" | "feasibility" | "mall" | "portfolio";

const TABS: { id: TabId; label: string; icon: any; group: "input" | "output" }[] = [
  { id: "general", label: "المدخلات العامة", icon: ClipboardList, group: "input" },
  { id: "construction", label: "الإنشاء", icon: HardHat, group: "input" },
  { id: "sales", label: "المبيعات والتسويق", icon: Target, group: "input" },
  { id: "settings", label: "الإعدادات والقواعد", icon: Settings, group: "input" },
  { id: "timeline", label: "الجدول الزمني", icon: Calendar, group: "output" },
  { id: "cashflows", label: "التدفقات المالية", icon: TrendingDown, group: "output" },
  { id: "feasibility", label: "دراسة الجدوى", icon: FileText, group: "output" },
  { id: "mall", label: "المركز التجاري", icon: Building2, group: "output" },
  { id: "portfolio", label: "تجميع المشاريع", icon: Briefcase, group: "output" },
];

function TabContent({ tabId }: { tabId: TabId }) {
  switch (tabId) {
    case "general":
      return <GeneralInputsPage embedded />;
    case "construction":
      return <ConstructionInputsPage embedded />;
    case "sales":
      return <V2WaelSales embedded />;
    case "settings":
      return <SettingsRulesPage embedded />;
    case "timeline":
      return <V2Timeline />;
    case "cashflows":
      return <V2InvestorCashFlow />;
    case "feasibility":
      return <V2Feasibility />;
    case "mall":
      return (
        <div className="flex flex-col items-center justify-center text-center gap-4 py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">المركز التجاري</h2>
          <p className="text-sm text-gray-500">مشروع التأجير — قيد الإنشاء</p>
        </div>
      );
    case "portfolio":
      return <ConsolidatedInvestorCashFlowPage />;
    default:
      return null;
  }
}

export default function BateekhaPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const inputTabs = TABS.filter(t => t.group === "input");
  const outputTabs = TABS.filter(t => t.group === "output");

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 h-12 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowRight className="w-5 h-5 text-gray-600" />
          </button>
          <div className="h-5 w-px bg-gray-300" />
          <h1 className="text-lg font-bold text-gray-900">🍉 بطيخة</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-12 z-40">
        <div className="max-w-full mx-auto px-4 flex gap-0.5 overflow-x-auto items-center">
          {/* Input Tabs */}
          {inputTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1 ${
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}

          {/* Separator */}
          <div className="h-5 w-px bg-gray-300 mx-1.5 shrink-0" />

          {/* Output Tabs */}
          {outputTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="w-full">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-emerald-600 rounded-full" />
          </div>
        }>
          <TabContent tabId={activeTab} />
        </Suspense>
      </div>
    </div>
  );
}
