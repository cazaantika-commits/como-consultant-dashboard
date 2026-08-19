import { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ClipboardList, HardHat, Target, Settings, TrendingDown, FileText, Building2, Briefcase, LayoutGrid, Landmark, Calendar, TableProperties, WalletCards, Layers3 } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ProjectSelector } from "@/components/ProjectSelector";
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
const TimelinePage = lazy(() => import("./TimelinePage"));

type TabId = FinancialStudiesTabId;
type TileTone = { accent: string; wash: string; icon: string; border: string };

const TONES: TileTone[] = [
  { accent: "#0f766e", wash: "#f0fdfa", icon: "#ccfbf1", border: "#99f6e4" },
  { accent: "#2563eb", wash: "#eff6ff", icon: "#dbeafe", border: "#bfdbfe" },
  { accent: "#d97706", wash: "#fffbeb", icon: "#fef3c7", border: "#fde68a" },
  { accent: "#7c3aed", wash: "#f5f3ff", icon: "#ede9fe", border: "#ddd6fe" },
  { accent: "#be185d", wash: "#fff1f2", icon: "#ffe4e6", border: "#fecdd3" },
  { accent: "#0369a1", wash: "#f0f9ff", icon: "#e0f2fe", border: "#bae6fd" },
  { accent: "#b45309", wash: "#fff7ed", icon: "#ffedd5", border: "#fed7aa" },
  { accent: "#047857", wash: "#ecfdf5", icon: "#d1fae5", border: "#a7f3d0" },
  { accent: "#6d28d9", wash: "#f5f3ff", icon: "#ede9fe", border: "#ddd6fe" },
  { accent: "#c2410c", wash: "#fff7ed", icon: "#ffedd5", border: "#fed7aa" },
  { accent: "#0f766e", wash: "#f0fdfa", icon: "#ccfbf1", border: "#99f6e4" },
  { accent: "#4338ca", wash: "#eef2ff", icon: "#e0e7ff", border: "#c7d2fe" },
  { accent: "#9f1239", wash: "#fff1f2", icon: "#ffe4e6", border: "#fecdd3" },
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
  { id: "portfolio", label: "تجميع المشاريع", description: "صافي التدفقات لجميع المشاريع", icon: Briefcase, projectScoped: false },
  { id: "portfolio_monthly", label: "العرض الشهري", description: "قراءة شهرية للمحفظة", icon: TableProperties, projectScoped: false },
  { id: "capital_portfolio", label: "محفظة رأس المال", description: "رأس المال والعوائد المجمعة", icon: WalletCards, projectScoped: false },
];

function TabContent({ tabId }: { tabId: TabId }) {
  switch (tabId) {
    case "general": return <UnifiedProjectCardPage />;
    case "units": return <PricingPage embedded />;
    case "construction": return <ConstructionInputsPage embedded />;
    case "sales": return <V2WaelSales embedded />;
    case "timeline": return <TimelinePage embedded />;
    case "settings": return <SettingsRulesPage embedded />;
    case "cashflows": return <V2InvestorCashFlow />;
    case "escrow": return <V2EscrowCashFlow />;
    case "feasibility": return <V2Feasibility embedded />;
    case "mall": return <div className="flex flex-col items-center justify-center gap-2 py-12 text-center"><Building2 className="h-8 w-8 text-slate-300" /><p className="text-xs text-slate-500">المركز التجاري — قيد الإعداد</p></div>;
    case "portfolio": return <V2Portfolio />;
    case "portfolio_monthly": return <V2PortfolioMonthly />;
    case "capital_portfolio": return <V2CapitalPortfolio />;
    default: return null;
  }
}

export default function BateekhaPage() {
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId } = useProjectContext();
  const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
  const financingScenario = (projectQuery.data as any)?.financingScenario;
  const projectType = financingScenario === "build_for_sale" || financingScenario === "build_for_rent" ? financingScenario : undefined;

  useEffect(() => {
    setActiveTab((currentTab) => currentTab ? getFallbackFinancialStudiesTab(currentTab, projectType) : null);
  }, [projectType]);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab") as TabId | null;
    if (requestedTab && TABS.some((tab) => tab.id === requestedTab) && isFinancialStudiesTabVisible(requestedTab, projectType)) {
      setActiveTab(requestedTab);
    }
  }, [location, projectType]);

  const visibleTabs = TABS.filter((tab) => isFinancialStudiesTabVisible(tab.id, projectType));
  const selectTab = (tab: (typeof TABS)[number]) => {
    if (tab.projectScoped && !selectedProjectId) return;
    setActiveTab(tab.id);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm font-bold text-slate-700 transition-colors hover:text-teal-700"><ArrowRight className="h-4 w-4" />الرئيسية</button>
          <span className="h-5 w-px bg-slate-200" />
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white"><Layers3 className="h-3.5 w-3.5" /></span><h1 className="text-sm font-bold text-slate-900">الدراسات والتخطيط المالي</h1></div>
        </div>
      </header>

      {!activeTab ? (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <section className="mb-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-black tracking-wide text-teal-700">خطوة واحدة لجميع الصفحات</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">اختر المشروع ثم افتح الدراسة المطلوبة</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">يُستخدم هذا الاختيار مرة واحدة فقط. بعدها تعمل كل صفحات المشروع على السياق نفسه، من دون قوائم اختيار مكررة داخل الصفحات.</p>
              </div>
              <div className="w-full md:w-72"><ProjectSelector selectedId={selectedProjectId} onSelect={setSelectedProjectId} /></div>
            </div>
            {selectedProjectId && projectQuery.data && <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs"><span className="font-bold text-slate-500">المشروع المختار</span><span className="rounded-full bg-white px-3 py-1 font-black text-slate-800 ring-1 ring-slate-200">{(projectQuery.data as any).name}</span><span className="rounded-full bg-teal-50 px-3 py-1 font-bold text-teal-700">{projectType === "build_for_sale" ? "بناء للبيع" : projectType === "build_for_rent" ? "بناء للتأجير" : "أوف بلان"}</span></div>}
          </section>

          <div className="mb-5 flex items-end justify-between gap-4"><div><h3 className="text-xl font-black text-slate-900">كل الدراسات</h3><p className="mt-1 text-sm text-slate-500">صفحات مستقلة، بألوان واضحة، ومن دون مستويات مخفية.</p></div>{!selectedProjectId && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">اختر مشروعًا لفتح صفحات المشروع</span>}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTabs.map((tab, index) => {
              const Icon = tab.icon;
              const tone = TONES[index % TONES.length];
              const disabled = tab.projectScoped && !selectedProjectId;
              return <button key={tab.id} type="button" disabled={disabled} onClick={() => selectTab(tab)} className="group relative min-h-40 overflow-hidden rounded-2xl border p-5 text-right transition duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55" style={{ backgroundColor: tone.wash, borderColor: tone.border }}>
                <span className="absolute inset-y-0 right-0 w-1" style={{ backgroundColor: tone.accent }} />
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: tone.icon, color: tone.accent }}><Icon className="h-6 w-6" /></span>
                <h4 className="text-base font-black text-slate-900">{tab.label}</h4>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">{tab.description}</p>
                <span className="mt-4 flex items-center gap-1 text-xs font-black" style={{ color: tone.accent }}>{disabled ? "يتطلب اختيار مشروع" : tab.projectScoped ? "فتح صفحة المشروع" : "فتح تقرير المحفظة"}<ArrowRight className="h-3.5 w-3.5" /></span>
              </button>;
            })}
          </div>
        </main>
      ) : (
        <div className="w-full">
          <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6"><div className="mx-auto flex max-w-[1500px] items-center gap-3"><button type="button" onClick={() => setActiveTab(null)} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">العودة إلى دليل الدراسات</button><span className="h-4 w-px bg-slate-200" /><span className="text-xs font-bold text-slate-800">{TABS.find((tab) => tab.id === activeTab)?.label}</span>{selectedProjectId && TABS.find((tab) => tab.id === activeTab)?.projectScoped && <span className="mr-auto text-[11px] font-medium text-slate-500">المشروع المحدد: {(projectQuery.data as any)?.name || "..."}</span>}</div></div>
          <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" /></div>}><TabContent tabId={activeTab} /></Suspense>
        </div>
      )}
    </div>
  );
}
