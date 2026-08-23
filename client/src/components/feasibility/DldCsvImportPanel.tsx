import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { default as FileSpreadsheet } from "lucide-react/dist/esm/icons/file-spreadsheet.js";
import { default as Upload } from "lucide-react/dist/esm/icons/upload.js";
import { default as XCircle } from "lucide-react/dist/esm/icons/x-circle.js";
import { toast } from "sonner";

type DldTransaction = {
  transactionNumber: string;
  transactionDate: string;
  community: string;
  projectName?: string;
  masterProject?: string;
  assetClass: "residential" | "retail" | "office" | "mixed_use" | "land" | "other";
  productForm: "apartment" | "villa" | "townhouse" | "plot" | "retail_unit" | "office_unit" | "mixed_use_unit" | "other";
  developmentStatus: "offplan" | "ready" | "any";
  unitType?: string;
  unitAreaSqft?: number;
  transactionValue?: number;
  pricePerSqft?: number;
};

const normal = (value: unknown) => String(value ?? "").trim().toLowerCase();
const numberValue = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) { row.push(cell.trim()); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = ""; continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function isoDldDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

function dldClassification(row: Record<string, string>) {
  const propertyType = normal(row["Property Type"]);
  const propertySubType = normal(row["Property Sub Type"]);
  const usage = normal(row["Usage"]);
  const descriptor = `${propertyType} ${propertySubType}`;
  if (descriptor.includes("land")) return { assetClass: "land" as const, productForm: "plot" as const };
  if (descriptor.includes("villa")) return { assetClass: "residential" as const, productForm: "villa" as const };
  if (descriptor.includes("townhouse")) return { assetClass: "residential" as const, productForm: "townhouse" as const };
  if (descriptor.includes("office") || usage.includes("office")) return { assetClass: "office" as const, productForm: "office_unit" as const };
  if (descriptor.includes("shop") || descriptor.includes("retail") || usage.includes("commercial")) return { assetClass: "retail" as const, productForm: "retail_unit" as const };
  if (descriptor.includes("mixed") || usage.includes("mixed")) return { assetClass: "mixed_use" as const, productForm: "mixed_use_unit" as const };
  if (descriptor.includes("apartment") || descriptor.includes("flat") || usage.includes("residential") || propertyType === "unit") return { assetClass: "residential" as const, productForm: "apartment" as const };
  return { assetClass: "other" as const, productForm: "other" as const };
}

function mapDldRow(row: Record<string, string>): DldTransaction | null {
  const transactionNumber = row["Transaction Number"]?.trim();
  const transactionDate = isoDldDate(row["Transaction Date"]);
  const community = row["Area"]?.trim();
  const transactionType = normal(row["Transaction Type"]);
  if (!transactionNumber || !transactionDate || !community || (transactionType && !transactionType.includes("sale"))) return null;
  const sqm = numberValue(row["Transaction Size (sq.m)"]) || numberValue(row["Property Size (sq.m)"]);
  const unitAreaSqft = sqm ? Math.round(sqm * 10.7639) : undefined;
  const transactionValue = numberValue(row["Amount"]);
  const { assetClass, productForm } = dldClassification(row);
  return {
    transactionNumber, transactionDate, community,
    projectName: row["Project"]?.trim(), masterProject: row["Master Project"]?.trim(),
    assetClass, productForm,
    developmentStatus: normal(row["Registration type"]).includes("off") ? "offplan" : "ready",
    unitType: row["Room(s)"]?.trim(), unitAreaSqft, transactionValue,
    pricePerSqft: transactionValue && unitAreaSqft ? Math.round(transactionValue / unitAreaSqft) : undefined,
  };
}

export default function DldCsvImportPanel({ projectId, onImported }: { projectId: number; onImported: () => void }) {
  const [transactions, setTransactions] = useState<DldTransaction[]>([]);
  const [fileName, setFileName] = useState("");
  const previewQuery = trpc.marketEvidence.previewDldImport.useQuery({ projectId, transactions }, { enabled: transactions.length > 0 });
  const importMutation = trpc.marketEvidence.importDldTransactions.useMutation({
    onSuccess: (result) => {
      toast.success(`تم إدراج ${result.imported} معاملة متوافقة؛ واستبعاد ${result.excluded} صفًا غير مطابق.`);
      setTransactions([]); setFileName(""); onImported();
    },
    onError: (error) => toast.error(error.message),
  });

  const parseSummary = useMemo(() => transactions.length ? `${transactions.length.toLocaleString("en-US")} صف معاملة صالح للمعاينة` : "نزّل CSV من DLD بعد اختيار فلاترها، ثم ارفعه هنا.", [transactions.length]);
  const chooseFile = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const parsed = rows.map(mapDldRow).filter((row): row is DldTransaction => Boolean(row)).slice(0, 2000);
    if (!parsed.length) { toast.error("لم أجد معاملات بيع صالحة في CSV. تأكد من أعمدة DLD وتاريخ المعاملة والمنطقة."); return; }
    if (rows.length - 1 > 2000) toast.message("عُرض أول 2,000 صف فقط للمعاينة والحفظ.");
    setTransactions(parsed); setFileName(file.name);
  };
  const preview = previewQuery.data;

  return <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div className="flex gap-2.5"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-700 text-white"><FileSpreadsheet className="h-4.5 w-4.5" /></div><div><h4 className="text-sm font-bold text-slate-900">إدراج معاملات DLD جماعيًا</h4><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">ابدأ في DLD بتحديد البيع والمنطقة ونوع العقار والتسجيل، ثم نزّل CSV. يعاين النظام فقط النتائج التي توافق بطاقة سوق هذا المشروع.</p></div></div><label className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-sky-700 px-3 text-xs font-semibold text-white hover:bg-sky-800"><Upload className="h-3.5 w-3.5" />اختيار CSV<input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => chooseFile(event.target.files?.[0])} /></label></div>
    <p className="mt-3 text-xs font-medium text-sky-900">{fileName ? `${fileName} · ${parseSummary}` : parseSummary}</p>
    {previewQuery.isFetching && <p className="mt-2 text-xs text-slate-500">يجري اختبار الصفوف على فلترة السوق…</p>}
    {preview && <div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="متوافق مع السوق" value={preview.compatible} tone="emerald" /><Metric label="خارج الفلترة" value={preview.excluded} tone="rose" /><Metric label="إجمالي المعاينة" value={preview.total} tone="slate" /></div>}
    {preview && preview.excluded > 0 && <p className="mt-2 text-xs text-rose-800">لن تُوثق الصفوف غير المطابقة؛ تُحفظ كمستبعدة مع سبب الاستبعاد لتبقى المراجعة شفافة.</p>}
    {preview && <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setTransactions([]); setFileName(""); }}>إلغاء الملف</Button><Button size="sm" className="bg-sky-700 hover:bg-sky-800" disabled={importMutation.isPending || preview.compatible === 0} onClick={() => importMutation.mutate({ projectId, transactions })}>إدراج المعاملات المتوافقة</Button></div>}
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" | "slate" }) {
  const styles = { emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", rose: "border-rose-200 bg-rose-50 text-rose-800", slate: "border-slate-200 bg-white text-slate-700" };
  return <div className={`rounded-lg border px-3 py-2 ${styles[tone]}`}><p className="text-[11px] font-medium">{label}</p><p className="mt-0.5 text-lg font-extrabold">{value.toLocaleString("en-US")}</p></div>;
}
