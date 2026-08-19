import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Wael professional decision workspace", () => {
  const workspaceSource = readSource("client/src/pages/V2WaelSales.tsx");
  const navigationSource = readSource("client/src/pages/BateekhaPage.tsx");
  const stylesSource = readSource("client/src/index.css");

  it("uses one professional scenario canvas with live impact beside direct controls", () => {
    expect(workspaceSource).not.toContain("WAEL_STUDIO_ROOMS");
    expect(workspaceSource).toContain("مساحة سيناريو وائل");
    expect(workspaceSource).toContain("شريط التحكم");
    expect(workspaceSource).toContain("لوحة بيع 12 شهرًا");
    expect(workspaceSource).toContain("أثر القرار — مباشر");
    expect(workspaceSource).toContain("impactFocus");
    expect(workspaceSource).toContain("xl:grid-cols-[minmax(0,1fr)_300px]");
    expect(workspaceSource).toContain("h-12 w-full");
    expect(workspaceSource).toContain("applySalesPace");
    expect(workspaceSource).toContain("adjustAllPrices");
    expect(workspaceSource).toContain("applyPaymentPreset");
    expect(workspaceSource).toContain("أول تحصيل فعلي");
    expect(workspaceSource).toContain("أدنى رصيد في الإسكرو");
  });

  it("preserves a single approved scenario save and one visible Sales and Marketing entry", () => {
    expect(workspaceSource).toContain("اعتماد سيناريو وائل");
    expect(workspaceSource).toContain("saveWorkspace.mutateAsync");
    expect(navigationSource).toContain('label: "المبيعات والتسويق"');
    expect(navigationSource).toContain("مساحة وائل لتخطيط البيع");
    expect(navigationSource).not.toContain('id: "marketing"');
  });

  it("uses a visible twelve-month direct-input sales board with synchronized, large unit and percentage controls", () => {
    expect(workspaceSource).toContain("const monthsPerPage = 12");
    expect(workspaceSource).toContain("اكتب عدد الوحدات أو النسبة داخل البطاقة نفسها");
    expect(workspaceSource).toContain("const calendarYear = projectStartDate");
    expect(workspaceSource).toContain("tabular-nums tracking-wide text-slate-500");
    expect(workspaceSource).toContain("وحدات ${monthLabel}");
    expect(workspaceSource).toContain("نسبة ${monthLabel}");
    expect(workspaceSource).toContain("updateSalesMonth(salesIndex");
  });

  it("protects the professional canvas from invalid negative legacy month values", () => {
    expect(workspaceSource).toContain("manualUnits.map((value) => Math.max(0, Math.round(Number(value) || 0)))");
    expect(workspaceSource).toContain("const selectedUnits = Math.max(0, Number(manualUnits[salesIndex] ?? units ?? 0) || 0)");
  });

  it("uses direct post-completion sale language instead of off-plan payment or escrow controls for build-for-sale", () => {
    expect(workspaceSource).toContain('isBuildForSale ? "تحصيل البيع"');
    expect(workspaceSource).toContain("دفعة كاملة عند بيع الوحدة");
    expect(workspaceSource).toContain("بيع مباشر بعد الإنجاز");
    expect(workspaceSource).toContain('isBuildForSale ? "استلام مباشر" : "تحصيل"');
  });

  it("keeps unit pricing in one visible light source panel with full-number formatting", () => {
    expect(workspaceSource).toContain('data-testid="pricing-source-panel"');
    expect(workspaceSource).toContain("لوحة التسعير المعتمدة");
    expect(workspaceSource).toContain("سعر القدم المربع هو نقطة الإدخال الوحيدة");
    expect(workspaceSource).toContain("مرجع من توزيع الوحدات");
    expect(workspaceSource).toContain('import { formatFullNumber } from "@/lib/numberFormat"');
    expect(workspaceSource).toContain('return formatFullNumber(n, "0")');
    expect(workspaceSource).not.toContain('return (n / 1e6).toFixed(1) + "M"');
    expect(workspaceSource).toContain('aria-hidden="true" className="hidden overflow-hidden rounded-[22px] border border-slate-800 bg-[#101b2d]');
  });

  it("gives each unit-pricing card a stronger, distinct light type treatment", () => {
    expect(workspaceSource).toContain('data-testid="unit-pricing-card"');
    expect(workspaceSource).toContain('className="rounded-2xl border-2 p-3.5 transition hover:-translate-y-0.5"');
    expect(workspaceSource).toContain('borderColor: unit.color');
    expect(workspaceSource).toContain('background: `linear-gradient(135deg, ${unit.color}1c 0%, #ffffff 62%)`');
    expect(workspaceSource).toContain('backgroundColor: `${unit.color}14`');
    expect(workspaceSource).toContain('className="h-9 w-full min-w-0 rounded-lg border-2 bg-white');
  });

  it("keeps sales navigation, all marketing allocations, and collection reading visible without a details click", () => {
    expect(workspaceSource).toContain('aria-label="عرض أشهر البيع السابقة"');
    expect(workspaceSource).toContain('aria-label="عرض أشهر البيع التالية"');
    expect(workspaceSource).toContain('الأشهر {pageStart + 1}–{Math.min(pageStart + 12, salesMonths)}');
    expect(workspaceSource).toContain("MARKETING_CHANNELS.map((channel)");
    expect(workspaceSource).toContain("من 6 بنود");
    expect(workspaceSource).toContain('data-testid="collection-cash-reading"');
    expect(workspaceSource).toContain("التحصيل الفعلي");
    expect(workspaceSource).toContain("قيمة البيع في الشهر");
    expect(workspaceSource).toContain('border border-slate-300 bg-white');
  });

  it("uses actual named calendar months and a compact six-column collection-card layout", () => {
    expect(workspaceSource).toContain("const formatCalendarMonth = (projectMonth: number)");
    expect(workspaceSource).toContain("return `${monthNames[offset % 12]} ${startYear + Math.floor(offset / 12)}`");
    expect(workspaceSource).toContain('data-testid="collection-cash-card"');
    expect(workspaceSource).toContain('sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6');
    expect(workspaceSource).toContain('className="rounded-xl border border-slate-300 bg-white p-2.5"');
    expect(workspaceSource).not.toContain('className="text-xs font-black text-slate-800">شهر {row.month}');
  });

  it("uses a compact pastel canvas with an expanded named-month collection tile board", () => {
    expect(workspaceSource).toContain('sales-workspace-pastel min-h-full');
    expect(workspaceSource).toContain('xl:grid-cols-[minmax(0,1fr)_300px]');
    expect(workspaceSource).toContain('const visibleCollectionRows = cashInflowData.filter');
    expect(workspaceSource).toContain('.slice(0, 18)');
    expect(workspaceSource).toContain('data-testid="collection-cash-reading-compact"');
    expect(workspaceSource).toContain('xl:grid-cols-7');
    expect(workspaceSource).toContain('collectionPastelTones[index % collectionPastelTones.length]');
    expect(workspaceSource).toContain('data-testid="sales-control-strip"');
    expect(workspaceSource).toContain('data-testid="sales-calendar-board"');
    expect(workspaceSource).toContain('data-testid="sales-live-impact"');
  });

  it("scopes the approved soft pastel card system to the Sales workspace only", () => {
    expect(stylesSource).toContain("SALES WORKSPACE — COMPACT PASTEL CANVAS");
    expect(stylesSource).toContain('.sales-workspace-pastel [data-testid="collection-cash-reading"]');
    expect(stylesSource).toContain('[data-testid="sales-control-strip"] > div:last-child > div:nth-child(1)');
    expect(stylesSource).toContain('[data-testid="sales-calendar-board"] article:nth-child(4n + 1)');
    expect(stylesSource).toContain('[data-testid="sales-live-impact"]');
  });
});
