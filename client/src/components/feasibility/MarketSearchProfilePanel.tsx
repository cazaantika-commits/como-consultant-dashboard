import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { default as Filter } from "lucide-react/dist/esm/icons/list-filter.js";
import { default as MapPin } from "lucide-react/dist/esm/icons/map-pin.js";
import { default as Pencil } from "lucide-react/dist/esm/icons/pencil.js";
import { default as SearchCheck } from "lucide-react/dist/esm/icons/search-check.js";
import { toast } from "sonner";

type SearchProfileForm = {
  transactionPurpose: "sale" | "rent";
  evidenceMode: "active_listing" | "closed_transaction" | "new_project" | "market_report" | "mixed";
  assetClass: "residential" | "retail" | "office" | "mixed_use" | "land" | "other";
  productForm: "apartment" | "villa" | "townhouse" | "plot" | "retail_unit" | "office_unit" | "mixed_use_unit" | "other";
  unitTypesText: string;
  primaryCommunity: string;
  alternativeCommunitiesText: string;
  developmentStatus: "offplan" | "ready" | "any";
  minAreaSqft: string;
  maxAreaSqft: string;
  minPricePerSqft: string;
  maxPricePerSqft: string;
  transactionDateFrom: string;
  transactionDateTo: string;
};

const EMPTY: SearchProfileForm = {
  transactionPurpose: "sale", evidenceMode: "closed_transaction", assetClass: "residential", productForm: "apartment", unitTypesText: "",
  primaryCommunity: "", alternativeCommunitiesText: "", developmentStatus: "any", minAreaSqft: "", maxAreaSqft: "", minPricePerSqft: "", maxPricePerSqft: "", transactionDateFrom: "", transactionDateTo: "",
};

const LABELS = {
  transactionPurpose: { sale: "بيع", rent: "إيجار" },
  evidenceMode: { active_listing: "عروض قائمة", closed_transaction: "معاملات مكتملة", new_project: "مشاريع جديدة", market_report: "تقارير سوق", mixed: "مزيج من الأدلة" },
  assetClass: { residential: "سكني", retail: "تجاري", office: "مكاتب", mixed_use: "متعدد الاستخدام", land: "أرض", other: "أخرى" },
  productForm: { apartment: "شقق", villa: "فلل", townhouse: "تاون هاوس", plot: "أراضٍ", retail_unit: "وحدات تجارية", office_unit: "وحدات مكتبية", mixed_use_unit: "وحدة متعددة الاستخدام", other: "أخرى" },
  developmentStatus: { offplan: "أوف بلان", ready: "جاهز", any: "أي حالة" },
};

const toList = (text: string) => text.split(",").map((item) => item.trim()).filter(Boolean);
const fromJson = (value?: string | null) => { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.join(", ") : ""; } catch { return ""; } };
const numberOrUndefined = (value: string) => { const parsed = Number(value.replaceAll(",", "")); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; };

function profileToForm(profile: any, project: any): SearchProfileForm {
  if (!profile) return { ...EMPTY, primaryCommunity: project?.community || "" };
  return {
    transactionPurpose: profile.transactionPurpose, evidenceMode: profile.evidenceMode, assetClass: profile.assetClass, productForm: profile.productForm,
    unitTypesText: fromJson(profile.unitTypesJson), primaryCommunity: profile.primaryCommunity, alternativeCommunitiesText: fromJson(profile.alternativeCommunitiesJson),
    developmentStatus: profile.developmentStatus, minAreaSqft: profile.minAreaSqft || "", maxAreaSqft: profile.maxAreaSqft || "", minPricePerSqft: profile.minPricePerSqft || "", maxPricePerSqft: profile.maxPricePerSqft || "",
    transactionDateFrom: profile.transactionDateFrom || "", transactionDateTo: profile.transactionDateTo || "",
  };
}

export default function MarketSearchProfilePanel({ projectId, project }: { projectId: number; project: any }) {
  const utils = trpc.useUtils();
  const profileQuery = trpc.marketEvidence.getSearchProfile.useQuery({ projectId }, { enabled: !!projectId });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SearchProfileForm>(EMPTY);

  useEffect(() => {
    if (!profileQuery.isLoading) setForm(profileToForm(profileQuery.data, project));
  }, [profileQuery.data, profileQuery.isLoading, project]);

  const save = trpc.marketEvidence.saveSearchProfile.useMutation({
    onSuccess: () => {
      toast.success("حُفظت فلترة سوق المقارنة. ستُقبل المقارنات المطابقة فقط.");
      setEditing(false);
      utils.marketEvidence.getSearchProfile.invalidate({ projectId });
      utils.marketEvidence.getProjectEvidence.invalidate({ projectId });
    },
    onError: (error) => toast.error(error.message),
  });

  const profile = profileQuery.data as any;
  const summary = useMemo(() => {
    if (!profile) return [];
    const communities = [profile.primaryCommunity, ...fromJson(profile.alternativeCommunitiesJson).split(",").map((item) => item.trim()).filter(Boolean)];
    return [
      `${LABELS.transactionPurpose[profile.transactionPurpose as "sale" | "rent"]} · ${LABELS.evidenceMode[profile.evidenceMode as keyof typeof LABELS.evidenceMode]}`,
      `${LABELS.assetClass[profile.assetClass as keyof typeof LABELS.assetClass]} · ${LABELS.productForm[profile.productForm as keyof typeof LABELS.productForm]}`,
      communities.join("، "),
      LABELS.developmentStatus[profile.developmentStatus as keyof typeof LABELS.developmentStatus],
    ].filter(Boolean);
  }, [profile]);

  const setField = <K extends keyof SearchProfileForm>(key: K, value: SearchProfileForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate({
      projectId, transactionPurpose: form.transactionPurpose, evidenceMode: form.evidenceMode, assetClass: form.assetClass, productForm: form.productForm,
      unitTypes: toList(form.unitTypesText), primaryCommunity: form.primaryCommunity, alternativeCommunities: toList(form.alternativeCommunitiesText), developmentStatus: form.developmentStatus,
      minAreaSqft: numberOrUndefined(form.minAreaSqft), maxAreaSqft: numberOrUndefined(form.maxAreaSqft), minPricePerSqft: numberOrUndefined(form.minPricePerSqft), maxPricePerSqft: numberOrUndefined(form.maxPricePerSqft),
      transactionDateFrom: form.transactionDateFrom, transactionDateTo: form.transactionDateTo,
    });
  };

  return <Card className="border-sky-200 bg-gradient-to-l from-sky-50/65 via-white to-white shadow-sm">
    <CardContent className="p-5">
      <div className="flex flex-col justify-between gap-4 border-b border-sky-100 pb-4 lg:flex-row lg:items-start">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-700 text-white"><Filter className="h-5 w-5" /></div><div><p className="text-xs font-bold text-sky-700">قبل بدء البحث</p><h3 className="mt-1 font-bold text-slate-900">فلترة سوق المقارنة</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">هذه البطاقة تحدد بالضبط ما الذي نبحث عنه. لا يمكن توثيق فيلا أو أرض عند اختيار مقارنة شقق للبيع.</p></div></div>
        <Button size="sm" variant={profile ? "outline" : "default"} onClick={() => setEditing((value) => !value)} className={profile ? "gap-1.5 border-sky-300 text-sky-800" : "gap-1.5 bg-sky-700 hover:bg-sky-800"}>{profile ? <Pencil className="h-3.5 w-3.5" /> : <SearchCheck className="h-3.5 w-3.5" />}{profile ? "تعديل الفلترة" : "تحديد سوق المقارنة"}</Button>
      </div>

      {profile && !editing && <div className="mt-4 grid gap-2 md:grid-cols-4">{summary.map((item) => <div key={item} className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-slate-700">{item}</div>)}{profile.unitTypesJson && <div className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs text-slate-600"><span className="font-bold text-slate-800">الوحدات: </span>{fromJson(profile.unitTypesJson)}</div>}<div className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><MapPin className="h-3.5 w-3.5" />المقارنات خارج النطاق تُستبعد تلقائيًا</div></div>}

      {!profile && !editing && <div className="mt-4 rounded-xl border border-dashed border-sky-200 bg-white px-4 py-5 text-center"><p className="text-sm font-bold text-slate-800">لم تُحدد فلترة السوق بعد</p><p className="mt-1 text-xs text-slate-500">حدد المنتج والموقع والحالة أولًا، ثم أضف المقارنات أو ابدأ البحث.</p></div>}

      {editing && <form onSubmit={submit} className="mt-4 rounded-2xl border border-sky-200 bg-white p-4">
        <div className="mb-3"><h4 className="text-sm font-bold text-slate-900">ما الذي نبحث عنه تحديدًا؟</h4><p className="mt-0.5 text-xs text-slate-500">اتبع التسلسل: الغرض، نوع المنتج، النطاق الجغرافي، الحالة، ثم النطاقات المالية والزمنية.</p></div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="الغرض"><Select value={form.transactionPurpose} onChange={(value) => setField("transactionPurpose", value as SearchProfileForm["transactionPurpose"])} options={[["sale", "بيع"], ["rent", "إيجار"]]} /></Field>
          <Field label="نوع الدليل المطلوب"><Select value={form.evidenceMode} onChange={(value) => setField("evidenceMode", value as SearchProfileForm["evidenceMode"])} options={[["closed_transaction", "معاملات مكتملة"], ["active_listing", "عروض قائمة"], ["new_project", "مشاريع جديدة"], ["market_report", "تقارير سوق"], ["mixed", "مزيج من الأدلة"]]} /></Field>
          <Field label="فئة الأصل"><Select value={form.assetClass} onChange={(value) => setField("assetClass", value as SearchProfileForm["assetClass"])} options={[["residential", "سكني"], ["retail", "تجاري"], ["office", "مكاتب"], ["mixed_use", "متعدد الاستخدام"], ["land", "أرض"], ["other", "أخرى"]]} /></Field>
          <Field label="شكل المنتج"><Select value={form.productForm} onChange={(value) => setField("productForm", value as SearchProfileForm["productForm"])} options={[["apartment", "شقق"], ["villa", "فلل"], ["townhouse", "تاون هاوس"], ["plot", "أراضٍ"], ["retail_unit", "وحدات تجارية"], ["office_unit", "وحدات مكتبية"], ["mixed_use_unit", "وحدة متعددة الاستخدام"], ["other", "أخرى"]]} /></Field>
          <Field label="المجتمع الأساسي *"><input required value={form.primaryCommunity} onChange={(event) => setField("primaryCommunity", event.target.value)} className="field" placeholder="مثال: ند الشبا جاردينز" /></Field>
          <Field label="مجتمعات بديلة"><input value={form.alternativeCommunitiesText} onChange={(event) => setField("alternativeCommunitiesText", event.target.value)} className="field" placeholder="افصل بفاصلة: مجان، دبي لاند" /></Field>
          <Field label="حالة المشروع"><Select value={form.developmentStatus} onChange={(value) => setField("developmentStatus", value as SearchProfileForm["developmentStatus"])} options={[["offplan", "أوف بلان فقط"], ["ready", "جاهز فقط"], ["any", "أي حالة"]]} /></Field>
          <Field label="أنواع الوحدات"><input value={form.unitTypesText} onChange={(event) => setField("unitTypesText", event.target.value)} className="field" placeholder="مثال: استديو، غرفة وصالة" /></Field>
          <Field label="المساحة من قدم²"><input inputMode="decimal" value={form.minAreaSqft} onChange={(event) => setField("minAreaSqft", event.target.value)} className="field" /></Field>
          <Field label="المساحة إلى قدم²"><input inputMode="decimal" value={form.maxAreaSqft} onChange={(event) => setField("maxAreaSqft", event.target.value)} className="field" /></Field>
          <Field label="السعر من د.إ/قدم²"><input inputMode="decimal" value={form.minPricePerSqft} onChange={(event) => setField("minPricePerSqft", event.target.value)} className="field" /></Field>
          <Field label="السعر إلى د.إ/قدم²"><input inputMode="decimal" value={form.maxPricePerSqft} onChange={(event) => setField("maxPricePerSqft", event.target.value)} className="field" /></Field>
          <Field label="تاريخ المعاملة من"><input type="date" value={form.transactionDateFrom} onChange={(event) => setField("transactionDateFrom", event.target.value)} className="field" /></Field>
          <Field label="تاريخ المعاملة إلى"><input type="date" value={form.transactionDateTo} onChange={(event) => setField("transactionDateTo", event.target.value)} className="field" /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setForm(profileToForm(profile, project)); setEditing(false); }}>إلغاء</Button><Button type="submit" disabled={save.isPending} className="bg-sky-700 hover:bg-sky-800">حفظ فلترة المقارنة</Button></div>
      </form>}
    </CardContent>
  </Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-slate-600"><span className="mb-1 block">{label}</span>{children}</label>; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className="field">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>; }
