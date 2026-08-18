import { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ClipboardList, HardHat, Target, Settings, TrendingDown, FileText, Building2, Briefcase, LayoutGrid, Landmark, Megaphone, Calendar, TableProperties, WalletCards, Layers3 } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getFallbackFinancialStudiesTab, isFinancialStudiesTabVisible, type FinancialStudiesTabId } from "@/lib/financialStudiesNavigation";

const UnifiedProjectCardPage = lazy(() => import("./UnifiedProjectCardPage"));
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
  { id: "general", label: "بطاقة المشروع", icon: ClipboardList, group: "input" },
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

const NAVIGATION_GROUPS: { id: string; label: string; description: string; icon: any; tabs: TabId[]; gradient: string; shadow: string; borderColor: string }[] = [
  { id: "project-card", label: "بطاقة المشروع", description: "بيانات المشروع والمعلومات الأساسية وتوزيع الوحدات", icon: ClipboardList, tabs: ["general", "units"], gradient: "linear-gradient(135deg, #f59e0b, #d97706)", shadow: "rgba(245, 158, 11, 0.35)", borderColor: "#f59e0b" },
  { id: "planning", label: "الإعداد والتخطيط", description: "الإنشاء والتسعير والمبيعات والتسويق والجدول الزمني والقواعد", icon: Target, tabs: ["construction", "sales", "marketing", "timeline", "settings"], gradient: "linear-gradient(135deg, #7c3aed, #db2777)", shadow: "rgba(124, 58, 237, 0.35)", borderColor: "#7c3aed" },
  { id: "financial", label: "التخطيط المالي", description: "تدفقات المستثمر وحساب الضمان ورأس المال المطلوب للمشروع", icon: TrendingDown, tabs: ["cashflows", "escrow"], gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", shadow: "rgba(59, 130, 246, 0.35)", borderColor: "#3b82f6" },
  { id: "portfolio", label: "محفظة رأس المال الديناميكية", description: "تجميع المشاريع والتدفقات الشهرية ومحفظة رأس المال", icon: WalletCards, tabs: ["portfolio", "portfolio_monthly", "capital_portfolio", "mall"], gradient: "linear-gradient(135deg, #e65100, #ff8f00)", shadow: "rgba(230, 81, 0, 0.35)", borderColor: "#e65100" },
  { id: "feasibility", label: "دراسة جدوى المستثمر", description: "التكلفة والإيراد والربحية ورأس المال والعوائد الاستثمارية", icon: FileText, tabs: ["feasibility"], gradient: "linear-gradient(135deg, #0d9488, #0f766e)", shadow: "rgba(13, 148, 136, 0.35)", borderColor: "#0d9488" },
];

function TabContent({ tabId }: { tabId: TabId }) {
  switch (tabId) {
    case "general":
      return <UnifiedProjectCardPage />;
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
  const OpenGroupIcon = openGroup?.icon;

  const selectTab = (tabId: TabId) => {
    setActiveTab(tabId);
    setOpenGroupId(null);
  };

  const handleGroupClick = (groupId: string, tabIds: TabId[]) => {
    if (tabIds.length === 1) {
      selectTab(tabIds[0]);
      return;
    }
    setOpenGroupId(groupId);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm font-bold text-foreground transition-colors hover:text-primary">
            <ArrowRight className="h-4 w-4" />
            الرئيسية
          </button>
          <span className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-white"><Layers3 className="h-3.5 w-3.5" /></span>
            <h1 className="text-sm font-bold text-foreground">الدراسات والتخطيط المالي</h1>
          </div>
        </div>
      </header>

      {!activeTab && !openGroup ? (
        <main className="mx-auto max-w-5xl px-6 py-12">
          <div className="mb-10 text-center">
            <h2 className="mb-2 text-2xl font-bold text-foreground">الدراسات والتخطيط المالي</h2>
            <p className="text-sm text-muted-foreground">اختر القسم المطلوب للبدء</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {navigationGroups.map((group) => {
              const Icon = group.icon;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleGroupClick(group.id, group.tabs)}
                  className="group relative overflow-hidden rounded-2xl border bg-card p-6 text-right transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
                  style={{ borderColor: group.borderColor + "40", boxShadow: `0 4px 20px ${group.shadow}` }}
                >
                  <span className="absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10" style={{ background: group.gradient }} />
                  <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" style={{ backgroundColor: group.borderColor }} />
                  <span className="relative z-10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110" style={{ background: group.gradient, boxShadow: `0 6px 20px ${group.shadow}` }}>
                    <Icon className="h-7 w-7" />
                  </span>
                  <h3 className="relative z-10 mb-1 text-base font-bold text-foreground">{group.label}</h3>
                  <p className="relative z-10 min-h-10 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
                  <span className="relative z-10 mt-4 flex items-center gap-1 text-xs font-medium" style={{ color: group.borderColor }}>
                    <span>فتح القسم</span>
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      ) : !activeTab && openGroup ? (
        <main className="mx-auto max-w-5xl px-6 py-12">
          <button type="button" onClick={() => setOpenGroupId(null)} className="mb-8 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
            <ArrowRight className="h-4 w-4" />
            العودة إلى جميع الأقسام
          </button>
          <div className="mb-10 text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: openGroup.gradient, boxShadow: `0 6px 20px ${openGroup.shadow}` }}>{OpenGroupIcon && <OpenGroupIcon className="h-7 w-7" />}</span>
            <h2 className="mb-2 text-2xl font-bold text-foreground">{openGroup.label}</h2>
            <p className="text-sm text-muted-foreground">{openGroup.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {openGroup.tabs.map((tabId) => {
              const tab = TABS.find((item) => item.id === tabId)!;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className="group relative overflow-hidden rounded-2xl border bg-card p-6 text-right transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
                  style={{ borderColor: openGroup.borderColor + "40", boxShadow: `0 4px 20px ${openGroup.shadow}` }}
                >
                  <span className="absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10" style={{ background: openGroup.gradient }} />
                  <span className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" style={{ backgroundColor: openGroup.borderColor }} />
                  <span className="relative z-10 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110" style={{ background: openGroup.gradient, boxShadow: `0 6px 20px ${openGroup.shadow}` }}><TabIcon className="h-7 w-7" /></span>
                  <h3 className="relative z-10 mb-1 text-base font-bold text-foreground">{tab.label}</h3>
                  <span className="relative z-10 mt-4 flex items-center gap-1 text-xs font-medium" style={{ color: openGroup.borderColor }}>
                    <span>فتح الصفحة</span>
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  </span>
                </button>
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
