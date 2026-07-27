import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ClipboardList, HardHat, Target, Settings, TrendingDown, FileText, Building2, Briefcase, LayoutGrid, Landmark } from "lucide-react";

const GeneralInputsPage = lazy(() => import("./GeneralInputsPage"));
const PricingPage = lazy(() => import("./PricingPage"));
const ConstructionInputsPage = lazy(() => import("./ConstructionInputsPage"));
const V2WaelSales = lazy(() => import("./V2WaelSales"));
const SettingsRulesPage = lazy(() => import("./SettingsRulesPage"));
const V2InvestorCashFlow = lazy(() => import("./V2InvestorCashFlow"));
const V2EscrowCashFlow = lazy(() => import("./V2EscrowCashFlow"));
const V2Feasibility = lazy(() => import("./V2Feasibility"));
const V2Portfolio = lazy(() => import("./V2Portfolio"));

type TabId = "general" | "units" | "construction" | "sales" | "settings" | "cashflows" | "escrow" | "feasibility" | "mall" | "portfolio";

const TABS: { id: TabId; label: string; icon: any; group: "input" | "output" }[] = [
  { id: "general", label: "المدخلات العامة", icon: ClipboardList, group: "input" },
  { id: "units", label: "توزيع الوحدات", icon: LayoutGrid, group: "input" },
  { id: "construction", label: "الإنشاء", icon: HardHat, group: "input" },
  { id: "sales", label: "المبيعات والتسويق", icon: Target, group: "input" },
  { id: "settings", label: "الإعدادات والقواعد", icon: Settings, group: "input" },
  { id: "cashflows", label: "تدفقات المستثمر", icon: TrendingDown, group: "output" },
  { id: "escrow", label: "تدفقات الإسكرو", icon: Landmark, group: "output" },
  { id: "feasibility", label: "دراسة الجدوى", icon: FileText, group: "output" },
  { id: "mall", label: "المركز التجاري", icon: Building2, group: "output" },
  { id: "portfolio", label: "تجميع المشاريع", icon: Briefcase, group: "output" },
];

function TabContent({ tabId }: { tabId: TabId }) {
  switch (tabId) {
    case "general":
      return <GeneralInputsPage embedded />;
    case "units":
      return <PricingPage />;
    case "construction":
      return <ConstructionInputsPage embedded />;
    case "sales":
      return <V2WaelSales embedded />;
    case "settings":
      return <SettingsRulesPage embedded />;

    case "cashflows":
      return <V2InvestorCashFlow />;
    case "escrow":
      return <V2EscrowCashFlow />;
    case "feasibility":
      return <V2Feasibility />;
    case "mall":
      return (
        <div className="flex flex-col items-center justify-center text-center gap-2 py-12">
          <Building2 className="w-8 h-8 text-gray-300" />
          <p className="text-xs text-gray-400">المركز التجاري — قيد الإنشاء</p>
        </div>
      );
    case "portfolio":
      return <V2Portfolio />;
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
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Combined Header + Tabs in one compact bar */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center h-7 px-1 gap-1">
          <button onClick={() => navigate("/")} className="p-0.5 rounded hover:bg-gray-100">
            <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <span className="text-[10px] font-bold text-gray-700 whitespace-nowrap ml-1">الدراسات والتخطيط المالي</span>
          <div className="h-3 w-px bg-gray-200 mx-0.5 shrink-0" />
          {/* Input Tabs */}
          {inputTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap rounded transition-colors flex items-center gap-0.5 leading-none ${
                  activeTab === tab.id
                    ? "bg-emerald-100 text-emerald-800"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                {tab.label}
              </button>
            );
          })}
          <div className="h-3 w-px bg-gray-200 mx-0.5 shrink-0" />
          {/* Output Tabs */}
          {outputTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap rounded transition-colors flex items-center gap-0.5 leading-none ${
                  activeTab === tab.id
                    ? "bg-blue-100 text-blue-800"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <Icon className="w-2.5 h-2.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content - no padding, full width, white bg */}
      <div className="w-full">
        <Suspense fallback={
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-gray-200 border-t-emerald-600 rounded-full" />
          </div>
        }>
          <TabContent tabId={activeTab} />
        </Suspense>
      </div>
    </div>
  );
}
