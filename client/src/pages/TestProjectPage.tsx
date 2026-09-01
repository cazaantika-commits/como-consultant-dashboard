import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { FlaskConical, FolderOpen, Plus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useProjectContext } from "@/contexts/ProjectContext";
import BateekhaPage from "./BateekhaPage";

const SCENARIOS = [
  { value: "joint_venture_land_for_units", label: "Joint Venture Off-Plan — الأرض مقابل وحدات" },
  { value: "offplan_escrow", label: "أوف بلان — إيداع 20% في حساب الضمان" },
  { value: "offplan_construction", label: "أوف بلان — إنجاز 20% من الإنشاء" },
  { value: "build_for_sale", label: "بناء للبيع بعد الإنجاز" },
  { value: "build_for_rent", label: "بناء للتأجير" },
] as const;

const scenarioLabel = (scenario: string) => SCENARIOS.find((item) => item.value === scenario)?.label || scenario;

export default function TestProjectPage() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const { setSelectedProjectId } = useProjectContext();
  const [, navigate] = useLocation();
  const requestedCreation = useRef(false);
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]["value"]>("joint_venture_land_for_units");
  const [landOwnerSharePct, setLandOwnerSharePct] = useState("35");
  const testProjectsQuery = trpc.projects.listTestProjects.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });
  const ensureTestProject = trpc.projects.ensureTestProject.useMutation({
    onSuccess: async () => {
      await utils.projects.listTestProjects.invalidate();
    },
  });
  const createTestProject = trpc.projects.createTestProject.useMutation({
    onSuccess: async (project) => {
      await utils.projects.listTestProjects.invalidate();
      setName("");
      setScenario("joint_venture_land_for_units");
      setLandOwnerSharePct("35");
      setShowCreate(false);
      setSelectedProjectId(project.id);
      navigate(`/test-project?projectId=${project.id}`);
    },
  });

  const search = new URLSearchParams(window.location.search);
  const requestedProjectId = Number(search.get("projectId") || 0);
  const requestedTab = search.get("tab");
  const testProjects = testProjectsQuery.data || [];
  const activeProject = useMemo(() => {
    if (requestedProjectId > 0) return testProjects.find((project) => project.id === requestedProjectId) || null;
    return requestedTab ? testProjects[0] || null : null;
  }, [requestedProjectId, requestedTab, testProjects]);

  useEffect(() => {
    if (!user || testProjectsQuery.isLoading || testProjects.length > 0 || requestedCreation.current) return;
    requestedCreation.current = true;
    ensureTestProject.mutate();
  }, [ensureTestProject, testProjects.length, testProjectsQuery.isLoading, user]);

  useEffect(() => {
    if (activeProject?.id) {
      setSelectedProjectId(activeProject.id);
    }
  }, [activeProject?.id, setSelectedProjectId]);

  useEffect(() => {
    if (!requestedProjectId && requestedTab && activeProject?.id) {
      const params = new URLSearchParams(window.location.search);
      params.set("projectId", String(activeProject.id));
      navigate(`/test-project?${params.toString()}`, { replace: true });
    }
  }, [activeProject?.id, navigate, requestedProjectId, requestedTab]);

  const openProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    navigate(`/test-project?projectId=${projectId}`);
  };

  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    createTestProject.mutate({
      name: trimmedName,
      financingScenario: scenario,
      landOwnerSharePct: scenario === "joint_venture_land_for_units"
        ? Math.max(0, Math.min(100, Number(landOwnerSharePct) || 0))
        : undefined,
    });
  };

  if (testProjectsQuery.isLoading || ensureTestProject.isPending || testProjects.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" dir="rtl">
        <div className="rounded-2xl border border-violet-200 bg-white px-8 py-7 text-center shadow-sm">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-violet-100 border-t-violet-600" />
          <p className="text-sm font-black text-slate-900">جاري تجهيز المشروع التجريبي المعزول</p>
          <p className="mt-1 text-xs text-slate-500">يتم ربط نفس بطاقات المشروع دون إضافته إلى القوائم الرسمية.</p>
          {ensureTestProject.error && <p className="mt-3 text-xs font-bold text-red-700">{ensureTestProject.error.message}</p>}
        </div>
      </div>
    );
  }

  if (requestedProjectId > 0 && !activeProject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4" dir="rtl">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-7 text-center shadow-sm">
          <p className="text-sm font-black text-red-800">هذا المشروع التجريبي غير موجود أو لا يخص حسابك.</p>
          <button type="button" onClick={() => navigate("/test-project")} className="mt-4 rounded-xl bg-violet-700 px-5 py-2.5 text-xs font-black text-white">العودة إلى مختبر المشاريع</button>
        </div>
      </div>
    );
  }

  if (activeProject) {
    return (
      <BateekhaPage
        mode="test"
        testProjectId={activeProject.id}
        testProjectName={activeProject.name}
        testCpaProjectId={activeProject.cpaProjectId}
        onExitTestProject={() => {
          setSelectedProjectId(null);
          navigate("/test-project");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8" dir="rtl">
      <main className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 bg-gradient-to-l from-violet-50 via-white to-cyan-50 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-700 text-white shadow-sm"><FlaskConical className="h-6 w-6" /></span>
              <div><p className="text-xs font-black text-violet-700">مختبر مشاريع دائم ومعزول</p><h1 className="mt-1 text-2xl font-black text-slate-950">المشاريع التجريبية</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">أنشئ واحفظ وافتح أي عدد من المشاريع التجريبية. كل مشروع مستقل ولا يدخل في المشاريع الرسمية أو مركز القيادة أو التقارير المجمعة.</p></div>
            </div>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-violet-800"><Plus className="h-4 w-4" />إنشاء مشروع تجريبي جديد</button>
          </div>

          {showCreate && (
            <form onSubmit={submitCreate} className="border-t border-violet-100 bg-violet-50/40 px-6 py-5">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-black text-slate-900">مشروع تجريبي جديد</h2><p className="mt-1 text-xs text-slate-500">ستُنشأ جميع البطاقات ونطاق التصميم تلقائيًا دون أرقام مالية مفترضة.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white"><X className="h-4 w-4" /></button></div>
              <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_180px_auto] md:items-end">
                <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">اسم المشروع التجريبي</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مشروع الأرض الثانية" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-violet-500" /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">النموذج المالي</span><select value={scenario} onChange={(event) => setScenario(event.target.value as typeof scenario)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold outline-none focus:border-violet-500">{SCENARIOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                {scenario === "joint_venture_land_for_units" ? <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">حصة مالك الأرض (%)</span><input type="number" min="0" max="100" step="0.01" value={landOwnerSharePct} onChange={(event) => setLandOwnerSharePct(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black outline-none focus:border-violet-500" /></label> : <div />}
                <button type="submit" disabled={!name.trim() || createTestProject.isPending} className="h-11 rounded-xl bg-teal-700 px-5 text-xs font-black text-white disabled:opacity-50">{createTestProject.isPending ? "جاري الإنشاء..." : "إنشاء وفتح"}</button>
              </div>
              {createTestProject.error && <p className="mt-3 text-xs font-bold text-red-700">{createTestProject.error.message}</p>}
            </form>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-black text-slate-900">المشاريع المحفوظة</h2><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{testProjects.length} مشروع</span></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {testProjects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><FlaskConical className="h-5 w-5" /></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">غير رسمي</span></div>
                <h3 className="mt-4 text-base font-black text-slate-950">{project.name}</h3>
                <p className="mt-1 text-[11px] font-bold leading-5 text-violet-700">{scenarioLabel(project.financingScenario)}</p>
                {project.plotNumber && <p className="mt-1 text-[11px] text-slate-500">القطعة: {project.plotNumber}</p>}
                <button type="button" onClick={() => openProject(project.id)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-black text-violet-800 transition hover:bg-violet-100"><FolderOpen className="h-4 w-4" />فتح المشروع وبطاقاته</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
