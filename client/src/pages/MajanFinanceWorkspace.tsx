import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileDown,
  Plus,
  Printer,
  RefreshCw,
  Save,
} from "lucide-react";
import type {
  MajanBaseline,
  MajanInputs,
  MajanLocale,
  MajanModelResult,
} from "@shared/majanFinanceTypes";
import { calculateMajanModel } from "@shared/majanModel";
import { trpc } from "@/lib/trpc";
import {
  buildMajanCashFlowCsv,
  buildMajanReportHtml,
  buildMajanWorkbook,
} from "@/lib/majanReportExport";
import MajanInputsPanel from "@/components/majan/MajanInputsPanel";
import MajanReportsPanel from "@/components/majan/MajanReportsPanel";

export type MajanFinanceWorkspaceProps = {
  embedded?: boolean;
  initialView?: "inputs" | "reports";
  /** Compatible optional alias for parent routing; uses first matching report area by default. */
  initialSection?:
    | "inputs"
    | "reports"
    | "development"
    | "leasing"
    | "operations"
    | "finance"
    | "sources";
};

type CaseSummary = {
  id: number;
  caseName: string;
  revision: number;
  updatedAt: string;
};
type SavedState = { id: number; revision: number; updatedAt: string } | null;
const languageKey = "majan-finance-locale";

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatDubaiTimestamp(value: string, locale: MajanLocale): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const formatted = new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(parsed);
  return locale === "ar" ? `${formatted} (دبي، UTC+4)` : `${formatted} (Dubai, UTC+4)`;
}

function screenCopy(locale: MajanLocale) {
  return locale === "ar"
    ? {
        back: "العودة إلى الدراسات المالية",
        inputs: "المدخلات",
        reports: "التقارير",
        save: "حفظ",
        saveAs: "حفظ كنسخة جديدة",
        saving: "جارٍ الحفظ…",
        print: "طباعة التقرير",
        html: "تنزيل HTML",
        csv: "تنزيل CSV",
        excel: "تنزيل Excel",
        exporting: "جارٍ التصدير…",
        language: "English",
        title: "مساحة ماجان المالية",
        subtitle:
          "تقديرات قابلة للتعديل للنقاش فقط — لا تمثل موافقة بنكية أو شروط تمويل",
        draft: "معاينة حية غير محفوظة",
        saved: "محفوظ",
        cases: "السيناريوهات المحفوظة",
        newCase: "سيناريو جديد",
        selectCase: "اختر سيناريو",
        conflict:
          "تم تعديل هذا السيناريو في مكان آخر. أعد تحميله قبل الحفظ لتفادي استبدال صامت.",
        reload: "إعادة التحميل",
        loading: "جارٍ تحميل سيناريو ماجان…",
        error: "تعذر تحميل مساحة ماجان",
        noFinance: "دون تمويل",
        indicative: "تقديري",
        caseName: "اسم السيناريو",
        createName: "أدخل اسم السيناريو الجديد",
        unsaved: "لديك تعديلات غير محفوظة. هل تريد تجاهلها؟",
        created: "تم حفظ سيناريو ماجان",
        updated: "تم تحديث سيناريو ماجان",
        savedAt: "آخر حفظ",
        source: "الأساس الأصلي المؤرشف",
        sourceDescription:
          "جدول تطوير مسجل محفوظ دون دخل تشغيلي؛ ليس ميزانية معتمدة أو إثبات دفع.",
        printBlocked:
          "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.",
        printHint: "يفتح التقرير الكامل للطباعة في نافذة جديدة.",
        exportHint: "تنزيلات داعمة لمسودة النقاش، وليست حزمة ائتمان.",
        excelHint:
          "لقطة قيم قابلة للتدقيق؛ عدّل الافتراضات وأعد الحساب داخل التطبيق، وليست مصنف صيغ تمويل حي.",
        noCase: "لم يُحفظ بعد",
        scenario: "السيناريو",
        validation:
          "توجد ملاحظات حسابية؛ راجع سجل الملاحظات قبل الحفظ أو التصدير.",
        history: "سجل النسخ",
        loadRevision: "تحميل كمعاينة مسودة",
        revisionLoaded: "تم تحميل مدخلات النسخة كمعاينة غير محفوظة",
      }
    : {
        back: "Back to financial studies",
        inputs: "Inputs",
        reports: "Reports",
        save: "Save",
        saveAs: "Save as new case",
        saving: "Saving…",
        print: "Print report",
        html: "Download HTML",
        csv: "Download CSV",
        excel: "Download Excel",
        exporting: "Exporting…",
        language: "العربية",
        title: "Majan finance workspace",
        subtitle:
          "Editable estimates for discussion only — not bank approval or financing terms",
        draft: "LIVE UNSAVED PREVIEW",
        saved: "SAVED",
        cases: "Saved cases",
        newCase: "New scenario",
        selectCase: "Select a case",
        conflict:
          "This scenario changed elsewhere. Reload it before saving to avoid a silent overwrite.",
        reload: "Reload",
        loading: "Loading Majan scenario…",
        error: "Unable to load the Majan workspace",
        noFinance: "No finance",
        indicative: "Indicative",
        caseName: "Scenario name",
        createName: "Enter a name for the new scenario",
        unsaved: "You have unsaved edits. Discard them?",
        created: "Majan scenario saved",
        updated: "Majan scenario updated",
        savedAt: "Last saved",
        source: "Archived original baseline",
        sourceDescription:
          "Recorded development schedule retained without operating income; not an approved budget or payment evidence.",
        printBlocked:
          "The print window could not be opened. Allow pop-ups and try again.",
        printHint: "Opens the full report in a new print window.",
        exportHint:
          "Supporting downloads for a discussion draft, not a credit package.",
        excelHint:
          "An auditable value snapshot; edit assumptions and recalculate in the app, not as a live financing-formula workbook.",
        noCase: "Not yet saved",
        scenario: "Scenario",
        validation:
          "There are model issues; review the issue register before saving or exporting.",
        history: "Version history",
        loadRevision: "Load as draft preview",
        revisionLoaded: "Revision inputs loaded as an unsaved preview",
      };
}

export default function MajanFinanceWorkspace({
  embedded = false,
  initialView = "inputs",
  initialSection,
}: MajanFinanceWorkspaceProps = {}) {
  const [, navigate] = useLocation();
  const [locale, setLocale] = useState<MajanLocale>(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem(languageKey) === "ar"
      ? "ar"
      : "en"
  );
  const [view, setView] = useState<"inputs" | "reports">(
    initialSection && initialSection !== "inputs" ? "reports" : initialView
  );
  const [selectedCaseId, setSelectedCaseId] = useState<number | undefined>(
    () => {
      const raw = new URLSearchParams(window.location.search).get("caseId");
      const parsed = raw ? Number(raw) : NaN;
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
    }
  );
  const [workingInputs, setWorkingInputs] = useState<MajanInputs | null>(null);
  const [persistedInputs, setPersistedInputs] = useState<MajanInputs | null>(null);
  const [baseline, setBaseline] = useState<MajanBaseline | null>(null);
  const [saved, setSaved] = useState<SavedState>(null);
  const [issuedResult, setIssuedResult] = useState<MajanModelResult | null>(
    null
  );
  const [exportingWorkbook, setExportingWorkbook] = useState(false);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const skipFirstLoad = useRef(false);
  const discardOnLoad = useRef(false);
  const initialAutoSelect = useRef(selectedCaseId === undefined);
  const newScenarioRequested = useRef(false);
  const dirtyRef = useRef(false);
  const c = screenCopy(locale);
  const queryInput = useMemo(
    () => ({
      projectId: 1 as const,
      ...(selectedCaseId ? { caseId: selectedCaseId } : {}),
    }),
    [selectedCaseId]
  );
  const workspaceQuery = trpc.majanFinance.get.useQuery(queryInput, {
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const historyQuery = trpc.majanFinance.history.useQuery(
    { projectId: 1, caseId: selectedCaseId ?? 0 },
    {
      enabled: selectedCaseId !== undefined,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );
  const saveMutation = trpc.majanFinance.save.useMutation();
  const dirty = workingInputs !== null && !sameJson(workingInputs, persistedInputs);
  const previewResult = useMemo(
    () => (workingInputs && baseline ? calculateMajanModel(workingInputs, baseline) : null),
    [workingInputs, baseline]
  );
  const result = !dirty && saved && issuedResult ? issuedResult : previewResult;
  const errors = result?.issues.filter(issue => issue.severity === "error").length ?? 0;

  useEffect(() => {
    window.localStorage.setItem(languageKey, locale);
  }, [locale]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    if (initialSection && initialSection !== "inputs") setView("reports");
  }, [initialSection]);
  useEffect(() => {
    if (!workspaceQuery.data) return;
    const data = workspaceQuery.data;
    setCases(data.cases || []);
    if (
      initialAutoSelect.current &&
      !newScenarioRequested.current &&
      selectedCaseId === undefined &&
      !data.case &&
      data.cases?.[0]
    ) {
      initialAutoSelect.current = false;
      discardOnLoad.current = true;
      const latestCaseId = data.cases[0].id;
      setSelectedCaseId(latestCaseId);
      navigate(`/majan-finance?projectId=1&caseId=${latestCaseId}`);
      return;
    }
    initialAutoSelect.current = false;
    if (saved && data.case?.id === saved.id && data.case.revision < saved.revision && !discardOnLoad.current) return;
    if (
      skipFirstLoad.current &&
      !discardOnLoad.current &&
      dirtyRef.current
    )
      return;
    setBaseline(data.baseline);
    setWorkingInputs(data.inputs);
    setPersistedInputs(data.inputs);
    setSaved(
      data.case
        ? {
            id: data.case.id,
            revision: data.case.revision,
            updatedAt: data.case.updatedAt,
          }
        : null
    );
    setIssuedResult(data.case ? data.result : null);
    setLoadError(null);
    skipFirstLoad.current = true;
    discardOnLoad.current = false;
  }, [workspaceQuery.data, selectedCaseId, navigate]);
  useEffect(() => {
    if (workspaceQuery.error) setLoadError(workspaceQuery.error.message);
  }, [workspaceQuery.error]);

  const changeLocale = () => setLocale(value => (value === "en" ? "ar" : "en"));
  const switchCase = (next: number | undefined) => {
    if (next === selectedCaseId) return;
    if (dirty && !window.confirm(c.unsaved)) return;
    discardOnLoad.current = true;
    if (next === undefined) newScenarioRequested.current = true;
    setSelectedCaseId(next);
    const params = new URLSearchParams();
    params.set("projectId", "1");
    if (next) params.set("caseId", String(next));
    navigate(`/majan-finance?${params.toString()}`);
  };
  const startNewScenario = () => {
    if (selectedCaseId === undefined) {
      if (dirty && !window.confirm(c.unsaved)) return;
      newScenarioRequested.current = true;
      discardOnLoad.current = true;
      workspaceQuery.refetch();
    } else switchCase(undefined);
  };
  const reload = () => {
    if (dirty && !window.confirm(c.unsaved)) return;
    discardOnLoad.current = true;
    workspaceQuery.refetch();
  };
  const save = async (asNew = false) => {
    if (!workingInputs || !baseline || workspaceQuery.isFetching) return;
    let inputs = workingInputs;
    const currentSaved = asNew ? null : saved;
    if (asNew || !currentSaved) {
      const proposed = window.prompt(
        c.createName,
        asNew ? `${workingInputs.caseName} copy` : workingInputs.caseName
      );
      if (proposed === null) return;
      const trimmed = proposed.trim();
      if (!trimmed) {
        toast.error(c.caseName);
        return;
      }
      inputs = { ...workingInputs, caseName: trimmed };
      setWorkingInputs(inputs);
    }
    try {
      const payload = await saveMutation.mutateAsync(
        currentSaved
          ? {
              projectId: 1,
              caseId: currentSaved.id,
              expectedRevision: currentSaved.revision,
              inputs,
            }
          : { projectId: 1, inputs }
      );
      setWorkingInputs(payload.inputs);
      setPersistedInputs(payload.inputs);
      setBaseline(payload.baseline);
      const nextSaved = {
        id: payload.id,
        revision: payload.revision,
        updatedAt: payload.updatedAt,
      };
      setSaved(nextSaved);
      setIssuedResult(payload.result);
      setSelectedCaseId(payload.id);
      historyQuery.refetch();
      workspaceQuery.refetch();
      setCases(existing => {
        const without = existing.filter(item => item.id !== payload.id);
        return [
          {
            id: payload.id,
            caseName: payload.inputs.caseName,
            revision: payload.revision,
            updatedAt: payload.updatedAt,
          },
          ...without,
        ];
      });
      const params = new URLSearchParams({
        projectId: "1",
        caseId: String(payload.id),
      });
      navigate(`/majan-finance?${params.toString()}`);
      toast.success(currentSaved ? c.updated : c.created);
    } catch (error: any) {
      const message = String(error?.message || error || "");
      if (/conflict/i.test(message)) toast.error(c.conflict);
      else toast.error(message || c.error);
    }
  };
  const buildHtml = () =>
    workingInputs && baseline && result
      ? buildMajanReportHtml(workingInputs, baseline, result, locale, {
          revision: saved?.revision,
          savedAt: saved?.updatedAt,
          saved: Boolean(saved && !dirty),
        })
      : "";
  const printReport = () => {
    // Deliberately synchronous in the user-click handler: avoids popup blocking.
    const printWindow = window.open(
      "",
      "majan-finance-print",
      "width=1280,height=900"
    );
    if (!printWindow) {
      toast.error(c.printBlocked);
      return;
    }
    printWindow.opener = null;
    printWindow.onload = () => window.setTimeout(() => printWindow.print(), 80);
    printWindow.document.open();
    printWindow.document.write(buildHtml());
    printWindow.document.close();
    printWindow.focus();
  };
  const downloadHtml = () =>
    downloadText(
      `majan-finance-discussion-${locale}.html`,
      buildHtml(),
      "text/html;charset=utf-8"
    );
  const downloadCsv = () => result &&
    downloadText(
      `majan-finance-cashflow-${locale}.csv`,
      `\uFEFF${buildMajanCashFlowCsv(result, locale)}`,
      "text/csv;charset=utf-8"
    );
  const downloadExcel = async () => {
    if (!workingInputs || !baseline || !result) return;
    setExportingWorkbook(true);
    try {
      const [workbook, xlsxModule] = await Promise.all([
        buildMajanWorkbook(workingInputs, baseline, result, locale, {
          revision: saved?.revision,
          savedAt: saved?.updatedAt,
          saved: Boolean(saved && !dirty),
        }),
        import("xlsx-js-style"),
      ]);
      const XLSX = xlsxModule.default || xlsxModule;
      XLSX.writeFile(workbook, `majan-finance-discussion-${locale}.xlsx`, {
        compression: true,
      });
    } catch (error: any) {
      toast.error(String(error?.message || error || c.error));
    } finally {
      setExportingWorkbook(false);
    }
  };
  const goBack = () => {
    if (dirty && !window.confirm(c.unsaved)) return;
    navigate("/bateekha?projectId=1");
  };

  if ((workspaceQuery.isLoading && !skipFirstLoad.current) || (workspaceQuery.isFetching && selectedCaseId !== saved?.id))
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8f7] text-[15px] text-teal-900">
        {c.loading}
      </div>
    );
  if (loadError && !workspaceQuery.data)
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 bg-[#f5f8f7] p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">{c.error}</h1>
        <p className="text-sm text-slate-600">{loadError}</p>
        <button
          type="button"
          onClick={reload}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-bold text-white"
        >
          {c.reload}
        </button>
      </main>
    );
  if (!workingInputs || !persistedInputs || !baseline || !result)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8f7] text-[15px] text-teal-900">
        {c.loading}
      </div>
    );

  return (
    <main
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`min-h-screen bg-[#f5f8f7] text-slate-900 ${embedded ? "" : ""}`}
    >
      <header className="sticky top-0 z-40 border-b border-[#d5e3df] bg-[#123e38]/[.98] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-2 text-[13px] font-bold transition hover:bg-white/10"
          >
            {locale === "ar" ? (
              <ArrowRight className="h-4 w-4" />
            ) : (
              <ArrowLeft className="h-4 w-4" />
            )}
            {c.back}
          </button>
          <span className="hidden h-6 w-px bg-white/20 sm:block" />
          <div className="min-w-48 flex-1">
            <h1 className="text-[18px] font-bold">{c.title}</h1>
            <p className="mt-0.5 text-[13px] leading-5 text-teal-50">
              {c.subtitle}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${dirty || !saved ? "bg-amber-100 text-amber-950" : "bg-teal-100 text-teal-950"}`}
          >
            {dirty || !saved ? c.draft : c.saved}
          </span>
          <button
            type="button"
            onClick={changeLocale}
            className="rounded-md border border-white/25 px-3 py-2 text-[13px] font-bold hover:bg-white/10"
          >
            {c.language}
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1680px] gap-5 p-4 sm:p-6 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-[#d5e3df] bg-white p-3 shadow-sm lg:sticky lg:top-[86px]">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {c.scenario}
          </p>
          <div className="grid gap-1">
            <button
              type="button"
              onClick={() => setView("inputs")}
              className={`rounded-md px-3 py-2.5 text-start text-[13px] font-bold ${view === "inputs" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}
            >
              {c.inputs}
            </button>
            <button
              type="button"
              onClick={() => setView("reports")}
              className={`rounded-md px-3 py-2.5 text-start text-[13px] font-bold ${view === "reports" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}
            >
              {c.reports}
            </button>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="mb-1 block px-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {c.cases}
            </label>
            <select
              aria-label={c.selectCase}
              value={selectedCaseId || "preview"}
              onChange={event =>
                switchCase(
                  event.target.value === "preview"
                    ? undefined
                    : Number(event.target.value)
                )
              }
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-800"
            >
              <option value="preview">{c.noCase}</option>
              {cases.map(item => (
                <option key={item.id} value={item.id}>
                  {item.caseName} · r{item.revision}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={startNewScenario}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {c.newCase}
            </button>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {c.source}
            </p>
            <p className="px-2 pt-1 text-[11px] leading-4 text-slate-600">
              {c.sourceDescription}
            </p>
            <p className="mt-2 rounded bg-slate-50 px-2 py-1 font-mono text-[9px] text-slate-500">
              {baseline.sourceHash.slice(0, 18)}…
            </p>
          </div>
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d5e3df] bg-white p-3 shadow-sm">
            <div>
              <p className="text-[14px] font-bold text-slate-800">
                {workingInputs.caseName}
              </p>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {saved
                  ? `${c.savedAt}: ${formatDubaiTimestamp(saved.updatedAt, locale)} · r${saved.revision}`
                  : c.noCase}{" "}
                · {workingInputs.finance.enabled ? c.indicative : c.noFinance}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={(!dirty && saved !== null) || saveMutation.isPending || workspaceQuery.isFetching}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-[13px] font-bold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? c.saving : c.save}
              </button>
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saveMutation.isPending || workspaceQuery.isFetching}
                className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-white px-3 py-2 text-[13px] font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {c.saveAs}
              </button>
              {view === "reports" && (
                <>
                  <button
                    type="button"
                    onClick={printReport}
                    title={c.printHint}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {c.print}
                  </button>
                  <button
                    type="button"
                    onClick={downloadExcel}
                    disabled={exportingWorkbook}
                    title={c.excelHint}
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {exportingWorkbook ? c.exporting : c.excel}
                  </button>
                  <button
                    type="button"
                    onClick={downloadHtml}
                    title={c.exportHint}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {c.html}
                  </button>
                  <button
                    type="button"
                    onClick={downloadCsv}
                    title={c.exportHint}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {c.csv}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={reload}
                disabled={workspaceQuery.isFetching}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${workspaceQuery.isFetching ? "animate-spin" : ""}`}
                />
                {c.reload}
              </button>
            </div>
          </div>
          {selectedCaseId !== undefined && historyQuery.data && (
            <div className="mb-4 rounded-xl border border-[#d5e3df] bg-white p-3 shadow-sm">
              <p className="mb-2 text-[13px] font-bold text-slate-800">{c.history}</p>
              <div className="flex flex-wrap gap-2">
                {historyQuery.data.map(entry => (
                  <button
                    key={entry.revision}
                    type="button"
                    onClick={() => {
                      if (dirty && !window.confirm(c.unsaved)) return;
                      setWorkingInputs(entry.inputs);
                      toast.success(c.revisionLoaded);
                    }}
                    className="rounded-md border border-slate-200 px-2.5 py-2 text-left text-[12px] text-slate-700 hover:bg-teal-50"
                    title={`${entry.inputHash} · ${formatDubaiTimestamp(entry.createdAt, locale)}`}
                  >
                    <span className="block font-bold">r{entry.revision}</span>
                    <span className="block text-slate-500">{formatDubaiTimestamp(entry.createdAt, locale)}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{entry.inputHash.slice(0, 12)}…</span>
                    <span className="mt-1 block text-teal-800">{c.loadRevision}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {errors > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[14px] leading-5 text-amber-900">
              {c.validation}
            </div>
          )}
          {view === "inputs" ? (
            <MajanInputsPanel
              inputs={workingInputs}
              baseline={baseline}
              locale={locale}
              onChange={setWorkingInputs}
            />
          ) : (
            <MajanReportsPanel
              inputs={workingInputs}
              baseline={baseline}
              result={result}
              locale={locale}
              isSaved={!dirty && Boolean(saved)}
              revision={saved?.revision}
            />
          )}
        </section>
      </div>
    </main>
  );
}
