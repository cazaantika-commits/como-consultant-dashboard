import { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ChevronDown, ClipboardList, HardHat, Target, Settings, TrendingDown, FileText, Building2, Briefcase, LayoutGrid, Landmark, Megaphone, Calendar, LogIn, TableProperties, WalletCards } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getFallbackFinancialStudiesTab, isFinancialStudiesTabVisible, type FinancialStudiesTabId } from "@/lib/financialStudiesNavigation";
import { getLoginUrl } from "@/const";

const GeneralInputsPage = lazy(() => import("./GeneralInputsPage"));
const PricingPage = lazy(() => import("./PricingPage"));
const ConstructionInputsPage = lazy(() => import("./ConstructionInputsPage"));
const V2WaelSales = lazy(() => import("./V2WaelSales"));
const SettingsRulesPage = lazy(() => import("./SettingsRulesPage"));
const V2InvestorCashFlow = lazy(() => import("./V2InvestorCashFlow"));
const V2EscrowCashFlow = lazy(() => import("./V2EscrowCashFlow"));
const V2Feasibility = lazy(() => import("./V2Feasibility"));
const V2Portfolio = lazy(() => import("./V2Portfolio"));
const V2PortfolioMonthly = lazy(() => import("./V2PortfolioMonthly"));
const V2CapitalPortfolio = lazy(() => import("./V2CapitalPortfolio"));
const MarketingPage = lazy(() => import("./MarketingPage"));
const TimelinePage = lazy(() => import("./TimelinePage"));

type TabId = FinancialStudiesTabId;

const TABS: { id: TabId; label: string; icon: any; group: "input" | "output" }[] = [
  { id: "general", label: "المدخلات العامة", icon: ClipboardList, group: "input" },
  { id: "units", label: "توزيع الوحدات", icon: LayoutGrid, group: "input" },
  { id: "construction", label: "الإنشاء", icon: HardHat, group: "input" },
  { id: "sales", label: "المبيعات", icon: Target, group: "input" },
  { id: "marketing", label: "التسويق", icon: Megaphone, group: "input" },
  { id: "timeline", label: "الجدول الزمني", icon: Calendar, group: "input" },
  { id: "settings", label: "الإعدادات والقواعد", icon: Settings, group: "input" },
  { id: "cashflows", label: "تدفقات المستثمر", icon: TrendingDown, group: "output" },
  { id: "escrow", label: "تدفقات الإسكرو", icon: Landmark, group: "output" },
  { id: "feasibility", label: "دراسة الجدوى", icon: FileText, group: "output" },
  { id: "mall", label: "المركز التجاري", icon: Building2, group: "output" },
  { id: "portfolio", label: "تجميع المشاريع", icon: Briefcase, group: "output" },
  { id: "portfolio_monthly", label: "العرض الشهري", icon: TableProperties, group: "output" },
  { id: "capital_portfolio", label: "محفظة رأس المال", icon: WalletCards, group: "output" },
];

const NAVIGATION_GROUPS: { id: string; label: string; icon: any; tabs: TabId[] }[] = [
  { id: "project-data", label: "بيانات المشروع", icon: ClipboardList, tabs: ["general", "units"] },
  { id: "construction", label: "الإنشاء", icon: HardHat, tabs: ["construction"] },
  { id: "sales", label: "المبيعات والتسعير", icon: Target, tabs: ["sales"] },
  { id: "marketing", label: "التسويق", icon: Megaphone, tabs: ["marketing"] },
  { id: "timeline", label: "الجدول الزمني", icon: Calendar, tabs: ["timeline"] },
  { id: "cash-flow", label: "التدفقات", icon: TrendingDown, tabs: ["cashflows", "escrow"] },
  { id: "settings", label: "الإعدادات", icon: Settings, tabs: ["settings"] },
  { id: "reports", label: "التقارير", icon: FileText, tabs: ["feasibility", "mall", "portfolio", "portfolio_monthly", "capital_portfolio"] },
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
    case "marketing":
      return <MarketingPage embedded />;
    case "timeline":
      return <TimelinePage embedded />;
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
    case "portfolio_monthly":
      return <V2PortfolioMonthly />;
    case "capital_portfolio":
      return <V2CapitalPortfolio />;
    default:
      return null;
  }
}

export default function BateekhaPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const { user } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const financingScenario = (projectQuery.data as any)?.financingScenario;
  const projectType = financingScenario === "build_for_sale" || financingScenario === "build_for_rent"
    ? financingScenario
    : undefined;
  useEffect(() => {
    setActiveTab((currentTab) => getFallbackFinancialStudiesTab(currentTab, projectType));
  }, [projectType, activeTab]);

  const visibleTabs = TABS.filter((tab) => isFinancialStudiesTabVisible(tab.id, projectType));
  const visibleTabIds = new Set(visibleTabs.map((tab) => tab.id));
  const navigationGroups = NAVIGATION_GROUPS
    .map((group) => ({ ...group, tabs: group.tabs.filter((tabId) => visibleTabIds.has(tabId)) }))
    .filter((group) => group.tabs.length > 0);
  const openGroup = navigationGroups.find((group) => group.id === openGroupId);

  const selectTab = (tabId: TabId) => {
    setActiveTab(tabId);
    setOpenGroupId(null);
  };

  const handleGroupClick = (groupId: string, tabIds: TabId[]) => {
    if (tabIds.length === 1) {
      selectTab(tabIds[0]);
      return;
    }
    setOpenGroupId((current) => current === groupId ? null : groupId);
  };

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center min-h-14 px-2 gap-2 overflow-x-auto">
          <button onClick={() => navigate("/")} title="العودة" aria-label="العودة" className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0">
            <ArrowRight className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap ml-1 shrink-0">الدراسات والتخطيط المالي</span>
          {!user && (
            <button onClick={() => { window.location.href = getLoginUrl(); }} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 shrink-0">
              <LogIn className="h-3 w-3" />
              تسجيل الدخول لعرض المشاريع
            </button>
          )}
          <div className="h-7 w-px bg-gray-200 shrink-0" />
          <div className="flex items-center gap-1.5 min-w-max py-1">
            {navigationGroups.map((group) => {
              const Icon = group.icon;
              const isGrouped = group.tabs.length > 1;
              const isActive = group.tabs.includes(activeTab);
              const isOpen = openGroupId === group.id;
              const activeClass = isActive || isOpen ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700";
              const sizeClass = isGrouped ? "h-10 w-10" : "h-8 w-8";
              return (
                <button
                  key={group.id}
                  onClick={() => handleGroupClick(group.id, group.tabs)}
                  title={group.label}
                  aria-label={group.label}
                  aria-expanded={isGrouped ? isOpen : undefined}
                  className={`${sizeClass} relative rounded-xl transition-all flex items-center justify-center shrink-0 ${activeClass}`}
                >
                  <Icon className={isGrouped ? "w-5 h-5" : "w-4 h-4"} />
                  {isGrouped && <ChevronDown className={`absolute bottom-0.5 w-2.5 h-2.5 ${isOpen ? "rotate-180" : ""} transition-transform`} />}
                </button>
              );
            })}
          </div>
        </div>
        {openGroup && (
          <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold text-emerald-800 whitespace-nowrap ml-1">{openGroup.label}</span>
              {openGroup.tabs.map((tabId) => {
                const tab = TABS.find((item) => item.id === tabId)!;
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id)}
                    className={`min-w-20 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-colors flex items-center gap-1.5 justify-center whitespace-nowrap ${
                      isActive ? "border-emerald-500 bg-emerald-100 text-emerald-800" : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
