import { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { default as ArrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { default as ClipboardList } from "lucide-react/dist/esm/icons/clipboard-list.js";
import { default as HardHat } from "lucide-react/dist/esm/icons/hard-hat.js";
import { default as Target } from "lucide-react/dist/esm/icons/target.js";
import { default as Settings } from "lucide-react/dist/esm/icons/settings.js";
import { default as TrendingDown } from "lucide-react/dist/esm/icons/trending-down.js";
import { default as FileText } from "lucide-react/dist/esm/icons/file-text.js";
import { default as Building2 } from "lucide-react/dist/esm/icons/building-2.js";
import { default as LayoutGrid } from "lucide-react/dist/esm/icons/layout-grid.js";
import { default as Landmark } from "lucide-react/dist/esm/icons/landmark.js";
import { default as Calendar } from "lucide-react/dist/esm/icons/calendar.js";
import { default as WalletCards } from "lucide-react/dist/esm/icons/wallet-cards.js";
import { default as Layers3 } from "lucide-react/dist/esm/icons/layers-3.js";
import { default as Users } from "lucide-react/dist/esm/icons/users.js";
import { default as FlaskConical } from "lucide-react/dist/esm/icons/flask-conical.js";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ProjectSelector } from "@/components/ProjectSelector";
import { getFallbackFinancialStudiesTab, isFinancialStudiesTabVisible, type FinancialStudiesTabId } from "@/lib/financialStudiesNavigation";
import { resolveReturnPath, withReturnPath } from "@/lib/returnNavigation";

const UnifiedProjectCardPage = lazy(() => import("./UnifiedProjectCardPage"));
const PricingPage = lazy(() => import("./PricingPage"));
const ConstructionInputsPage = lazy(() => import("./ConstructionInputsPage"));
const V2WaelSales = lazy(() => import("./V2WaelSales"));
const SettingsRulesPage = lazy(() => import("./SettingsRulesPage"));
const V2InvestorCashFlow = lazy(() => import("./V2InvestorCashFlow"));
const V2EscrowCashFlow = lazy(() => import("./V2EscrowCashFlow"));
const V2Feasibility = lazy(() => import("./V2Feasibility"));
const V2CapitalPortfolio = lazy(() => import("./V2CapitalPortfolio"));
const V2UnifiedGroupCashFlow = lazy(() => import("./V2UnifiedGroupCashFlow"));
const TimelinePage = lazy(() => import("./TimelinePage"));

type TabId = FinancialStudiesTabId;
type TileTone = { accent: string; wash: string; icon: string; border: string };

const TONES: TileTone[] = [
  { accent: "#d65f9b", wash: "#fff3f8", icon: "#f8d9e8", border: "#edbdd5" },
  { accent: "#149b9a", wash: "#effcfb", icon: "#d1f1ee", border: "#afe4df" },
  { accent: "#d4a91f", wash: "#fffbed", icon: "#f8edbc", border: "#ecd977" },
  { accent: "#9b304a", wash: "#fff4f6", icon: "#f4d9df", border: "#e8b9c4" },
  { accent: "#3c78d8", wash: "#f1f6ff", icon: "#d6e5fb", border: "#b9d2f5" },
  { accent: "#d26c4d", wash: "#fff6f2", icon: "#f8ded4", border: "#edc3b6" },
  { accent: "#835bce", wash: "#f7f3ff", icon: "#e6dcfa", border: "#d1c0f2" },
  { accent: "#4b9f78", wash: "#f1fbf6", icon: "#d8efdf", border: "#bce2cb" },
  { accent: "#b94379", wash: "#fff3f8", icon: "#f6d9e7", border: "#eab9d0" },
  { accent: "#3c91c2", wash: "#f1faff", icon: "#d5edf7", border: "#b8ddeb" },
  { accent: "#c7801e", wash: "#fff9f0", icon: "#f4e2c5", border: "#e8c99a" },
  { accent: "#5167b2", wash: "#f3f5ff", icon: "#dde3f7", border: "#c2ccef" },
  { accent: "#b96045", wash: "#fff5f1", icon: "#f3dbd3", border: "#e6bdb0" },
];

const TABS: { id: TabId; label: string; description: string; icon: any; projectScoped: boolean }[] = [
  { id: "general", label: "بطاقة المشروع", description: "المدخلات المالية والبيانات المعتمدة", icon: ClipboardList, projectScoped: true },
  { id: "units", label: "توزيع الوحدات", description: "الوحدات والمساحات وتسعيرها", icon: LayoutGrid, projectScoped: true },
  { id: "construction", label: "خطة الإنشاء", description: "مدة الإنشاء ومنحنى الصرف", icon: HardHat, projectScoped: true },
  { id: "sales", label: "المبيعات والتسويق", description: "مساحة وائل لتخطيط البيع", icon: Target, projectScoped: true },
  { id: "timeline", label: "الجدول الزمني", description: "التصاميم والإنشاء والاستحقاقات", icon: Calendar, projectScoped: true },
  { id: "settings", label: "الإعدادات والقواعد", description: "افتراضات التدفق المالي", icon: Settings, projectScoped: true },
  { id: "cashflows", label: "تدفقات المستثمر", description: "المطلوب والمستلم وصافي رأس المال", icon: TrendingDown, projectScoped: true },
  { id: "escrow", label: "تدفقات الإسكرو", description: "حساب الضمان والحركات المعتمدة", icon: Landmark, projectScoped: true },
  { id: "feasibility", label: "دراسة الجدوى", description: "العائد والتكلفة ورأس المال", icon: FileText, projectScoped: true },
  { id: "mall", label: "المركز التجاري", description: "ملحقات المشروع التجارية", icon: Building2, projectScoped: true },
  { id: "capital_portfolio", label: "محفظة رأس المال", description: "رأس المال والعوائد المجمعة", icon: WalletCards, projectScoped: false },
  { id: "unified_group_cashflow", label: "التدفقات الموحدة", description: "كل المشاريع وحركة المجموعة الشهرية", icon: Layers3, projectScoped: false },
];

function TabContent({ tabId }: { tabId: TabId }) {
  switch (tabId) {
    case "general": return <UnifiedProjectCardPage />;
    case "units": return <PricingPage embedded />;
    case "construction": return <ConstructionInputsPage embedded />;
    case "sales": return <V2WaelSales embedded />;
    case "timeline": return <TimelinePage embedded />;
    case "settings": return <SettingsRulesPage embedded />;
    case "cashflows": return <V2InvestorCashFlow embedded />;
    case "escrow": return <V2EscrowCashFlow embedded />;
    case "feasibility": return <V2Feasibility embedded />;
    case "mall": return <div className="flex flex-col items-center justify-center gap-2 py-12 text-center"><Building2 className="h-8 w-8 text-slate-300" /><p className="text-xs text-slate-500">المركز التجاري — قيد الإعداد</p></div>;
    case "capital_portfolio": return <V2CapitalPortfolio embedded />;
    case "unified_group_cashflow": return <V2UnifiedGroupCashFlow />;
    default: return null;
  }
}

type BateekhaPageProps = {
  mode?: "standard" | "test";
  testCpaProjectId?: number | null;
};

export default function BateekhaPage({ mode = "standard", testCpaProjectId }: BateekhaPageProps = {}) {
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const financingScenario = (projectQuery.data as any)?.financingScenario;
  const projectType = financingScenario === "build_for_sale" || financingScenario === "build_for_rent" || financingScenario === "joint_venture_land_for_units" ? financingScenario : undefined;

  useEffect(() => {
    setActiveTab((currentTab) => currentTab ? getFallbackFinancialStudiesTab(currentTab, projectType) : null);
  }, [projectType]);

  useEffect(() => {
    const syncActiveTabFromUrl = () => {
      const requestedTabParam = new URLSearchParams(window.location.search).get("tab");
      // Older Financial Studies links used "pricing" for Wael's unified sales and
      // marketing canvas. Keep these links valid when the page is reopened.
      const requestedTab = (requestedTabParam === "pricing" ? "sales" : requestedTabParam) as TabId | null;
      if (requestedTab && TABS.some((tab) => tab.id === requestedTab) && isFinancialStudiesTabVisible(requestedTab, projectType)) {
        setActiveTab(requestedTab);
      } else {
        setActiveTab(null);
      }
    };

    syncActiveTabFromUrl();
    window.addEventListener("popstate", syncActiveTabFromUrl);
    return () => window.removeEventListener("popstate", syncActiveTabFromUrl);
  }, [projectType]);

  // Portfolio reports are company-wide reports. They stay visible after choosing a
  // project so the project picker never makes the three consolidated reports vanish.
  // Project-specific cards remain disabled until the project is selected.
  const isTestMode = mode === "test";
  const basePath = isTestMode ? "/test-project" : "/bateekha";
  const visibleTabs = TABS.filter((tab) =>
    isFinancialStudiesTabVisible(tab.id, projectType) && (!isTestMode || tab.projectScoped)
  );
  const selectTab = (tab: (typeof TABS)[number]) => {
    if (tab.projectScoped && !selectedProjectId) return;
    // Wouter tracks the pathname while these reports share `/bateekha` and only
    // change the query string. Update local state as the click happens rather
    // than waiting for a pathname change that may never occur.
    setActiveTab(tab.id);
    navigate(withReturnPath(`${basePath}?tab=${tab.id}`, basePath));
  };

  const returnFromTab = () => {
    setActiveTab(null);
    navigate(resolveReturnPath(window.location.search, basePath));
  };

  return (
    <div className="financial-studies-language min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8fafc]" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm font-bold text-slate-700 transition-colors hover:text-teal-700"><ArrowRight className="h-4 w-4" />الرئيسية</button>
          <span className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${isTestMode ? "bg-violet-600" : "bg-teal-600"}`}>{isTestMode ? <FlaskConical className="h-3.5 w-3.5" /> : <Layers3 className="h-3.5 w-3.5" />}</span><h1 className="text-sm font-bold text-slate-900">{isTestMode ? "المشروع التجريبي المعزول" : "الدراسات والتخطيط المالي"}</h1></div>
        </div>
      </header>

      {!activeTab ? (
        <main className="mx-auto w-full max-w-[1720px] px-4 py-7 sm:px-6">
          <section className={`fs-card mb-6 overflow-hidden shadow-sm ${isTestMode ? "border-violet-200 bg-violet-50/40" : "fs-card-teal"}`}>
            <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center md:px-5">
              <div>
                <p className={`text-[11px] font-black tracking-wide ${isTestMode ? "text-violet-700" : "text-teal-700"}`}>{isTestMode ? "بيئة اختبار مستقلة" : "الدراسات والتخطيط المالي"}</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{isTestMode ? "جرّب كل بطاقات المشروع بأمان" : "اختر المشروع مرة واحدة"}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{isTestMode ? "أي بيانات تدخلها هنا تبقى داخل المشروع التجريبي، ولا تظهر في قوائم المشاريع أو مركز القيادة أو المحافظ والتقارير المجمعة." : "بعدها تفتح كل بطاقات المشروع نفسه، وزر العودة يعيدك إلى الخطوة السابقة فعلًا."}</p>
              </div>
              {isTestMode ? <span className="inline-flex w-fit items-center rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-black text-violet-700">غير رسمي · لا يدخل في التقارير</span> : <div className="w-full md:w-72"><ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} /></div>}
            </div>
            {selectedProjectId && projectQuery.data && <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-xs"><span className="font-bold text-slate-500">المشروع المختار</span><span className="rounded-full bg-white px-3 py-1 font-black text-slate-800 ring-1 ring-slate-200">{(projectQuery.data as any).name}</span><span className="rounded-full bg-teal-50 px-3 py-1 font-bold text-teal-700">{projectType === "joint_venture_land_for_units" ? "Joint Venture — أرض مقابل وحدات" : projectType === "build_for_sale" ? "بناء للبيع" : projectType === "build_for_rent" ? "بناء للتأجير" : "أوف بلان"}</span></div>}
          </section>

          <div className="mb-4 flex items-center justify-between gap-4"><div className="flex items-center gap-2"><span className="h-7 w-1 rounded-full bg-teal-500" /><h3 className="text-lg font-black text-slate-900">كل الدراسات</h3></div>{!selectedProjectId && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">اختر مشروعًا لفتح بطاقات المشروع</span>}</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isTestMode && testCpaProjectId && (
              <button type="button" onClick={() => navigate(`/consultant-proposals?scopeProjectId=${testCpaProjectId}&returnTo=${encodeURIComponent(basePath)}`)} className="group relative flex min-h-[94px] items-center justify-between overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white px-5 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <span className="absolute inset-x-0 top-0 h-1 bg-violet-600" />
                <span><span className="block text-[15px] font-black text-slate-900">نطاق التصميم والعروض</span><span className="mt-1 block text-[10px] font-bold text-violet-700">نفس مسار المكاتب الاستشارية</span></span>
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-violet-600 text-white shadow-sm"><Users className="h-6 w-6" /></span>
              </button>
            )}
            {visibleTabs.map((tab, index) => {
              const Icon = tab.icon;
              const tone = TONES[index % TONES.length];
              const disabled = tab.projectScoped && !selectedProjectId;
              return <button key={tab.id} type="button" disabled={disabled} onClick={() => selectTab(tab)} className="group relative flex min-h-[94px] items-center justify-between overflow-hidden rounded-2xl border px-5 text-right shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: tone.border, background: `linear-gradient(135deg, ${tone.wash} 0%, #ffffff 74%)` }}>
                <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: tone.accent }} />
                <span className="text-[15px] font-black text-slate-900">{tab.label}</span>
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] text-white shadow-sm" style={{ backgroundColor: tone.accent, boxShadow: `0 10px 20px ${tone.accent}22` }}><Icon className="h-6 w-6" /></span>
              </button>;
            })}
          </div>
        </main>
      ) : (
        <div className="w-full">
          <div className="sticky top-14 z-40 border-b-2 border-slate-300 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-sm sm:px-6"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3"><button type="button" onClick={returnFromTab} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-700 bg-teal-700 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-teal-800"><ArrowRight className="h-3.5 w-3.5" />العودة إلى الصفحة السابقة</button><span className="hidden h-5 w-px bg-slate-300 sm:block" /><span className="text-xs font-extrabold text-slate-900">{TABS.find((tab) => tab.id === activeTab)?.label}</span>{selectedProjectId && TABS.find((tab) => tab.id === activeTab)?.projectScoped && <span className="mr-auto text-[11px] font-semibold text-slate-700">المشروع المحدد: {(projectQuery.data as any)?.name || "..."}</span>}</div></div>
          <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" /></div>}><TabContent tabId={activeTab} /></Suspense>
        </div>
      )}
    </div>
  );
}
