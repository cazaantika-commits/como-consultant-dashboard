import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { default as BadgeCheck } from "lucide-react/dist/esm/icons/badge-check.js";
import { default as CalendarClock } from "lucide-react/dist/esm/icons/calendar-clock.js";
import { default as Check } from "lucide-react/dist/esm/icons/check.js";
import { default as ExternalLink } from "lucide-react/dist/esm/icons/external-link.js";
import { default as FilePlus2 } from "lucide-react/dist/esm/icons/file-plus-2.js";
import { default as ShieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
import { default as X } from "lucide-react/dist/esm/icons/x.js";
import { toast } from "sonner";

type EvidenceForm = {
  evidenceType: "comparable" | "market_report" | "transaction" | "regulatory" | "assumption" | "other";
  transactionPurpose: "sale" | "rent";
  sourceType: "DLD" | "market_report" | "broker" | "developer" | "listing_portal" | "manual" | "other";
  sourceName: string;
  sourceUrl: string;
  sourceDate: string;
  confidenceGrade: "high" | "medium" | "low";
  comparableName: string;
  community: string;
  assetClass: "residential" | "retail" | "office" | "mixed_use" | "land" | "other";
  productForm: "apartment" | "villa" | "townhouse" | "plot" | "retail_unit" | "office_unit" | "mixed_use_unit" | "other";
  developmentStatus: "offplan" | "ready" | "any";
  unitType: string;
  unitAreaSqft: string;
  pricePerSqft: string;
  transactionValue: string;
  paymentPlanSummary: string;
  notes: string;
};

const EMPTY_FORM: EvidenceForm = {
  evidenceType: "comparable", transactionPurpose: "sale", sourceType: "DLD", sourceName: "", sourceUrl: "", sourceDate: "", confidenceGrade: "high",
  comparableName: "", community: "", assetClass: "residential", productForm: "apartment", developmentStatus: "any", unitType: "", unitAreaSqft: "", pricePerSqft: "", transactionValue: "", paymentPlanSummary: "", notes: "",
};

const STATUS_LABELS = { draft: "مسودة", verified: "موثّق", excluded: "مستبعد" };
const CONFIDENCE_LABELS = { high: "عالية", medium: "متوسطة", low: "منخفضة" };

function freshness(sourceDate?: string | null) {
  if (!sourceDate) return { label: "غير مؤرّخ", className: "bg-slate-100 text-slate-600" };
  const date = new Date(`${sourceDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { label: "تاريخ غير واضح", className: "bg-slate-100 text-slate-600" };
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 90) return { label: "حديث", className: "bg-emerald-100 text-emerald-800" };
  if (days <= 180) return { label: "يحتاج تحديثًا قريبًا", className: "bg-amber-100 text-amber-800" };
  return { label: "قديم ويحتاج مراجعة", className: "bg-rose-100 text-rose-800" };
}

function numberOrUndefined(value: string) {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default function MarketEvidencePanel({ projectId, decisionSnapshot }: { projectId: number; decisionSnapshot: Record<string, unknown> }) {
  const utils = trpc.useUtils();
  const evidenceQuery = trpc.marketEvidence.getProjectEvidence.useQuery({ projectId }, { enabled: !!projectId });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<EvidenceForm>(EMPTY_FORM);
  const [notes, setNotes] = useState("");
  const evidence = evidenceQuery.data?.evidence || [];
  const approvals = evidenceQuery.data?.approvals || [];
  const profile = evidenceQuery.data?.profile as any;
  const verifiedCount = evidence.filter((item: any) => item.verificationStatus === "verified").length;

  const refresh = () => utils.marketEvidence.getProjectEvidence.invalidate({ projectId });
  const addEvidence = trpc.marketEvidence.addEvidence.useMutation({ onSuccess: () => { toast.success("أضيف الدليل كسجل مسودة للمراجعة."); setForm(EMPTY_FORM); setAdding(false); refresh(); }, onError: (error) => toast.error(error.message) });
  const updateStatus = trpc.marketEvidence.setVerificationStatus.useMutation({ onSuccess: refresh, onError: (error) => toast.error(error.message) });
  const recordDecision = trpc.marketEvidence.recordDecision.useMutation({ onSuccess: (result, variables) => { toast.success(variables.decisionStatus === "approved" ? "تم توثيق اعتماد القرار. لم تُنقل أي قيمة إلى التسعير." : "تم توثيق مراجعة القرار."); setNotes(""); refresh(); }, onError: (error) => toast.error(error.message) });

  const submitEvidence = (event: React.FormEvent) => {
    event.preventDefault();
    addEvidence.mutate({
      projectId, evidenceType: form.evidenceType, transactionPurpose: form.transactionPurpose, sourceType: form.sourceType, sourceName: form.sourceName, sourceUrl: form.sourceUrl,
      sourceDate: form.sourceDate, confidenceGrade: form.confidenceGrade, comparableName: form.comparableName, community: form.community,
      assetClass: form.assetClass, productForm: form.productForm, developmentStatus: form.developmentStatus, unitType: form.unitType, unitAreaSqft: numberOrUndefined(form.unitAreaSqft), pricePerSqft: numberOrUndefined(form.pricePerSqft),
      transactionValue: numberOrUndefined(form.transactionValue), paymentPlanSummary: form.paymentPlanSummary, notes: form.notes,
    });
  };

  const setField = <K extends keyof EvidenceForm>(key: K, value: EvidenceForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const lastApproval = approvals[0] as any;

  return (
    <Card className="border-violet-200 bg-gradient-to-l from-violet-50/45 via-white to-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-white"><BadgeCheck className="h-5 w-5" /></div>
            <div><p className="text-xs font-bold text-violet-700">دليل قرار السوق</p><h3 className="mt-1 font-bold text-slate-900">سجل المقارنات والمصادر</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">كل مقارنة أو تقرير أو معاملة تسجل هنا بمصدرها وتاريخها ودرجة الثقة. لا تُستخدم أي خانة في التسعير تلقائيًا.</p></div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white px-2.5 py-1.5 font-bold text-slate-700 ring-1 ring-slate-200">{evidence.length} دليل</span><span className="rounded-full bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-800 ring-1 ring-emerald-200">{verifiedCount} موثّق</span><Button size="sm" disabled={!profile} onClick={() => { if (profile) { setForm((current) => ({ ...current, transactionPurpose: profile.transactionPurpose, assetClass: profile.assetClass, productForm: profile.productForm, developmentStatus: profile.developmentStatus })); setAdding((value) => !value); } }} className="h-7 gap-1.5 bg-violet-700 text-xs hover:bg-violet-800"><FilePlus2 className="h-3.5 w-3.5" />إضافة دليل</Button></div>
        </div>

        {adding && <form onSubmit={submitEvidence} className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-bold text-slate-900">إضافة مقارنة أو مصدر جديد</h4><p className="mt-0.5 text-xs text-slate-500">أدخل ما تملك من دليل فقط؛ لا حاجة لتعبئة كل الحقول.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button></div>
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">أدخل مواصفات الدليل الفعلية. إذا خالفت فلترة السوق، سيبقى السجل ظاهرًا لكنه يُستبعد تلقائيًا من المقارنات المعتمدة.</div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="اسم المصدر *"><input required value={form.sourceName} onChange={(e) => setField("sourceName", e.target.value)} className="field" placeholder="مثال: DLD أو تقرير سوق" /></Field>
            <Field label="تاريخ المصدر"><input type="date" value={form.sourceDate} onChange={(e) => setField("sourceDate", e.target.value)} className="field" /></Field>
            <Field label="نوع الدليل"><SelectField value={form.evidenceType} onChange={(value) => setField("evidenceType", value as EvidenceForm["evidenceType"])} options={[["comparable", "مقارنة"], ["market_report", "تقرير سوق"], ["transaction", "معاملة"], ["regulatory", "تنظيمي"], ["assumption", "افتراض"], ["other", "أخرى"]]} /></Field>
            <Field label="درجة الثقة"><SelectField value={form.confidenceGrade} onChange={(value) => setField("confidenceGrade", value as EvidenceForm["confidenceGrade"])} options={[["high", "عالية"], ["medium", "متوسطة"], ["low", "منخفضة"]]} /></Field>
            <Field label="اسم المقارنة / المشروع"><input value={form.comparableName} onChange={(e) => setField("comparableName", e.target.value)} className="field" placeholder="اسم المشروع المقارن" /></Field>
            <Field label="المنطقة"><input value={form.community} onChange={(e) => setField("community", e.target.value)} className="field" placeholder="مثال: مجان" /></Field>
            <Field label="نوع الأصل"><SelectField value={form.assetClass} onChange={(value) => setField("assetClass", value as EvidenceForm["assetClass"])} options={[["residential", "سكني"], ["retail", "تجاري"], ["office", "مكاتب"], ["mixed_use", "متعدد الاستخدام"], ["land", "أرض"], ["other", "أخرى"]]} /></Field>
            <Field label="شكل المنتج الفعلي"><SelectField value={form.productForm} onChange={(value) => setField("productForm", value as EvidenceForm["productForm"])} options={[["apartment", "شقق"], ["villa", "فلل"], ["townhouse", "تاون هاوس"], ["plot", "أرض"], ["retail_unit", "وحدة تجارية"], ["office_unit", "وحدة مكتبية"], ["mixed_use_unit", "متعدد الاستخدام"], ["other", "أخرى"]]} /></Field>
            <Field label="حالة المشروع"><SelectField value={form.developmentStatus} onChange={(value) => setField("developmentStatus", value as EvidenceForm["developmentStatus"])} options={[["offplan", "أوف بلان"], ["ready", "جاهز"], ["any", "غير محدد"]]} /></Field>
            <Field label="نوع الوحدة"><input value={form.unitType} onChange={(e) => setField("unitType", e.target.value)} className="field" placeholder="مثال: غرفة وصالة" /></Field>
            <Field label="المساحة قدم²"><input inputMode="decimal" value={form.unitAreaSqft} onChange={(e) => setField("unitAreaSqft", e.target.value)} className="field" /></Field>
            <Field label="السعر د.إ/قدم²"><input inputMode="decimal" value={form.pricePerSqft} onChange={(e) => setField("pricePerSqft", e.target.value)} className="field" /></Field>
            <Field label="قيمة المعاملة"><input inputMode="decimal" value={form.transactionValue} onChange={(e) => setField("transactionValue", e.target.value)} className="field" /></Field>
            <Field label="رابط المصدر"><input type="url" value={form.sourceUrl} onChange={(e) => setField("sourceUrl", e.target.value)} className="field" placeholder="https://" /></Field>
            <Field label="خلاصة خطة السداد" className="md:col-span-2"><input value={form.paymentPlanSummary} onChange={(e) => setField("paymentPlanSummary", e.target.value)} className="field" placeholder="الحجز / الإنشاء / التسليم" /></Field>
            <Field label="ملاحظات الدليل" className="md:col-span-2"><input value={form.notes} onChange={(e) => setField("notes", e.target.value)} className="field" placeholder="لماذا هذا الدليل مناسب أو ما حدوده؟" /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAdding(false)}>إلغاء</Button><Button type="submit" disabled={addEvidence.isPending} className="bg-violet-700 hover:bg-violet-800">حفظ كمسودة دليل</Button></div>
        </form>}

        {!profile && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">حدد فلترة سوق المقارنة أولًا؛ بعدها فقط يصبح إدخال الدليل وتوثيقه متاحين.</div>}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1.25fr_0.85fr_0.95fr_auto] gap-3 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500"><span>المقارنة أو المصدر</span><span>السعر / المساحة</span><span>الحداثة والثقة</span><span>الحالة</span></div>
          {evidenceQuery.isLoading ? <p className="px-3 py-6 text-center text-xs text-slate-500">يجري تحميل سجل الدليل…</p> : evidence.length === 0 ? <div className="px-4 py-8 text-center"><CalendarClock className="mx-auto mb-2 h-5 w-5 text-slate-300" /><p className="text-sm font-bold text-slate-700">لا يوجد دليل مسجل لهذا المشروع بعد</p><p className="mt-1 text-xs text-slate-500">ابدأ بمعاملة أو مقارنة موثقة أو تقرير سوق ذي تاريخ واضح.</p></div> : evidence.map((item: any) => { const age = freshness(item.sourceDate); return <div key={item.id} className="grid grid-cols-[1.25fr_0.85fr_0.95fr_auto] gap-3 border-t border-slate-100 px-3 py-3 text-xs text-slate-700"><div><p className="font-bold text-slate-900">{item.comparableName || item.sourceName}</p><p className="mt-1 text-slate-500">{item.sourceName}{item.community ? ` · ${item.community}` : ""}{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mr-1 inline-flex text-violet-700 hover:underline"><ExternalLink className="h-3 w-3" /></a>}</p>{!item.isCompatible && <p className="mt-1 text-[11px] leading-4 text-rose-700">مستبعد: {item.mismatchReasons?.[0]}</p>}</div><div><p className="font-bold">{item.pricePerSqft ? `${Math.round(Number(item.pricePerSqft)).toLocaleString("en-US")} د.إ/قدم²` : "—"}</p><p className="mt-1 text-slate-500">{item.unitAreaSqft ? `${Math.round(Number(item.unitAreaSqft)).toLocaleString("en-US")} قدم²` : item.unitType || "لا توجد مساحة"}</p></div><div className="flex flex-col items-start gap-1"><span className={`rounded-full px-2 py-0.5 font-bold ${age.className}`}>{age.label}</span><span className="text-slate-500">{item.sourceDate || "لا يوجد تاريخ"} · ثقة {CONFIDENCE_LABELS[item.confidenceGrade as keyof typeof CONFIDENCE_LABELS]}</span></div><div className="flex flex-col items-start gap-1.5"><span className={`rounded-full px-2 py-0.5 font-bold ${!item.isCompatible ? "bg-rose-100 text-rose-800" : item.verificationStatus === "verified" ? "bg-emerald-100 text-emerald-800" : item.verificationStatus === "excluded" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-800"}`}>{!item.isCompatible ? "خارج الفلترة" : STATUS_LABELS[item.verificationStatus as keyof typeof STATUS_LABELS]}</span>{item.verificationStatus === "draft" && item.isCompatible && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ evidenceId: item.id, projectId, verificationStatus: "verified" })} className="h-6 gap-1 border-emerald-300 px-2 text-[10px] text-emerald-800"><Check className="h-3 w-3" />توثيق</Button>}</div></div>; })}
        </div>

        <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/55 p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-700" /><h4 className="text-sm font-bold text-slate-900">مراجعة واعتماد القرار</h4></div><p className="mt-1 text-xs leading-5 text-slate-600">يحفظ الاعتماد لقطة من المسودة والأدلة الموثقة. لا ينقل أي سعر أو مزيج أو خطة سداد إلى صفحة التسعير في هذه المرحلة.</p>{lastApproval && <p className="mt-1.5 text-xs font-medium text-teal-800">آخر سجل: {lastApproval.decisionStatus === "approved" ? "معتمد" : lastApproval.decisionStatus === "reviewed" ? "تمت مراجعته" : "مرفوض"} · {new Date(lastApproval.decidedAt).toLocaleDateString("en-GB")}</p>}</div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" disabled={recordDecision.isPending} onClick={() => recordDecision.mutate({ projectId, decisionStatus: "reviewed", decisionSnapshot, notes })}>تسجيل مراجعة</Button><Button size="sm" disabled={recordDecision.isPending || verifiedCount === 0} onClick={() => recordDecision.mutate({ projectId, decisionStatus: "approved", decisionSnapshot, notes })} className="bg-teal-700 hover:bg-teal-800">اعتماد المسودة</Button></div></div><input value={notes} onChange={(event) => setNotes(event.target.value)} className="field mt-3 bg-white" placeholder="ملاحظة اختيارية تفسر المراجعة أو الاعتماد" />{verifiedCount === 0 && <p className="mt-2 text-xs text-amber-800">يلزم توثيق دليل واحد على الأقل قبل تفعيل «اعتماد المسودة».</p>}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block text-xs font-medium text-slate-600 ${className}`}><span className="mb-1 block">{label}</span>{children}</label>;
}

function SelectField({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="field">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
}
