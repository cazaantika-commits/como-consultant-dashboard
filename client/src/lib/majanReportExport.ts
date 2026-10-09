import type {
  MajanBaseline,
  MajanInputs,
  MajanLocale,
  MajanModelResult,
  ModelIssue,
  Provenance,
} from "@shared/majanFinanceTypes";
import { getMajanStabilisedYear } from "@shared/majanModel";

/** Browser-safe report and workbook exports for the Majan discussion model. */
const copy = {
  en: {
    language: "en", direction: "ltr",
    title: "Majan Commercial Center — Indicative Financial Discussion Report",
    subtitle: "Project 1 · Plot 6457956 · AED · Editable scenario",
    draft: "DRAFT / INDICATIVE — NOT BANK-APPROVED TERMS",
    purpose: "This calculation is an editable planning scenario for discussion. It is not a financing offer, credit approval, covenant, legal opinion, Shari'ah opinion, tax advice, construction certification, payment audit, or executed lease schedule.",
    generated: "Generated", version: "Model version", snapshot: "Input snapshot hash", horizon: "Report horizon", saved: "Save status", revision: "Revision", savedAt: "Saved at",
    assumptions: "Assumptions & status", sources: "Sources, lineage & limitations", checks: "Reconciliation checks", issues: "Issues and missing-input register", inputs: "Complete editable input audit", development: "Development — scenario programme", archived: "Archived baseline — original programme", leasing: "Leasing programme", operations: "Operating cash, collections & CFADS", finance: "Indicative finance overlay", annual: "Annual summary", operatingBridge: "Monthly operating CFADS bridge", financeBridge: "Monthly finance and owner bridge", sensitivity: "Sensitivity cases",
    metric: "Metric", value: "Value", source: "Source / rationale", status: "Status", period: "Period", floor: "Floor", category: "Use / category", gla: "GLA (sqft)", rent: "Annual rent (AED/sqft)", opening: "Opening month", occupancy: "Occupancy (initial / stable)", uses: "Development uses", billed: "Billed rent", collected: "Collected rent", opex: "Cash OPEX", recoveries: "Recoveries collected", cashNoi: "Cash NOI", cfads: "CFADS (pre-tax indicative)", draw: "Facility draw", service: "Debt service", balance: "Closing economic balance", dscr: "DSCR", owner: "Owner contribution", ownerDistribution: "Owner distribution",
    noFinance: "No finance", indicative: "Indicative finance", notCalculable: "Not calculable", na: "N/A", none: "None", pass: "Pass", fail: "Fail", pending: "Not calculable", recorded: "Recorded", assumption: "Draft assumption", contractual: "Contractual", issueCode: "Code", issueMessage: "Message", severity: "Severity",
    developmentCost: "Recorded development baseline", revisedDevelopment: "Scenario development cost", totalGla: "Grouped GLA", blendedRent: "Blended rent", peakOwner: "Peak owner funding", minDscr: "Minimum DSCR", financeStatus: "Finance case", tax: "Cash tax treatment",
    baselineNotice: "Archived baseline is retained separately. System-tagged paid amounts are not independent payment or owner-equity evidence.",
    legacyNotice: "The rejected legacy unit-count field is excluded. GFA, BUA and GLA remain distinct and are not substituted for one another.",
    sourceNotice: "Source-backed recommendations and market references are recommendations or explicitly activated draft assumptions. They are not rent-roll, valuation, lease, facility, covenant, payment, or tax evidence.",
    taxNotice: "Cash tax is shown only as an editable model input. A zero amount is a provisional pre-tax planning assumption, not a tax estimate or conclusion.",
    footer: "Majan financial discussion model · values in AED unless otherwise stated · figures shown are rounded for display only.",
  },
  ar: {
    language: "ar", direction: "rtl",
    title: "مركز ماجان التجاري — تقرير نقاش مالي تقديري",
    subtitle: "المشروع 1 · قطعة الأرض 6457956 · درهم إماراتي · سيناريو قابل للتعديل",
    draft: "مسودة / تقديري — ليست شروطًا مصرفية معتمدة",
    purpose: "هذا الحساب سيناريو تخطيطي قابل للتعديل للنقاش فقط. ولا يُعد عرض تمويل أو موافقة ائتمانية أو تعهدًا أو رأيًا قانونيًا أو شرعيًا أو ضريبيًا أو شهادة إنشاء أو تدقيق دفعات أو جدول إيجارات موقعًا.",
    generated: "تاريخ الإنشاء", version: "إصدار النموذج", snapshot: "تجزئة المدخلات", horizon: "أفق التقرير", saved: "حالة الحفظ", revision: "المراجعة", savedAt: "تاريخ الحفظ",
    assumptions: "الافتراضات والحالة", sources: "المصادر وتسلسل البيانات والقيود", checks: "اختبارات المطابقة", issues: "الملاحظات وسجل المدخلات الناقصة", inputs: "سجل المدخلات القابل للتعديل", development: "التطوير — برنامج السيناريو", archived: "الأساس المؤرشف — البرنامج الأصلي", leasing: "برنامج التأجير", operations: "النقد التشغيلي والتحصيل وCFADS", finance: "طبقة التمويل التقديرية", annual: "الملخص السنوي", operatingBridge: "جسر CFADS التشغيلي الشهري", financeBridge: "جسر التمويل والمالك الشهري", sensitivity: "حالات الحساسية",
    metric: "المؤشر", value: "القيمة", source: "المصدر / المبرر", status: "الحالة", period: "الفترة", floor: "الطابق", category: "الاستخدام / الفئة", gla: "المساحة التأجيرية (قدم²)", rent: "الإيجار السنوي (درهم/قدم²)", opening: "شهر الافتتاح", occupancy: "الإشغال (بداية / مستقر)", uses: "استخدامات التطوير", billed: "الإيجار المفوتر", collected: "الإيجار المحصل", opex: "التشغيل النقدي", recoveries: "المستردات المحصلة", cashNoi: "صافي الدخل التشغيلي النقدي", cfads: "CFADS تقديري قبل الضريبة", draw: "سحب التسهيل", service: "خدمة التمويل", balance: "الرصيد الاقتصادي الختامي", dscr: "نسبة تغطية خدمة الدين", owner: "مساهمة المالك", ownerDistribution: "توزيع المالك",
    noFinance: "دون تمويل", indicative: "تمويل تقديري", notCalculable: "غير قابل للحساب", na: "غير منطبق", none: "لا يوجد", pass: "مطابق", fail: "غير مطابق", pending: "غير قابل للحساب", recorded: "مسجل", assumption: "افتراض مسودة", contractual: "تعاقدي", issueCode: "الرمز", issueMessage: "الرسالة", severity: "الخطورة",
    developmentCost: "أساس تكلفة التطوير المسجل", revisedDevelopment: "تكلفة تطوير السيناريو", totalGla: "المساحة التأجيرية المجمعة", blendedRent: "متوسط الإيجار", peakOwner: "ذروة تمويل المالك", minDscr: "أدنى تغطية", financeStatus: "حالة التمويل", tax: "معالجة الضريبة النقدية",
    baselineNotice: "يتم الاحتفاظ بالأساس المؤرشف بشكل منفصل. والمبالغ الموسومة بالنظام كمدفوعة ليست دليل دفع مستقلًا أو دليل مساهمة مالك.",
    legacyNotice: "تم استبعاد حقل عدد الوحدات التاريخي المرفوض. وتبقى GFA وBUA وGLA تعريفات مستقلة لا تُستبدل ببعضها.",
    sourceNotice: "توصيات السوق والمراجع المدعومة بالمصدر هي توصيات أو افتراضات مسودة مفعلة صراحة. وليست دليل جدول إيجارات أو تقييم أو عقد إيجار أو تسهيل أو تعهد أو دفع أو ضريبة.",
    taxNotice: "تُعرض الضريبة النقدية كمدخل قابل للتعديل فقط. والقيمة الصفرية افتراض تخطيطي مؤقت قبل الضريبة وليست تقديرًا أو نتيجة ضريبية.",
    footer: "نموذج نقاش ماجان المالي · القيم بالدرهم الإماراتي ما لم يذكر خلاف ذلك · الأرقام مقربة للعرض فقط.",
  },
} as const;
type ReportCopy = (typeof copy)[MajanLocale];
export type MajanWorkbookMetadata = { revision?: number | null; savedAt?: string | null; saved?: boolean };
type SpreadsheetRow = Array<string | number | boolean | null>;
type AuditRow = { path: string; label: string; raw: string | number | boolean | null; source: Provenance };

function text(value: unknown): string { return String(value ?? ""); }
export function escapeMajanHtml(value: unknown): string { return text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
/** Protect spreadsheet consumers from formula injection while retaining numeric values as numeric text. */
export function escapeMajanCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : String(value);
  const protectedValue = typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(protectedValue) ? `"${protectedValue.replaceAll('"', '""')}"` : protectedValue;
}
function dateText(iso: string | null | undefined, locale: MajanLocale): string {
  if (!iso) return copy[locale].notCalculable;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dubai" }).format(parsed);
}
function money(value: number | null | undefined, locale: MajanLocale): string { return value === null || value === undefined || !Number.isFinite(value) ? copy[locale].notCalculable : new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", { maximumFractionDigits: 0 }).format(value); }
function number(value: number | null | undefined, locale: MajanLocale, digits = 1): string { return value === null || value === undefined || !Number.isFinite(value) ? copy[locale].notCalculable : new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", { maximumFractionDigits: digits }).format(value); }
function pct(value: number | null | undefined, locale: MajanLocale): string { return value === null || value === undefined || !Number.isFinite(value) ? copy[locale].notCalculable : `${number(value, locale, 1)}%`; }
function x(value: number | null | undefined, locale: MajanLocale): string { return value === null || value === undefined || !Number.isFinite(value) ? copy[locale].notCalculable : `${number(value, locale, 2)}x`; }
function dscr(value: number | null | undefined, payment: number | null | undefined, locale: MajanLocale): string { return payment !== null && payment !== undefined && Number.isFinite(payment) && Math.abs(payment) < 0.000001 ? copy[locale].na : x(value, locale); }
function statusLabel(status: Provenance["status"], c: ReportCopy): string { return status === "recorded" ? c.recorded : status === "contractual" ? c.contractual : c.assumption; }
function dedupeIssues(issues: ModelIssue[]): ModelIssue[] { const seen = new Set<string>(); return issues.filter(issue => { const key = `${issue.code}\u0000${issue.field}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function table(headers: string[], rows: string, label: string, className = ""): string {
  const render = (columns: number[], body: string) => `<div class="table-wrap ${className}"><table aria-label="${escapeMajanHtml(label)}"><thead><tr>${columns.map(index => `<th>${escapeMajanHtml(headers[index])}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
  if (headers.length <= 6 || rows.includes('colspan=')) return render(headers.map((_, index) => index), rows);
  const cells = [...rows.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(match => [...match[1].matchAll(/<td(?:\s[^>]*)?>[\s\S]*?<\/td>/g)].map(cell => cell[0]));
  const panels: string[] = [];
  for (let start = 1; start < headers.length; start += 5) {
    const columns = [0, ...Array.from({ length: Math.min(5, headers.length - start) }, (_, index) => start + index)];
    panels.push(render(columns, cells.map(row => `<tr>${columns.map(index => row[index] ?? '<td>—</td>').join('')}</tr>`).join('')));
  }
  return panels.join('');
}
function allSources(inputs: MajanInputs): Provenance[] { return [inputs.development.source, ...inputs.leasing.map(row => row.source), ...inputs.opex.map(row => row.source), inputs.operations.source, inputs.finance.source]; }
function fallbackSource(inputs: MajanInputs): Provenance { return { source: "Model-level editable scenario", asOf: inputs.asOf, status: "assumption", rationale: "No narrower source block applies." }; }
function prettyPath(path: string, locale: MajanLocale): string {
  const map: Record<string, [string, string]> = { schemaVersion: ["Schema version", "إصدار المخطط"], projectId: ["Project ID", "معرف المشروع"], plot: ["Plot", "قطعة الأرض"], caseName: ["Case name", "اسم الحالة"], asOf: ["As of", "حتى تاريخ"], horizonMonth: ["Report horizon", "أفق التقرير"], notes: ["Scenario notes", "ملاحظات السيناريو"], development: ["Development", "التطوير"], leasing: ["Leasing", "التأجير"], opex: ["Operating budget", "ميزانية التشغيل"], operations: ["Operations", "التشغيل"], finance: ["Finance", "التمويل"], eligibleCategories: ["Eligible categories", "فئات مؤهلة"], cashTaxAnnual: ["Cash tax annual", "الضريبة النقدية السنوية"], vatMode: ["VAT treatment", "معالجة ضريبة القيمة المضافة"] };
  return path.split(".").map(part => map[part]?.[locale === "ar" ? 1 : 0] ?? part).join(" › ");
}
function flattenInputs(inputs: MajanInputs, locale: MajanLocale): AuditRow[] {
  const rows: AuditRow[] = [];
  const visit = (value: unknown, path: string, source: Provenance) => {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") { rows.push({ path, label: prettyPath(path, locale), raw: value, source }); return; }
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}.${index}`, source)); return; }
    if (value && typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([key, item]) => { if (key !== "source") visit(item, path ? `${path}.${key}` : key, source); });
  };
  visit({ schemaVersion: inputs.schemaVersion, projectId: inputs.projectId, plot: inputs.plot, caseName: inputs.caseName, asOf: inputs.asOf, horizonMonth: inputs.horizonMonth, notes: inputs.notes }, "", fallbackSource(inputs));
  const { costOverrides, ...developmentWithoutOverrides } = inputs.development;
  visit(developmentWithoutOverrides, "development", inputs.development.source);
  costOverrides?.forEach((row, index) => visit(row, `development.costOverrides.${index}`, row.source));
  inputs.leasing.forEach((row, index) => visit(row, `leasing.${index}`, row.source));
  inputs.opex.forEach((row, index) => visit(row, `opex.${index}`, row.source));
  visit(inputs.operations, "operations", inputs.operations.source);
  visit(inputs.finance, "finance", inputs.finance.source);
  return rows;
}

/** Build a standalone printable HTML package from the canonical Majan DTO used by the UI. */
export function buildMajanReportHtml(inputs: MajanInputs, baseline: MajanBaseline, result: MajanModelResult, locale: MajanLocale, metadata: MajanWorkbookMetadata = {}): string {
  const c = copy[locale];
  const issues = dedupeIssues(result.issues);
  const stableYear = getMajanStabilisedYear(inputs);
  const stableAnnual = result.annual.find(row => row.year === stableYear) ?? null;
  const sourceRows = allSources(inputs).map(source => `<tr><td>${escapeMajanHtml(source.source)}</td><td>${escapeMajanHtml(source.asOf)}</td><td>${escapeMajanHtml(statusLabel(source.status, c))}</td><td>${escapeMajanHtml(source.rationale || c.none)}</td></tr>`).join("");
  const inputRows = flattenInputs(inputs, locale).map(row => `<tr><td>${escapeMajanHtml(row.path)}</td><td>${escapeMajanHtml(row.label)}</td><td>${escapeMajanHtml(row.raw === null ? "null" : String(row.raw))}</td><td>${escapeMajanHtml(row.source.source)}</td><td>${escapeMajanHtml(row.source.asOf)}</td><td>${escapeMajanHtml(statusLabel(row.source.status, c))}</td><td>${escapeMajanHtml(row.source.rationale || c.none)}</td></tr>`).join("");
  const baselineRows = baseline.rows.map(row => `<tr><td>${escapeMajanHtml(locale === "ar" ? row.nameAr : row.nameEn)}</td><td>${escapeMajanHtml(row.category)}</td><td>${money(row.total, locale)}</td><td>${money(row.taggedPaid, locale)}</td><td>${money(row.monthly.reduce((sum, value) => sum + value, 0), locale)}</td></tr>`).join("");
  const developmentRows = result.development.rows.map(row => `<tr><td>${escapeMajanHtml(locale === "ar" ? row.nameAr : row.nameEn)}</td><td>${escapeMajanHtml(row.category)}</td><td>${money(row.total, locale)}</td><td>${money(row.taggedPaid, locale)}</td><td>${money(row.monthly.reduce((sum, value) => sum + value, 0), locale)}</td></tr>`).join("");
  const leasingRows = inputs.leasing.map(row => `<tr><td>${escapeMajanHtml(`${row.floor} — ${locale === "ar" ? row.nameAr : row.nameEn}`)}</td><td>${escapeMajanHtml(locale === "ar" ? row.nameAr : row.nameEn)}</td><td>${escapeMajanHtml(row.treatment)}</td><td>${number(row.areaSqft, locale, 0)}</td><td>${money(row.annualRentPsf, locale)}</td><td>${escapeMajanHtml(row.rentRule)}</td><td>${money(row.annualSalesPsf, locale)}</td><td>${pct(row.turnoverPct, locale)}</td><td>${escapeMajanHtml(row.openingMonth)}</td><td>${pct(row.initialOccupancyPct, locale)} / ${pct(row.stabilisedOccupancyPct, locale)}</td><td>${number(row.rampMonths, locale, 0)}</td><td>${number(row.rentFreeMonths, locale, 0)}</td><td>${pct(row.escalationPct, locale)}</td><td>${pct(row.collectionPct, locale)}</td><td>${number(row.collectionLagMonths, locale, 0)}</td><td>${escapeMajanHtml(row.source.source)}</td></tr>`).join("");
  const opexRows = inputs.opex.map(row => `<tr><td>${escapeMajanHtml(locale === "ar" ? row.nameAr : row.nameEn)}</td><td>${escapeMajanHtml(row.mode)}</td><td>${money(row.value, locale)}</td><td>${pct(row.escalationPct, locale)}</td><td>${pct(row.recoverablePct, locale)}</td><td>${pct(row.recoveryCollectionPct, locale)}</td><td>${escapeMajanHtml(row.source.source)}</td></tr>`).join("");
  const annualRows = result.annual.map(row => `<tr><td>${escapeMajanHtml(row.year)}</td><td>${money(row.developmentUses, locale)}</td><td>${money(row.billedRent, locale)}</td><td>${money(row.collectedRent, locale)}</td><td>${money(row.opex, locale)}</td><td>${money(row.recoveries, locale)}</td><td>${money(row.cashNoi, locale)}</td><td>${money(row.cfads, locale)}</td><td>${money(row.draw, locale)}</td><td>${money(row.debtService, locale)}</td><td>${dscr(row.dscr, row.debtService, locale)}</td><td>${money(row.ownerContribution, locale)}</td><td>${money(row.ownerDistribution, locale)}</td></tr>`).join("");
  const operatingRows = result.leasing.months.map(row => `<tr><td>${escapeMajanHtml(row.period)}</td><td>${money(row.potentialRent, locale)}</td><td>${money(row.billedRent, locale)}</td><td>${money(row.openingAr, locale)}</td><td>${money(row.badDebt, locale)}</td><td>${money(row.collectedRent, locale)}</td><td>${money(row.closingAr, locale)}</td><td>${money(row.opex, locale)}</td><td>${money(row.serviceChargeBilled, locale)}</td><td>${money(row.serviceChargeCollected, locale)}</td><td>${money(row.cashNoi, locale)}</td><td>${money(row.capex, locale)}</td><td>${money(row.reserveDeposit, locale)}</td><td>${money(row.reserveRelease, locale)}</td><td>${money(row.restrictedCash, locale)}</td><td>${money(row.cashTax, locale)}</td><td>${money(row.otherIncome, locale)}</td><td>${money(row.cfads, locale)}</td></tr>`).join("");
  const financeRows = result.financing.months.map(row => `<tr><td>${escapeMajanHtml(row.period)}</td><td>${money(row.openingBalance, locale)}</td><td>${money(row.draw, locale)}</td><td>${money(row.profitCapitalised, locale)}</td><td>${money(row.profitPaid, locale)}</td><td>${money(row.capitalPaid, locale)}</td><td>${money(row.totalPayment, locale)}</td><td>${money(row.fee, locale)}</td><td>${money(row.dsraDeposit, locale)}</td><td>${money(row.dsraRelease, locale)}</td><td>${money(row.dsraBalance, locale)}</td><td>${money(row.closingBalance, locale)}</td><td>${dscr(row.dscr, row.totalPayment, locale)}</td><td>${money(row.unleveredNet, locale)}</td><td>${money(row.fundedNet, locale)}</td><td>${money(row.fundingGap, locale)}</td><td>${money(row.ownerContribution, locale)}</td><td>${money(row.ownerDistribution, locale)}</td><td>${money(row.cumulativeOwnerContribution, locale)}</td></tr>`).join("");
  const sensitivityRows = result.sensitivity.map(row => `<tr><td>${escapeMajanHtml(locale === "ar" ? row.nameAr : row.nameEn)}</td><td>${pct(row.rentChangePct, locale)}</td><td>${number(row.occupancyChangePp, locale, 1)}pp</td><td>${money(row.annualCfads, locale)}</td><td>${x(row.annualDscr, locale)}</td></tr>`).join("");
  const checkRows = result.checks.map(check => `<tr><td>${escapeMajanHtml(check.code)}</td><td><span class="check ${escapeMajanHtml(check.status)}">${escapeMajanHtml(check.status === "pass" ? c.pass : check.status === "fail" ? c.fail : c.pending)}</span></td><td>${escapeMajanHtml(locale === "ar" ? check.messageAr : check.messageEn)}</td><td>${check.difference === undefined ? "—" : money(check.difference, locale)}</td></tr>`).join("");
  const issueRows = issues.length ? issues.map(issue => `<tr><td>${escapeMajanHtml(issue.code)}</td><td>${escapeMajanHtml(issue.field)}</td><td>${escapeMajanHtml(locale === "ar" ? issue.messageAr : issue.messageEn)}</td><td><span class="issue ${escapeMajanHtml(issue.severity)}">${escapeMajanHtml(issue.severity)}</span></td></tr>`).join("") : `<tr><td colspan="4" class="muted">${escapeMajanHtml(c.none)}</td></tr>`;
  const financeStatus = inputs.finance.enabled ? c.indicative : c.noFinance;
  const stableNote = stableYear ? `${locale === "ar" ? "سنة الاستقرار الكاملة" : "First full stabilised year"}: ${stableYear}` : c.notCalculable;
  return `<!doctype html><html lang="${c.language}" dir="${c.direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMajanHtml(c.title)}</title><style>
:root{--teal:#0f766e;--ink:#15332f;--paper:#fffdf7;--line:#d7e2de;--muted:#5c6c68}*{box-sizing:border-box}body{margin:0;background:#eaf0ee;color:#162c28;font:14px/1.5 Arial,"Noto Naskh Arabic",sans-serif}.report{max-width:1440px;margin:24px auto;background:var(--paper);box-shadow:0 12px 45px #19362b22}.hero{padding:34px 42px;background:#123e38;color:#fff}.hero h1{font-size:25px;line-height:1.25;margin:0 0 8px}.hero p{margin:0;opacity:.88}.badge{display:inline-block;margin:18px 0 0;padding:6px 10px;border:1px solid #d7e2de77;border-radius:999px;background:#fff2;font-size:12px;font-weight:700}.purpose{margin:20px 42px;padding:13px 16px;background:#fff4d6;border-inline-start:4px solid #c88719;color:#694200}.meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin:0 42px}.meta div{padding:11px 13px;background:#fff}.meta b{display:block;font-size:11px;color:var(--muted)}section{padding:28px 42px;border-bottom:1px solid var(--line)}h2{margin:0 0 14px;color:var(--ink);font-size:19px}h3{margin:20px 0 9px;color:var(--teal);font-size:15px}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.metric{padding:13px;border:1px solid var(--line);border-radius:8px;background:#fff}.metric b{display:block;color:var(--muted);font-size:11px;font-weight:600}.metric strong{display:block;margin-top:3px;color:var(--ink);font-size:18px}.note{padding:10px 12px;background:#f1f7f4;border-inline-start:3px solid var(--teal);color:#3f5752}.table-wrap{overflow:auto;border:1px solid var(--line);margin-bottom:12px}table{border-collapse:collapse;width:100%;min-width:720px;background:#fff;font-size:11px}th,td{padding:7px 8px;text-align:start;vertical-align:top;border-bottom:1px solid #edf1ef;white-space:nowrap}td:nth-child(n+3){text-align:end}th{background:#e9f4f1;color:#164d46;font-weight:700}.muted{color:var(--muted)}.issue,.check{display:inline-block;border-radius:999px;padding:2px 7px;font-size:10px;font-weight:700}.error,.fail{color:#8d2118;background:#ffebe8}.warning{color:#825000;background:#fff4d4}.info,.pass{color:#126157;background:#dff5ee}.not_calculable{color:#4d5c59;background:#edf1ef}footer{padding:18px 42px;background:#edf4f1;color:#52635f;font-size:11px}@media print{@page{size:landscape;margin:9mm}body{background:#fff}.report{max-width:none;margin:0;box-shadow:none}.table-wrap{overflow:visible}.meta{margin:0 22px}.hero,section{padding:20px 22px}.purpose{margin:14px 22px}thead{display:table-header-group}tr{break-inside:avoid}footer{padding:12px 22px}}@media(max-width:720px){.hero,section{padding:22px 18px}.purpose,.meta{margin-inline:18px}.meta,.metrics{grid-template-columns:1fr 1fr}}
.metric,.meta{break-inside:avoid}table{min-width:0;table-layout:fixed;font-size:13px}th,td{white-space:normal;overflow-wrap:anywhere;text-align:start!important}.meta div{overflow-wrap:anywhere}section{break-inside:auto}@media print{.hero{padding:12px 22px}.hero h1{font-size:22px}.badge{margin-top:8px;padding:3px 8px}.purpose{margin-block:9px;font-size:11px}.meta div{padding:6px 9px;font-size:11px}.metric{padding:8px}.metric strong{font-size:16px}.metric span{font-size:11px}section{padding-block:14px}.supporting-detail{display:none}.table-wrap{max-width:100%;overflow:visible}table{width:100%}th,td{padding:5px 6px}.meta{grid-template-columns:repeat(4,minmax(0,1fr))}}
</style></head><body><main class="report"><header class="hero"><h1>${escapeMajanHtml(c.title)}</h1><p>${escapeMajanHtml(c.subtitle)}</p><span class="badge">${escapeMajanHtml(c.draft)}</span></header><p class="purpose">${escapeMajanHtml(c.purpose)}</p>
<div class="meta"><div><b>${escapeMajanHtml(c.generated)}</b>${escapeMajanHtml(dateText(result.generatedAt, locale))}</div><div><b>${escapeMajanHtml(c.version)}</b>${escapeMajanHtml(result.version)}</div><div><b>${escapeMajanHtml(c.snapshot)}</b>${escapeMajanHtml(result.inputHash)}</div><div><b>${escapeMajanHtml(c.horizon)}</b>${escapeMajanHtml(inputs.horizonMonth)}</div><div><b>${escapeMajanHtml(c.saved)}</b>${metadata.saved ? (locale === "ar" ? "محفوظ" : "Saved snapshot") : (locale === "ar" ? "مسودة غير محفوظة" : "Unsaved draft")}</div><div><b>${escapeMajanHtml(c.revision)}</b>${escapeMajanHtml(metadata.revision ? `r${metadata.revision}` : "—")}</div><div><b>${escapeMajanHtml(c.savedAt)}</b>${escapeMajanHtml(dateText(metadata.savedAt, locale))}</div><div><b>${escapeMajanHtml(c.financeStatus)}</b>${escapeMajanHtml(financeStatus)}</div></div>
<section><h2>${escapeMajanHtml(c.assumptions)}</h2><div class="metrics"><div class="metric"><b>${escapeMajanHtml(c.tax)}</b><strong>${money(inputs.operations.cashTaxAnnual, locale)}</strong></div><div class="metric"><b>${escapeMajanHtml(c.totalGla)}</b><strong>${number(result.leasing.totalGla, locale, 0)} sqft</strong></div><div class="metric"><b>${escapeMajanHtml(c.developmentCost)}</b><strong>${money(baseline.totalCost, locale)}</strong></div><div class="metric"><b>${escapeMajanHtml(c.revisedDevelopment)}</b><strong>${money(result.development.totalCost, locale)}</strong></div><div class="metric"><b>${escapeMajanHtml(c.peakOwner)}</b><strong>${money(result.financing.peakOwnerFunding, locale)}</strong></div><div class="metric"><b>${escapeMajanHtml(c.minDscr)}</b><strong>${inputs.finance.enabled ? x(result.financing.minDscr, locale) : c.na}</strong></div><div class="metric"><b>${escapeMajanHtml(c.cashNoi)}</b><strong>${money(stableAnnual?.cashNoi, locale)}</strong><span>${escapeMajanHtml(stableNote)}</span></div><div class="metric"><b>${escapeMajanHtml(c.cfads)}</b><strong>${money(stableAnnual?.cfads, locale)}</strong><span>${escapeMajanHtml(stableNote)}</span></div><div class="metric"><b>${escapeMajanHtml(c.blendedRent)}</b><strong>${money(result.leasing.blendedRentPsf, locale)}</strong></div><div class="metric"><b>${locale === "ar" ? "تغطية سنة الاستقرار" : "Stabilised DSCR"}</b><strong>${dscr(stableAnnual?.dscr, stableAnnual?.debtService, locale)}</strong><span>${escapeMajanHtml(stableNote)}</span></div><div class="metric"><b>${locale === "ar" ? "خدمة التمويل في سنة الاستقرار" : "Stabilised debt service"}</b><strong>${money(stableAnnual?.debtService, locale)}</strong></div><div class="metric"><b>${locale === "ar" ? "التغطية المستهدفة — افتراض قابل للتعديل" : "Target DSCR — editable assumption"}</b><strong>${inputs.finance.enabled ? x(inputs.finance.targetDscr, locale) : c.na}</strong></div></div></section>
<section><h2>${escapeMajanHtml(c.development)}</h2>${table([locale === "ar" ? "البند" : "Line item", c.category, locale === "ar" ? "الإجمالي" : "Total", locale === "ar" ? "موسوم مدفوع" : "Tagged paid", locale === "ar" ? "الجدول الشهري" : "Monthly scheduled"], developmentRows, c.development)}</section>
<section><h2>${escapeMajanHtml(c.leasing)}</h2><p class="note">${escapeMajanHtml(c.legacyNotice)}</p>${table([c.floor,c.category,locale === "ar" ? "المعالجة" : "Treatment",c.gla,c.rent,locale === "ar" ? "قاعدة الإيجار" : "Rent rule",locale === "ar" ? "مبيعات سنوية" : "Annual sales",locale === "ar" ? "دوران %" : "Turnover %",c.opening,c.occupancy,locale === "ar" ? "أشهر التدرج" : "Ramp months",locale === "ar" ? "أشهر الإعفاء" : "Rent-free months",locale === "ar" ? "تصعيد %" : "Escalation %",locale === "ar" ? "تحصيل %" : "Collection %",locale === "ar" ? "تأخر التحصيل" : "Collection lag",c.source], leasingRows || `<tr><td colspan="16" class="muted">${c.notCalculable}</td></tr>`, c.leasing)}</section>
<section><h2>${escapeMajanHtml(c.operations)}</h2>${table([locale === "ar" ? "البند" : "Line item",locale === "ar" ? "الطريقة" : "Mode",c.value,locale === "ar" ? "تصعيد %" : "Escalation %",locale === "ar" ? "استرداد %" : "Recoverable %",locale === "ar" ? "تحصيل الاسترداد %" : "Recovery collection %",c.source], opexRows, c.operations)}<p class="note">${escapeMajanHtml(`${c.taxNotice} VAT: ${inputs.operations.vatMode}; ${inputs.operations.taxRationale}`)}</p></section>
<section><h2>${escapeMajanHtml(c.finance)}</h2>${table([c.metric,c.value,c.source], [[locale === "ar" ? "مفعل" : "Enabled",String(inputs.finance.enabled),inputs.finance.source.source],[locale === "ar" ? "الحالة" : "Status",inputs.finance.status,inputs.finance.source.source],[locale === "ar" ? "الهيكل" : "Structure",inputs.finance.structure,inputs.finance.source.source],[locale === "ar" ? "الممول" : "Lender",inputs.finance.lender || c.none,inputs.finance.source.source],[locale === "ar" ? "الالتزام" : "Commitment",money(inputs.finance.commitment,locale),inputs.finance.source.source],[locale === "ar" ? "حصة التمويل %" : "Finance share %",pct(inputs.finance.financeSharePct,locale),inputs.finance.source.source],[locale === "ar" ? "معدل الربح %" : "Profit rate %",pct(inputs.finance.profitRatePct,locale),inputs.finance.source.source],[locale === "ar" ? "فترة السحب" : "Draw period",`${inputs.finance.drawStartMonth} → ${inputs.finance.drawEndMonth}`,inputs.finance.source.source],[locale === "ar" ? "السداد" : "Repayment",`${inputs.finance.repaymentStartMonth}; ${inputs.finance.repaymentMonths ?? c.notCalculable} months; ${inputs.finance.repaymentMode}`,inputs.finance.source.source],[locale === "ar" ? "ربح الإنشاء" : "Construction profit",inputs.finance.constructionProfit,inputs.finance.source.source],[locale === "ar" ? "رسم الترتيب %" : "Arrangement fee %",pct(inputs.finance.arrangementFeePct,locale),inputs.finance.source.source],[locale === "ar" ? "أشهر DSRA" : "DSRA months",number(inputs.finance.dsraMonths,locale,0),inputs.finance.source.source],[locale === "ar" ? "DSCR المستهدف" : "Target DSCR",x(inputs.finance.targetDscr,locale),inputs.finance.source.source],[locale === "ar" ? "بالون %" : "Target balloon %",pct(inputs.finance.balloonPct,locale),inputs.finance.source.source],[locale === "ar" ? "فئات مؤهلة" : "Eligible categories",inputs.finance.eligibleCategories.join(", "),inputs.finance.source.source]].map(row => `<tr>${row.map(cell => `<td>${escapeMajanHtml(cell)}</td>`).join("")}</tr>`).join(""), c.finance)}</section>
<section><h2>${escapeMajanHtml(c.annual)}</h2>${table([c.period,c.uses,c.billed,c.collected,c.opex,c.recoveries,c.cashNoi,c.cfads,c.draw,c.service,c.dscr,c.owner,c.ownerDistribution],annualRows,c.annual)}</section>
<section><h2>${escapeMajanHtml(c.sensitivity)}</h2>${table([locale === "ar" ? "الحالة" : "Case",locale === "ar" ? "تغير الإيجار" : "Rent change",locale === "ar" ? "تغير الإشغال" : "Occupancy change",locale === "ar" ? "CFADS سنوي" : "Annual CFADS",c.dscr],sensitivityRows,c.sensitivity)}</section>
<section class="supporting-detail"><h2>${locale === "ar" ? "جداول داعمة وتدقيق المدخلات" : "Supporting schedules and input audit"}</h2><p class="note">${locale === "ar" ? "التفاصيل التالية تدعم تتبع النتائج؛ المدخلات المالية قابلة للتعديل داخل التطبيق." : "The following detail supports traceability. Financial assumptions are editable in the application."}</p></section>
<section class="supporting-detail"><h2>${escapeMajanHtml(c.archived)}</h2><p class="note">${escapeMajanHtml(c.baselineNotice)}</p>${table([locale === "ar" ? "البند" : "Line item", c.category, locale === "ar" ? "الإجمالي" : "Total", locale === "ar" ? "موسوم مدفوع" : "Tagged paid", locale === "ar" ? "الجدول الشهري" : "Monthly scheduled"], baselineRows, c.archived)}</section>
<section class="supporting-detail"><h2>${escapeMajanHtml(c.inputs)}</h2>${table(["Path", c.metric, "Raw value", c.source, locale === "ar" ? "حتى تاريخ" : "As of", c.status, locale === "ar" ? "المبرر" : "Rationale"], inputRows, c.inputs)}</section>
<section class="supporting-detail"><h2>${escapeMajanHtml(c.operatingBridge)}</h2>${table([c.period,locale === "ar" ? "إيجار محتمل" : "Potential rent",c.billed,locale === "ar" ? "مدين أول" : "Opening AR",locale === "ar" ? "ديون معدومة" : "Bad debt",c.collected,locale === "ar" ? "مدين آخر" : "Closing AR",c.opex,locale === "ar" ? "فواتير الاسترداد" : "Recovery billed",c.recoveries,c.cashNoi,locale === "ar" ? "صيانة" : "Capex",locale === "ar" ? "إيداع احتياطي" : "Reserve deposit",locale === "ar" ? "إفراج احتياطي" : "Reserve release",locale === "ar" ? "نقد مقيد" : "Restricted cash",locale === "ar" ? "ضريبة نقدية" : "Cash tax",locale === "ar" ? "دخل آخر" : "Other income",c.cfads],operatingRows,c.operatingBridge)}</section>
<section class="supporting-detail"><h2>${escapeMajanHtml(c.financeBridge)}</h2>${table([c.period,locale === "ar" ? "رصيد افتتاحي" : "Opening balance",c.draw,locale === "ar" ? "ربح مرسمل" : "Capitalised profit",locale === "ar" ? "ربح مدفوع" : "Profit paid",locale === "ar" ? "رأس مال مدفوع" : "Capital paid",c.service,locale === "ar" ? "رسم" : "Fee",locale === "ar" ? "إيداع DSRA" : "DSRA deposit",locale === "ar" ? "إفراج DSRA" : "DSRA release",locale === "ar" ? "رصيد DSRA" : "DSRA balance",c.balance,c.dscr,locale === "ar" ? "صافي غير ممول" : "Unlevered net",locale === "ar" ? "صافي ممول" : "Funded net",locale === "ar" ? "فجوة تمويل" : "Funding gap",c.owner,c.ownerDistribution,locale === "ar" ? "تراكمي مساهمة المالك" : "Cumulative owner funding"],financeRows,c.financeBridge)}</section>
<section><h2>${escapeMajanHtml(c.checks)}</h2>${table([c.issueCode,c.status,c.issueMessage,locale === "ar" ? "الفرق" : "Difference"],checkRows,c.checks)}</section><section><h2>${escapeMajanHtml(c.issues)}</h2>${table([c.issueCode,locale === "ar" ? "الحقل" : "Field",c.issueMessage,c.severity],issueRows,c.issues)}</section><section><h2>${escapeMajanHtml(c.sources)}</h2>${table([c.source,locale === "ar" ? "حتى تاريخ" : "As of",c.status,locale === "ar" ? "المبرر" : "Rationale"],sourceRows,c.sources)}<p class="note">${escapeMajanHtml(c.sourceNotice)}</p></section><footer>${escapeMajanHtml(c.footer)}<br>${locale === "ar" ? "الجداول الشهرية وسجل المدخلات الكامل متاحان في HTML وExcel؛ هذه الطباعة ملخص للمناقشة." : "Full monthly schedules and input audit are available in HTML and Excel; this printout is the discussion summary."}</footer></main></body></html>`;
}

/** Readable monthly support export; it intentionally contains no untrusted formula text. */
export function buildMajanCashFlowCsv(result: MajanModelResult, locale: MajanLocale): string {
  const header = locale === "ar" ? ["الفترة","استخدامات التطوير (درهم)","الإيجار المفوتر (درهم)","الإيجار المحصل (درهم)","التشغيل النقدي (درهم)","المستردات المحصلة (درهم)","CFADS تقديري قبل الضريبة (درهم)","سحب التسهيل (درهم)","ربح / أجرة مدفوعة (درهم)","رأس مال مدفوع (درهم)","خدمة التمويل (درهم)","الرصيد الاقتصادي الختامي (درهم)","نسبة التغطية (مرة)","مساهمة المالك (درهم)"] : ["Period","Development uses (AED)","Billed rent (AED)","Collected rent (AED)","Cash OPEX (AED)","Recoveries collected (AED)","CFADS pre-tax indicative (AED)","Facility draw (AED)","Profit / rental paid (AED)","Capital paid (AED)","Debt service (AED)","Closing economic balance (AED)","DSCR (x)","Owner contribution (AED)"];
  const rows = result.leasing.months.map((lease, index) => { const finance = result.financing.months[index]; return [lease.period,result.development.uses[index] ?? 0,lease.billedRent,lease.collectedRent,lease.opex,lease.serviceChargeCollected,lease.cfads,finance?.draw,finance?.profitPaid,finance?.capitalPaid,finance?.totalPayment,finance?.closingBalance,finance?.dscr,finance?.ownerContribution]; });
  return [header, ...rows].map(row => row.map(value => escapeMajanCsv(value as string | number | null | undefined)).join(",")).join("\r\n");
}

export async function buildMajanWorkbook(
  inputs: MajanInputs,
  baseline: MajanBaseline,
  result: MajanModelResult,
  locale: MajanLocale,
  metadata: MajanWorkbookMetadata = {}
) {
  const xlsxModule = await import("xlsx-js-style");
  const XLSX: any = (xlsxModule as any).default || xlsxModule;
  const c = copy[locale];
  const isAr = locale === "ar";
  const names = {
    summary: isAr ? "ملخص" : "Summary", inputs: isAr ? "مدخلات" : "Inputs", leasing: isAr ? "تأجير" : "Leasing", opex: isAr ? "تشغيل" : "OPEX",
    monthly: isAr ? "تدفق شهري" : "MonthlyCashFlow", finance: isAr ? "تمويل" : "Financing", annual: isAr ? "سنوي" : "Annual", sources: isAr ? "مصادر وفحوص" : "SourcesChecks",
    sensitivity: isAr ? "حساسية" : "Sensitivity", archived: isAr ? "أساس مؤرشف" : "ArchivedBaseline", audit: isAr ? "تدقيق المدخلات" : "InputAudit", bridge: isAr ? "جسر تشغيلي" : "OperatingBridge",
  };
  const title = (value: string) => isAr ? `ماجان — ${value}` : `Majan — ${value}`;
  const subtitle = isAr ? "مسودة/تقديري للنقاش فقط — ليست شروط تمويل أو موافقة مصرفية" : "Draft / indicative for discussion only — not financing terms or bank approval";
  const units = isAr ? "القيم بالدرهم الإماراتي، ما لم يذكر خلاف ذلك" : "Values in AED unless otherwise stated";
  const na = c.notCalculable;
  const numeric = (value: number | null | undefined): number | string => value === null || value === undefined || !Number.isFinite(value) ? na : value;
  const workbookDscr = (value: number | null | undefined, payment: number | null | undefined): number | string => payment !== null && payment !== undefined && Number.isFinite(payment) && Math.abs(payment) < 0.000001 ? c.na : numeric(value);
  const rawInput = (value: unknown): string | number | boolean | null => value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : JSON.stringify(value);
  const commentText = (source: Provenance, path: string) => `Source: ${source.source}; as of: ${source.asOf}; input path: ${path}${source.rationale ? `; rationale: ${source.rationale}` : ""}. Editable draft value; recalculate in the Majan application.`;
  const archivedSource: Provenance = { source: `Archived baseline ${baseline.id}`, asOf: baseline.capturedAt, status: "recorded", rationale: `Source hash: ${baseline.sourceHash}; preserved separately from the editable scenario programme.` };
  const hardcoded = { font: { color: { rgb: "0000FF" } } };
  const calc = { font: { color: { rgb: "000000" } } };
  const currencyFmt = "#,##0;(#,##0);-";
  const pctFmt = "#,##0.0%";
  const ratioFmt = "#,##0.00x";
  const blank = (length: number): SpreadsheetRow => Array.from({ length }, () => "");
  const safeSheetName = (value: string) => value.slice(0, 31);
  const makeSheet = (sheetTitle: string, headers: string[], body: SpreadsheetRow[]) => {
    const width = headers.length + 2;
    const rows: SpreadsheetRow[] = [blank(width), blank(width), ["", "", title(sheetTitle)], blank(width), ["", "", subtitle], ["", "", units], blank(width), ["", "", ...headers], ...body.map(row => ["", "", ...row])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 20 }, ...headers.map((header, col) => {
      const maxBody = body.reduce((max, row) => Math.max(max, String(row[col] ?? "").length), header.length);
      // Text can legitimately be long; 80 preserves audit readability without unusable page width. Numeric columns stop at 20.
      const numericColumn = body.every(row => row[col] === null || typeof row[col] === "number");
      return { wch: Math.min(numericColumn ? 20 : 80, Math.max(12, maxBody + 2)) };
    })];
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 7, c: 2 }, e: { r: Math.max(7, rows.length - 1), c: Math.max(2, headers.length + 1) } }) };
    ws["!pageSetup"] = { orientation: "landscape", fitToWidth: 1, fitToHeight: 0 };
    ws["!margins"] = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
    ws["!printArea"] = `B2:${XLSX.utils.encode_col(Math.max(2, headers.length + 1))}${rows.length}`;
    ws["!footer"] = { center: "&A — Page &P of &N" };
    if (ws.C3) ws.C3.s = { fill: { fgColor: { rgb: "135B44" } }, font: { color: { rgb: "FFFFFF" }, bold: true, sz: 16 }, alignment: { horizontal: isAr ? "right" : "left" } };
    if (ws.C5) ws.C5.s = { font: { bold: true, sz: 11 } };
    if (ws.C6) ws.C6.s = { font: { italic: true } };
    for (let col = 2; col < headers.length + 2; col += 1) {
      const headerCell = ws[XLSX.utils.encode_cell({ r: 7, c: col })];
      if (headerCell) headerCell.s = { fill: { fgColor: { rgb: "CFE9E0" } }, font: { bold: true, color: { rgb: "000000" } }, alignment: { horizontal: isAr ? "right" : "left" } };
    }
    for (let row = 8; row < rows.length; row += 1) for (let col = 2; col < headers.length + 2; col += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
      if (!cell) continue;
      cell.s = { ...(cell.s || {}), ...calc, alignment: { horizontal: typeof cell.v === "number" ? "right" : (isAr ? "right" : "left") } };
      if (typeof cell.v === "number") { cell.s.z = currencyFmt; cell.z = currencyFmt; }
    }
    return ws;
  };
  const setCellStyle = (ws: any, row: number, col: number, style: any, numFmt?: string) => {
    const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
    if (!cell) return;
    cell.s = { ...(cell.s || {}), ...style, alignment: { horizontal: typeof cell.v === "number" ? "right" : (isAr ? "right" : "left") }, ...(numFmt ? { numFmt, z: numFmt } : {}) };
    if (numFmt) cell.z = numFmt;
  };
  const attachInput = (ws: any, row: number, col: number, source: Provenance, path: string, numFmt?: string) => {
    const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
    if (!cell) return;
    cell.c = [{ a: "Majan model", t: commentText(source, path) }];
    setCellStyle(ws, row, col, hardcoded, numFmt);
  };
  const workbook = XLSX.utils.book_new();
  workbook.Props = { Title: isAr ? "تصدير نقاش ماجان المالي" : "Majan financial discussion export", Subject: subtitle, Author: "Majan financial discussion model", CreatedDate: new Date() };
  const append = (ws: any, name: string) => XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(name));

  const stableYear = getMajanStabilisedYear(inputs);
  const stableAnnual = result.annual.find(row => row.year === stableYear);
  const summary = makeSheet(names.summary, [isAr ? "المؤشر" : "Metric", isAr ? "القيمة" : "Value", isAr ? "ملاحظة" : "Note"], [
    [isAr ? "الحالة" : "Status", metadata.saved ? (isAr ? "لقطة محفوظة" : "Saved snapshot") : (isAr ? "مسودة غير محفوظة" : "Unsaved draft"), metadata.revision ? `r${metadata.revision}` : ""],
    [isAr ? "تاريخ الحفظ" : "Saved at", metadata.savedAt || "", ""], [isAr ? "إصدار النموذج" : "Model version", result.version, ""], [isAr ? "تجزئة المدخلات" : "Input snapshot hash", result.inputHash, ""],
    [isAr ? "معرف الأساس المؤرشف" : "Archived baseline ID", baseline.id, baseline.sourceHash], [c.developmentCost, baseline.totalCost, isAr ? "مسجل، وليس ميزانية معتمدة أو إثبات دفع" : "Recorded; not an approved budget or payment evidence"],
    [c.revisedDevelopment, result.development.totalCost, ""], [c.totalGla, result.leasing.totalGla, "sqft"], [c.cashNoi, numeric(stableAnnual?.cashNoi), stableYear ? `Stabilised year ${stableYear}` : na], [c.cfads, numeric(stableAnnual?.cfads), stableYear ? `Stabilised year ${stableYear}` : na],
    [c.minDscr, inputs.finance.enabled ? numeric(result.financing.minDscr) : c.na, isAr ? "تحليلي فقط" : "Analytical only"], [c.peakOwner, numeric(result.financing.peakOwnerFunding), ""], [c.financeStatus, inputs.finance.enabled ? c.indicative : c.noFinance, ""],
    [isAr ? "تغطية سنة الاستقرار" : "Stabilised DSCR", workbookDscr(stableAnnual?.dscr, stableAnnual?.debtService), stableYear || na],
    [isAr ? "خدمة التمويل في سنة الاستقرار" : "Stabilised debt service", numeric(stableAnnual?.debtService), stableYear || na],
    [isAr ? "التغطية المستهدفة — افتراض" : "Target DSCR — assumption", inputs.finance.enabled ? numeric(inputs.finance.targetDscr) : c.na, ""],
  ]);
  for (let row = 8; row < 24; row += 1) { const cell = summary[XLSX.utils.encode_cell({ r: row, c: 3 })]; if (cell?.t === "n") setCellStyle(summary, row, 3, calc, [18,21,23].includes(row) ? ratioFmt : currencyFmt); }
  attachInput(summary, 12, 3, archivedSource, "baseline.id");
  attachInput(summary, 13, 3, archivedSource, "baseline.totalCost", currencyFmt);
  append(summary, names.summary);

  const auditRows = flattenInputs(inputs, locale);
  const audit = makeSheet(names.audit, ["Path", isAr ? "المؤشر" : "Label", isAr ? "القيمة الخام" : "Raw value", isAr ? "المصدر" : "Source", isAr ? "حتى تاريخ" : "As of", isAr ? "الحالة" : "Status", isAr ? "المبرر" : "Rationale"], auditRows.map(row => [row.path, row.label, rawInput(row.raw), row.source.source, row.source.asOf, statusLabel(row.source.status, c), row.source.rationale || ""]));
  auditRows.forEach((row, index) => attachInput(audit, index + 8, 4, row.source, row.path));
  append(audit, names.audit);

  const inputsSheet = makeSheet(names.inputs, [isAr ? "مجموعة المدخلات" : "Input group", isAr ? "المؤشر" : "Metric", isAr ? "القيمة" : "Value", isAr ? "المسار" : "Path", isAr ? "المصدر" : "Source", isAr ? "حتى تاريخ" : "As of", isAr ? "المبرر" : "Rationale"], auditRows.map(row => [row.path.split(".")[0] || "case", row.label, rawInput(row.raw), row.path, row.source.source, row.source.asOf, row.source.rationale || ""]));
  auditRows.forEach((row, index) => attachInput(inputsSheet, index + 8, 4, row.source, row.path));
  append(inputsSheet, names.inputs);

  const leasingColumns = [isAr ? "المعرف" : "ID", c.floor, c.category, isAr ? "المعالجة" : "Treatment", c.gla, c.rent, isAr ? "قاعدة الإيجار" : "Rent rule", isAr ? "مبيعات سنوية" : "Annual sales psf", isAr ? "دوران %" : "Turnover %", c.opening, isAr ? "إشغال أولي %" : "Initial occupancy %", isAr ? "إشغال مستقر %" : "Stable occupancy %", isAr ? "أشهر التدرج" : "Ramp months", isAr ? "أشهر الإعفاء" : "Rent-free months", isAr ? "تصعيد %" : "Escalation %", isAr ? "تحصيل %" : "Collection %", isAr ? "تأخر التحصيل" : "Collection lag months", isAr ? "المصدر" : "Source", isAr ? "حتى تاريخ" : "As of", isAr ? "المبرر" : "Rationale"];
  const leasing = makeSheet(names.leasing, leasingColumns, inputs.leasing.map(row => [row.id,row.floor,isAr ? row.nameAr : row.nameEn,row.treatment,row.areaSqft,numeric(row.annualRentPsf),row.rentRule,numeric(row.annualSalesPsf),row.turnoverPct === null ? na : row.turnoverPct / 100,row.openingMonth,row.initialOccupancyPct / 100,row.stabilisedOccupancyPct / 100,row.rampMonths,row.rentFreeMonths,row.escalationPct / 100,row.collectionPct / 100,row.collectionLagMonths,row.source.source,row.source.asOf,row.source.rationale || ""]));
  inputs.leasing.forEach((row, index) => { const r = index + 8; for (let col = 2; col <= 21; col += 1) attachInput(leasing, r, col, row.source, `leasing.${index}.${leasingColumns[col - 2]}`); [10,12,13,16,17].forEach(col => setCellStyle(leasing, r, col, hardcoded, pctFmt)); });
  append(leasing, names.leasing);

  const opexColumns = [isAr ? "المعرف" : "ID", isAr ? "البند" : "Line item", isAr ? "الطريقة" : "Mode", isAr ? "القيمة" : "Value", isAr ? "تصعيد %" : "Escalation %", isAr ? "قابل للاسترداد %" : "Recoverable %", isAr ? "تحصيل الاسترداد %" : "Recovery collection %", isAr ? "المصدر" : "Source", isAr ? "حتى تاريخ" : "As of", isAr ? "المبرر" : "Rationale"];
  const opex = makeSheet(names.opex, opexColumns, inputs.opex.map(row => [row.id,isAr ? row.nameAr : row.nameEn,row.mode,numeric(row.value),row.escalationPct / 100,row.recoverablePct / 100,row.recoveryCollectionPct / 100,row.source.source,row.source.asOf,row.source.rationale || ""]));
  inputs.opex.forEach((row, index) => { const r = index + 8; for (let col = 2; col <= 11; col += 1) attachInput(opex, r, col, row.source, `opex.${index}.${opexColumns[col - 2]}`); [6,7,8].forEach(col => setCellStyle(opex, r, col, hardcoded, pctFmt)); });
  append(opex, names.opex);

  const archived = makeSheet(names.archived, [isAr ? "المعرف" : "ID", isAr ? "البند" : "Line item", c.category, isAr ? "الإجمالي" : "Total", isAr ? "موسوم مدفوع" : "Tagged paid", isAr ? "مجموع الجدول الشهري" : "Monthly schedule total"], baseline.rows.map(row => [row.id,isAr ? row.nameAr : row.nameEn,row.category,row.total,row.taggedPaid,row.monthly.reduce((sum, value) => sum + value, 0)]));
  baseline.rows.forEach((row, index) => { const r = index + 8; for (let col = 2; col <= 7; col += 1) attachInput(archived, r, col, archivedSource, `baseline.rows.${index}.${["id", "name", "category", "total", "taggedPaid", "monthly"].at(col - 2)}`, col >= 5 ? currencyFmt : undefined); });
  append(archived, names.archived);

  const monthly = makeSheet(names.monthly, [c.period,c.uses,c.billed,c.collected,c.opex,c.recoveries,c.cfads,c.draw,c.service,c.balance,c.dscr,c.owner], result.leasing.months.map((lease, index) => { const finance = result.financing.months[index]; return [lease.period,result.development.uses[index] ?? 0,numeric(lease.billedRent),numeric(lease.collectedRent),numeric(lease.opex),numeric(lease.serviceChargeCollected),numeric(lease.cfads),numeric(finance?.draw),numeric(finance?.totalPayment),numeric(finance?.closingBalance),workbookDscr(finance?.dscr, finance?.totalPayment),numeric(finance?.ownerContribution)]; }));
  result.leasing.months.forEach((_, index) => setCellStyle(monthly, index + 8, 12, calc, ratioFmt));
  append(monthly, names.monthly);

  const bridge = makeSheet(names.bridge, [c.period,isAr ? "إيجار محتمل" : "Potential rent",c.billed,isAr ? "مدين أول" : "Opening AR",isAr ? "ديون معدومة" : "Bad debt",c.collected,isAr ? "مدين آخر" : "Closing AR",c.opex,isAr ? "فواتير الاسترداد" : "Recovery billed",c.recoveries,c.cashNoi,isAr ? "صيانة" : "Capex",isAr ? "إيداع احتياطي" : "Reserve deposit",isAr ? "إفراج احتياطي" : "Reserve release",isAr ? "نقد مقيد" : "Restricted cash",isAr ? "ضريبة نقدية" : "Cash tax",isAr ? "دخل آخر" : "Other income",c.cfads], result.leasing.months.map(row => [row.period,numeric(row.potentialRent),numeric(row.billedRent),numeric(row.openingAr),numeric(row.badDebt),numeric(row.collectedRent),numeric(row.closingAr),numeric(row.opex),numeric(row.serviceChargeBilled),numeric(row.serviceChargeCollected),numeric(row.cashNoi),numeric(row.capex),numeric(row.reserveDeposit),numeric(row.reserveRelease),numeric(row.restrictedCash),numeric(row.cashTax),numeric(row.otherIncome),numeric(row.cfads)]));
  append(bridge, names.bridge);

  const financing = makeSheet(names.finance, [c.period,isAr ? "رصيد افتتاحي" : "Opening balance",c.draw,isAr ? "ربح مرسمل" : "Capitalised profit",isAr ? "ربح مدفوع" : "Profit paid",isAr ? "رأس مال مدفوع" : "Capital paid",c.service,isAr ? "رسم" : "Fee",isAr ? "إيداع DSRA" : "DSRA deposit",isAr ? "إفراج DSRA" : "DSRA release",isAr ? "رصيد DSRA" : "DSRA balance",c.balance,c.dscr,isAr ? "صافي غير ممول" : "Unlevered net",isAr ? "صافي ممول" : "Funded net",isAr ? "فجوة تمويل" : "Funding gap",c.owner,c.ownerDistribution,isAr ? "تراكمي مساهمة المالك" : "Cumulative owner funding"], result.financing.months.map(row => [row.period,numeric(row.openingBalance),numeric(row.draw),numeric(row.profitCapitalised),numeric(row.profitPaid),numeric(row.capitalPaid),numeric(row.totalPayment),numeric(row.fee),numeric(row.dsraDeposit),numeric(row.dsraRelease),numeric(row.dsraBalance),numeric(row.closingBalance),workbookDscr(row.dscr, row.totalPayment),numeric(row.unleveredNet),numeric(row.fundedNet),numeric(row.fundingGap),numeric(row.ownerContribution),numeric(row.ownerDistribution),numeric(row.cumulativeOwnerContribution)]));
  result.financing.months.forEach((_, index) => setCellStyle(financing, index + 8, 14, calc, ratioFmt));
  append(financing, names.finance);

  const annual = makeSheet(names.annual, [c.period,c.uses,c.billed,c.collected,c.opex,c.recoveries,c.cashNoi,c.cfads,c.draw,isAr ? "ربح" : "Profit",isAr ? "رأس مال" : "Capital",c.service,c.balance,c.dscr,c.owner,c.ownerDistribution], result.annual.map(row => [row.year,row.developmentUses,numeric(row.billedRent),numeric(row.collectedRent),numeric(row.opex),numeric(row.recoveries),numeric(row.cashNoi),numeric(row.cfads),numeric(row.draw),numeric(row.profit),numeric(row.capital),numeric(row.debtService),numeric(row.closingBalance),workbookDscr(row.dscr, row.debtService),numeric(row.ownerContribution),numeric(row.ownerDistribution)]));
  result.annual.forEach((_, index) => setCellStyle(annual, index + 8, 15, calc, ratioFmt));
  append(annual, names.annual);

  const sensitivity = makeSheet(names.sensitivity, [isAr ? "الحالة" : "Case",isAr ? "تغير الإيجار" : "Rent change",isAr ? "تغير الإشغال" : "Occupancy change (pp)",isAr ? "CFADS سنوي" : "Annual CFADS",c.dscr], result.sensitivity.map(row => [isAr ? row.nameAr : row.nameEn,row.rentChangePct / 100,row.occupancyChangePp,numeric(row.annualCfads),numeric(row.annualDscr)]));
  result.sensitivity.forEach((_, index) => { setCellStyle(sensitivity, index + 8, 3, calc, pctFmt); setCellStyle(sensitivity, index + 8, 6, calc, ratioFmt); });
  append(sensitivity, names.sensitivity);

  const dedupedIssues = dedupeIssues(result.issues);
  const sources = makeSheet(names.sources, [isAr ? "النوع" : "Type",isAr ? "الحالة" : "Status",isAr ? "الرمز/المصدر" : "Code / source",isAr ? "التاريخ/الحقل" : "Date / field",isAr ? "الرسالة/المبرر" : "Message / rationale",isAr ? "الفرق" : "Difference"], [
    [isAr ? "البيانات الوصفية" : "Metadata", metadata.saved ? (isAr ? "محفوظ" : "Saved") : (isAr ? "مسودة" : "Draft"),result.inputHash,baseline.sourceHash,metadata.revision ? `revision ${metadata.revision}` : "", ""],
    ...allSources(inputs).map(source => [isAr ? "مصدر" : "Source",statusLabel(source.status,c),source.source,source.asOf,source.rationale || "",""]),
    ...result.checks.map(check => [isAr ? "اختبار" : "Check",check.status,check.code,"",isAr ? check.messageAr : check.messageEn,check.difference === undefined ? "" : check.difference]),
    ...dedupedIssues.map(issue => [isAr ? "ملاحظة" : "Issue",issue.severity,issue.code,issue.field,isAr ? issue.messageAr : issue.messageEn,""]),
  ]);
  append(sources, names.sources);
  return workbook;
}
