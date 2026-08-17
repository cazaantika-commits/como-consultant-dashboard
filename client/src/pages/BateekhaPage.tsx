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

const NAVIGATION_GROUPS: { id: string; label: string; icon: any; tabs: TabId[]; iconClass: string; activeClass: string }[] = [
  { id: "project-data", label: "بيانات المشروع", icon: ClipboardList, tabs: ["general", "units"], iconClass: "bg-emerald-100 text-emerald-700", activeClass: "border-emerald-400 bg-emerald-50" },
  { id: "construction", label: "الإنشاء", icon: HardHat, tabs: ["construction"], iconClass: "bg-slate-100 text-slate-700", activeClass: "border-slate-400 bg-slate-50" },
  { id: "sales", label: "المبيعات والتسعير", icon: Target, tabs: ["sales"], iconClass: "bg-orange-100 text-orange-700", activeClass: "border-orange-400 bg-orange-50" },
  { id: "marketing", label: "التسويق", icon: Megaphone, tabs: ["marketing"], iconClass: "bg-pink-100 text-pink-700", activeClass: "border-pink-400 bg-pink-50" },
  { id: "timeline", label: "الجدول الزمني", icon: Calendar, tabs: ["timeline"], iconClass: "bg-sky-100 text-sky-700", activeClass: "border-sky-400 bg-sky-50" },
  { id: "cash-flow", label: "التدفقات النقدية", icon: TrendingDown, tabs: ["cashflows", "escrow"], iconClass: "bg-teal-100 text-teal-700", activeClass: "border-teal-400 bg-teal-50" },
  { id: "settings", label: "الإعدادات والقواعد", icon: Settings, tabs: ["settings"], iconClass: "bg-violet-100 text-violet-700", activeClass: "border-violet-400 bg-violet-50" },
  { id: "reports", label: "التقارير", icon: FileText, tabs: ["feasibility", "mall", "portfolio", "portfolio_monthly", "capital_portfolio"], iconClass: "bg-indigo-100 text-indigo-700", activeClass: "border-indigo-400 bg-indigo-50" },
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
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const { user } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const financingScenario = (projectQuery.data as any)?.financingScenario;
  const projectType = financingScenario === "build_for_sale" || financingScenario === "build_for_rent"
    ? financingScenario
    : undefined;
  useEffect(() => {
    setActiveTab((currentTab) => currentTab ? getFallbackFinancialStudiesTab(currentTab, projectType) : null);
  }, [projectType]);

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
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => navigate("/")} title="العودة" aria-label="العودة" className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-slate-900 sm:text-lg">الدراسات والتخطيط المالي</h1>
              <p className="hidden text-xs text-slate-500 sm:block">بوابة مستقلة لإعداد المشروع ومراجعة تدفقاته وتقاريره</p>
            </div>
          </div>
          {!user && (
            <button onClick={() => { window.location.href = getLoginUrl(); }} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100">
              <LogIn className="h-3.5 w-3.5" />
              تسجيل الدخول
            </button>
          )}
        </div>
      </header>

      {!activeTab ? (
        <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 sm:py-10">
          <div className="mb-6 flex flex-col gap-1">
            <h2 className="text-lg font-extrabold text-slate-900">اختر مجال العمل</h2>
            <p className="text-sm text-slate-500">اضغط الأيقونة الكبيرة لعرض صفحاتها، أو افتح صفحة مستقلة مباشرة.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {navigationGroups.map((group) => {
              const Icon = group.icon;
              const isGrouped = group.tabs.length > 1;
              const isOpen = openGroupId === group.id;
              const isActive = activeTab !== null && group.tabs.includes(activeTab);
              return (
                <div key={group.id} className={isGrouped && isOpen ? "col-span-full" : isGrouped ? "col-span-2" : "col-span-1"}>
                  <button
                    type="button"
                    onClick={() => handleGroupClick(group.id, group.tabs)}
                    aria-label={group.label}
                    aria-expanded={isGrouped ? isOpen : undefined}
                    className={`relative flex w-full flex-col items-center justify-center rounded-2xl border px-3 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      isGrouped ? "min-h-[156px] gap-2" : "min-h-[118px] gap-1.5"
                    } ${isActive || isOpen ? group.activeClass : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <span className={`flex items-center justify-center rounded-2xl shadow-sm ${isGrouped ? "h-14 w-14" : "h-10 w-10 rounded-xl"} ${group.iconClass}`}>
                      <Icon className={isGrouped ? "h-7 w-7" : "h-5 w-5"} />
                    </span>
                    <span className={`${isGrouped ? "text-sm" : "text-xs"} font-extrabold leading-tight text-slate-800`}>{group.label}</span>
                    {isGrouped && (
                      <>
                        <span className="text-[10px] font-medium text-slate-500">{group.tabs.length} صفحات</span>
                        <ChevronDown className={`absolute left-3 top-3 h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </button>

                  {isGrouped && isOpen && (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${group.iconClass}`}><Icon className="h-4 w-4" /></span>
                          <span className="text-sm font-extrabold text-slate-800">{group.label}</span>
                        </div>
                        <span className="text-xs text-slate-500">اختر الصفحة</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {group.tabs.map((tabId) => {
                          const tab = TABS.find((item) => item.id === tabId)!;
                          const TabIcon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => selectTab(tab.id)}
                              className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-xs font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                            >
                              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${group.iconClass}`}><TabIcon className="h-4 w-4" /></span>
                              <span className="leading-tight">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        <div className="w-full">
          <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
            <div className="mx-auto flex max-w-[1500px] items-center gap-3">
              <button type="button" onClick={() => { setActiveTab(null); setOpenGroupId(null); }} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                العودة إلى دليل الدراسات
              </button>
              <span className="h-4 w-px bg-slate-200" />
              <span className="text-xs font-bold text-slate-800">{TABS.find((tab) => tab.id === activeTab)?.label}</span>
            </div>
          </div>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
            </div>
          }>
            <TabContent tabId={activeTab} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
