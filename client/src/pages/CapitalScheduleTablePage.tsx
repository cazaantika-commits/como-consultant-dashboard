import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  type FinancingScenario,
  SCENARIO_LABELS,
} from "@/lib/cashFlowEngine";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!n || n === 0) return "—";
  return Math.round(n).toLocaleString("ar-AE");
}

function arabicMonth(n: number): string {
  const nums = ["١","٢","٣","٤","٥","٦","٧","٨","٩","١٠","١١","١٢","١٣","١٤","١٥","١٦","١٧","١٨","١٩","٢٠","٢١","٢٢","٢٣","٢٤","٢٥","٢٦","٢٧","٢٨","٢٩","٣٠","٣١","٣٢","٣٣","٣٤","٣٥","٣٦"];
  return "ش" + (nums[n - 1] || n.toString());
}

// ─── Distribution engine (driven by settings) ────────────────────────────────

/**
 * Given a settings item and the phase timeline, compute the monthly distribution.
 * Returns a map of { absoluteMonth: amount }
 * Ensures the sum of all monthly values exactly equals computedAmount (no rounding drift).
 */
function distributeFromSettings(
  item: {
    distributionMethod: string;
    lumpSumMonth: number | null;
    startMonth: number | null;
    endMonth: number | null;
    customJson: string | null;
    computedAmount: number;
    fundingSource: string;
  },
  phases: { design: { start: number; duration: number }; offplan: { start: number; duration: number }; construction: { start: number; duration: number }; handover: { start: number; duration: number } },
): Record<number, number> {
  const amount = item.computedAmount;
  if (!amount || amount === 0) return {};

  if (item.distributionMethod === "lump_sum") {
    const month = item.lumpSumMonth || phases.design.start;
    return { [month]: amount };
  }

  if (item.distributionMethod === "equal_spread") {
    const start = item.startMonth || phases.design.start;
    const end = item.endMonth || (phases.design.start + phases.design.duration - 1);
    const months = end - start + 1;
    if (months <= 0) return { [start]: amount };
    // Use integer division + remainder correction to avoid rounding drift
    const basePerMonth = Math.floor(amount / months);
    const remainder = amount - basePerMonth * months;
    const dist: Record<number, number> = {};
    for (let m = start; m <= end; m++) {
      // Add remainder to the last month to ensure exact sum
      dist[m] = m === end ? basePerMonth + remainder : basePerMonth;
    }
    return dist;
  }

  if (item.distributionMethod === "custom") {
    if (!item.customJson) return {};
    try {
      const parsed = JSON.parse(item.customJson);
      const dist: Record<number, number> = {};
      // Support both { month: pct } and [{ month, pct }] formats
      if (Array.isArray(parsed)) {
        let allocated = 0;
        const entries = parsed as Array<{ month: number; amount?: number; pct?: number }>;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const isLast = i === entries.length - 1;
          const val = entry.amount !== undefined
            ? entry.amount
            : (entry.pct !== undefined ? amount * entry.pct / 100 : 0);
          if (isLast) {
            // Assign remainder to last entry to avoid rounding drift
            dist[entry.month] = (dist[entry.month] || 0) + (amount - allocated);
          } else {
            dist[entry.month] = (dist[entry.month] || 0) + val;
            allocated += val;
          }
        }
      } else {
        // Object format: { month: percentage }
        const entries = Object.entries(parsed as Record<string, number>);
        let allocated = 0;
        for (let i = 0; i < entries.length; i++) {
          const [mStr, pct] = entries[i];
          const isLast = i === entries.length - 1;
          const val = amount * (pct / 100);
          if (isLast) {
            dist[parseInt(mStr)] = amount - allocated;
          } else {
            dist[parseInt(mStr)] = val;
            allocated += val;
          }
        }
      }
      return dist;
    } catch {
      return {};
    }
  }

  return {};
}

// ─── styles matching capital-schedule.html ────────────────────────────────────

const S = {
  hPhase: { background: "#1a1a2e", color: "#fff", fontWeight: "bold", fontSize: 11, padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const },
  hMonth: { background: "#2d4a7a", color: "#fff", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const },
  colDesc: { textAlign: "right" as const, minWidth: 180, background: "#f0f4ff", fontWeight: 500, padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, position: "sticky" as const, right: 0, zIndex: 2 },
  colTotal: { minWidth: 90, background: "#fff8e1", fontWeight: "bold", color: "#b45309", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontFamily: "monospace", fontSize: 10 },
  colInvestor: { minWidth: 90, background: "#fef3c7", fontWeight: "bold", color: "#92400e", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontFamily: "monospace", fontSize: 10 },
  colPaid: { minWidth: 90, background: "#e8f5e9", color: "#1b5e20", fontWeight: "bold", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontFamily: "monospace", fontSize: 10 },
  phDesignH: { background: "#7c3aed", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },
  phOffplanH: { background: "#1d4ed8", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },
  phConstructionH: { background: "#15803d", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },
  phHandoverH: { background: "#b45309", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },
  phDesignSub: { background: "#ede9fe", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },
  phOffplanSub: { background: "#dbeafe", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },
  phConstructionSub: { background: "#dcfce7", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },
  phHandoverSub: { background: "#fef3c7", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },
  numCell: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  numCellDesign: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#ede9fe" },
  numCellOffplan: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#dbeafe" },
  numCellConstruction: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#dcfce7" },
  numCellHandover: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#fef3c7" },
  numCellEscrow: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#dbeafe" },
  numCellValue: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#fffbeb" },
  sectionHeader: { background: "#e2e8f0", fontWeight: "bold", fontSize: 11, color: "#334155", textAlign: "right" as const, padding: "4px 6px", border: "1px solid #ccc" },
  totalRow: { background: "#1a1a2e", color: "#fff", fontWeight: "bold", fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  totalRowDesc: { background: "#1a1a2e", color: "#fff", fontWeight: "bold", padding: "4px 6px", border: "1px solid #ccc", textAlign: "right" as const, whiteSpace: "nowrap" as const, position: "sticky" as const, right: 0, zIndex: 2 },
  totalRowNum: { background: "#1a1a2e", color: "#fbbf24", fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  cumRow: { background: "#f0f4ff", fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  cumRowDesc: { background: "#f0f4ff", fontWeight: "bold", color: "#1a1a2e", padding: "4px 6px", border: "1px solid #ccc", textAlign: "right" as const, whiteSpace: "nowrap" as const, position: "sticky" as const, right: 0, zIndex: 2 },
};

// ─── component ────────────────────────────────────────────────────────────────

export default function CapitalScheduleTablePage({
  embedded,
  initialProjectId,
}: {
  embedded?: boolean;
  initialProjectId?: number | null;
}) {
  const { isAuthenticated } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });

  const [localProjectId, setLocalProjectId] = useState<number | null>(initialProjectId ?? null);
  useEffect(() => {
    if (initialProjectId != null) setLocalProjectId(initialProjectId);
  }, [initialProjectId]);

  const selectedProjectId = localProjectId;
  const selectedProject = (projectsQuery.data || []).find((p: any) => p.id === selectedProjectId);

  // Scenario
  const scenariosQuery = trpc.cashFlowProgram.getProjectScenarios.useQuery(undefined, { enabled: isAuthenticated, staleTime: 5000 });
  const updateScenarioMutation = trpc.cashFlowProgram.updateProjectScenario.useMutation({
    onSuccess: () => scenariosQuery.refetch(),
  });
  const scenario: FinancingScenario = ((scenariosQuery.data?.[selectedProjectId || 0]) || "offplan_escrow") as FinancingScenario;
  const setScenario = (s: FinancingScenario) => {
    if (!selectedProjectId) return;
    updateScenarioMutation.mutate({ projectId: selectedProjectId, scenario: s });
  };

  // Load settings from cashFlowSettings (the source of truth for distribution)
  const settingsQuery = trpc.cashFlowSettings.getSettings.useQuery(
    { projectId: selectedProjectId || 0, scenario: scenario as any },
    { enabled: !!selectedProjectId, staleTime: 0, refetchOnWindowFocus: true }
  );

  const settingsData = settingsQuery.data;

  // Build phase timeline from settings response (uses saved durations)
  const phases = useMemo(() => {
    if (!settingsData) return { design: { start: 1, duration: 6 }, offplan: { start: 3, duration: 2 }, construction: { start: 7, duration: 16 }, handover: { start: 23, duration: 2 } };
    return settingsData.phases;
  }, [settingsData]);

  const totalMonths = useMemo(() => {
    const p = phases;
    return p.design.duration + p.construction.duration + p.handover.duration;
  }, [phases]);

  // Build month arrays per phase
  const designMonths = useMemo(() =>
    Array.from({ length: phases.design.duration }, (_, i) => phases.design.start + i),
    [phases]
  );
  // All offplan months (may overlap with design)
  const offplanMonthsAll = useMemo(() =>
    phases.offplan.duration > 0
      ? Array.from({ length: phases.offplan.duration }, (_, i) => phases.offplan.start + i)
      : [],
    [phases]
  );
  // Offplan months that are NOT already in design (for display as separate columns)
  const offplanMonths = useMemo(() => {
    const designSet = new Set(designMonths);
    return offplanMonthsAll.filter(m => !designSet.has(m));
  }, [offplanMonthsAll, designMonths]);
  const constructionMonths = useMemo(() =>
    Array.from({ length: phases.construction.duration }, (_, i) => phases.construction.start + i),
    [phases]
  );
  const handoverMonths = useMemo(() =>
    phases.handover.duration > 0
      ? Array.from({ length: phases.handover.duration }, (_, i) => phases.handover.start + i)
      : [],
    [phases]
  );
  // allMonths: unique months in chronological order (no duplicates)
  const allMonths = useMemo(() => {
    const seen = new Set<number>();
    const result: number[] = [];
    for (const m of [...designMonths, ...offplanMonthsAll, ...constructionMonths, ...handoverMonths]) {
      if (!seen.has(m)) { seen.add(m); result.push(m); }
    }
    return result;
  }, [designMonths, offplanMonthsAll, constructionMonths, handoverMonths]);

  // Separate items by section and funding source
  const allItems = useMemo(() => settingsData?.settings || [], [settingsData]);

  const paidItems = useMemo(() => allItems.filter((s: any) => s.section === "paid"), [allItems]);
  const designItems = useMemo(() => allItems.filter((s: any) => s.section === "design" && s.fundingSource === "investor"), [allItems]);
  const offplanItems = useMemo(() => allItems.filter((s: any) => s.section === "offplan" && s.fundingSource === "investor"), [allItems]);
  const constructionItems = useMemo(() => allItems.filter((s: any) => s.section === "construction" && s.fundingSource === "investor"), [allItems]);
  const escrowItems = useMemo(() => allItems.filter((s: any) => s.fundingSource === "escrow"), [allItems]);

  // Compute monthly distributions for each item
  const itemMonthly = useMemo(() => {
    const result: Record<string, Record<number, number>> = {};
    for (const item of allItems) {
      if (item.section === "paid") {
        result[item.itemKey] = {}; // paid items have no monthly distribution
      } else {
        result[item.itemKey] = distributeFromSettings(item, phases);
      }
    }
    return result;
  }, [allItems, phases]);

  // Per-month totals
  const monthInvestorTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const item of [...designItems, ...offplanItems, ...constructionItems]) {
      const monthly = itemMonthly[item.itemKey] || {};
      for (const [mStr, val] of Object.entries(monthly)) {
        const m = parseInt(mStr);
        totals[m] = (totals[m] || 0) + (val as number);
      }
    }
    return totals;
  }, [designItems, offplanItems, constructionItems, itemMonthly]);

  const monthEscrowTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const item of escrowItems) {
      const monthly = itemMonthly[item.itemKey] || {};
      for (const [mStr, val] of Object.entries(monthly)) {
        const m = parseInt(mStr);
        totals[m] = (totals[m] || 0) + (val as number);
      }
    }
    return totals;
  }, [escrowItems, itemMonthly]);

  const monthAllTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const m of allMonths) {
      totals[m] = (monthInvestorTotals[m] || 0) + (monthEscrowTotals[m] || 0);
    }
    return totals;
  }, [allMonths, monthInvestorTotals, monthEscrowTotals]);

  // Grand totals
  const paidTotal = useMemo(() => paidItems.reduce((s: number, e: any) => s + (e.computedAmount || 0), 0), [paidItems]);
  const investorTotal = useMemo(() => allItems.filter((i: any) => i.fundingSource === "investor").reduce((s: number, e: any) => s + (e.computedAmount || 0), 0), [allItems]);
  const escrowTotal = useMemo(() => escrowItems.reduce((s: number, e: any) => s + (e.computedAmount || 0), 0), [escrowItems]);
  const grandTotal = useMemo(() => investorTotal + escrowTotal, [investorTotal, escrowTotal]);

  // Cumulative investor
  const cumulativeInvestor = useMemo(() => {
    let running = paidTotal;
    const cum: Record<number, number> = {};
    for (const m of allMonths) {
      running += (monthInvestorTotals[m] || 0);
      cum[m] = running;
    }
    return { landTotal: paidTotal, monthly: cum };
  }, [allMonths, monthInvestorTotals, paidTotal]);

  // Phase helpers
  // Note: offplan overlaps with design. Months in both → classified as "design" for display.
  // offplanMonths (display) only has non-overlapping offplan months.
  function phaseOf(m: number): "design" | "offplan" | "construction" | "handover" {
    if (designMonths.includes(m)) return "design";
    if (offplanMonths.includes(m)) return "offplan"; // only non-overlapping offplan months
    if (constructionMonths.includes(m)) return "construction";
    return "handover";
  }

  function cellStyle(m: number, isEscrow = false) {
    const ph = phaseOf(m);
    if (isEscrow) return S.numCellEscrow;
    if (ph === "design") return S.numCellDesign;
    if (ph === "offplan") return S.numCellOffplan;
    if (ph === "construction") return S.numCellConstruction;
    return S.numCellHandover;
  }

  function numStyle(m: number, val: number, isEscrow = false) {
    const base = cellStyle(m, isEscrow);
    if (val === 0) return { ...base, color: "#ccc" };
    return { ...base, ...S.numCellValue, background: isEscrow ? "#dbeafe" : "#fffbeb" };
  }

  function monthHeaderStyle(m: number) {
    const ph = phaseOf(m);
    if (ph === "design") return S.phDesignSub;
    if (ph === "offplan") return S.phOffplanSub;
    if (ph === "construction") return S.phConstructionSub;
    return S.phHandoverSub;
  }

  function getVal(itemKey: string, month: number): number {
    return itemMonthly[itemKey]?.[month] || 0;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!selectedProjectId) {
    return (
      <div style={{ padding: 20, textAlign: "center", direction: "rtl" }}>
        <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>📊</div>
        <h2 style={{ color: "#9ca3af", fontSize: 18 }}>اختر مشروع لعرض جدولة رأس المال</h2>
      </div>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <div style={{ padding: 20, textAlign: "center", direction: "rtl" }}>
        <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>⏳</div>
        <p style={{ color: "#9ca3af" }}>جارٍ تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", fontSize: 11, background: "#f5f5f5", padding: embedded ? 8 : 20 }}>
      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4, color: "#1a1a2e" }}>
          جدولة رأس المال — {selectedProject?.name || "المشروع"}
        </h2>
        <p style={{ fontSize: 11, color: "#666" }}>توزيع المصاريف على المراحل الزمنية حسب إعدادات التدفق | المبالغ بالدرهم الإماراتي</p>
        {!settingsData?.hasSavedSettings && (
          <p style={{ fontSize: 10, color: "#b45309", background: "#fef3c7", padding: "4px 8px", borderRadius: 4, display: "inline-block", marginTop: 4 }}>
            ⚠️ يستخدم الإعدادات الافتراضية — اذهب إلى تبويب "إعدادات التدفق" لتخصيص التوزيع
          </p>
        )}
      </div>

      {/* Scenario selector */}
      {!embedded && (
        <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#555", fontWeight: "bold" }}>السيناريو:</span>
          {(Object.entries(SCENARIO_LABELS) as [FinancingScenario, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              style={{
                fontSize: 10,
                fontWeight: "bold",
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: scenario === key
                  ? key === "offplan_escrow" ? "#7c3aed"
                  : key === "offplan_construction" ? "#1d4ed8"
                  : "#15803d"
                  : "#e5e7eb",
                color: scenario === key ? "#fff" : "#374151",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%", background: "#fff" }}>
          {/* ── HEADER ROW 1: Phase spans ── */}
          <thead>
            <tr>
              <th style={{ ...S.hPhase, ...S.colDesc }}>البند</th>
              <th style={S.hPhase}>إجمالي التكاليف</th>
              <th style={S.hPhase}>خطة رأس مال المشروع</th>
              <th style={S.hPhase}>مدفوع</th>
              {designMonths.length > 0 && (
                <th style={S.phDesignH} colSpan={designMonths.length}>
                  المرحلة 2 — التصاميم ({phases.design.duration} أشهر)
                </th>
              )}
              {offplanMonths.length > 0 && (
                <th style={S.phOffplanH} colSpan={offplanMonths.length}>
                  المرحلة 3 — أوف بلان ({phases.offplan.duration} شهر)
                </th>
              )}
              {constructionMonths.length > 0 && (
                <th style={S.phConstructionH} colSpan={constructionMonths.length}>
                  المرحلة 4 — الإنشاء ({phases.construction.duration} شهر)
                </th>
              )}
              {handoverMonths.length > 0 && (
                <th style={S.phHandoverH} colSpan={handoverMonths.length}>
                  المرحلة 5 — التسليم ({phases.handover.duration} شهر)
                </th>
              )}
            </tr>

            {/* ── HEADER ROW 2: Month numbers ── */}
            <tr>
              <th style={{ ...S.hMonth, ...S.colDesc, background: "#e2e8f0", color: "#334155" }}>الوصف</th>
              <th style={{ ...S.hMonth, background: "#fff8e1", color: "#92400e" }}>الإجمالي</th>
              <th style={{ ...S.hMonth, background: "#fef3c7", color: "#92400e" }}>من المستثمر</th>
              <th style={{ ...S.hMonth, background: "#e8f5e9", color: "#1b5e20" }}>مدفوع</th>
              {allMonths.map(m => (
                <th key={m} style={monthHeaderStyle(m)}>
                  {arabicMonth(
                    phaseOf(m) === "design" ? designMonths.indexOf(m) + 1
                    : phaseOf(m) === "offplan" ? offplanMonths.indexOf(m) + 1
                    : phaseOf(m) === "construction" ? constructionMonths.indexOf(m) + 1
                    : handoverMonths.indexOf(m) + 1
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* ── SECTION 1: PAID (Land) ── */}
            <tr>
              <td colSpan={4 + allMonths.length} style={S.sectionHeader}>القسم الأول — المبالغ المدفوعة (الأرض)</td>
            </tr>
            {paidItems.map((item: any) => (
              <tr key={item.itemKey}>
                <td style={S.colDesc}>{item.nameAr}</td>
                <td style={S.colTotal}>{fmt(item.computedAmount)}</td>
                <td style={S.colInvestor}>{fmt(item.computedAmount)}</td>
                <td style={S.colPaid}>{fmt(item.computedAmount)}</td>
                {allMonths.map(m => (
                  <td key={m} style={{ ...cellStyle(m), color: "#ccc" }}>—</td>
                ))}
              </tr>
            ))}

            {/* ── SECTION 2: DESIGN ── */}
            <tr>
              <td colSpan={4 + allMonths.length} style={S.sectionHeader}>القسم الثاني — التصاميم ورخصة البناء</td>
            </tr>
            {designItems.map((item: any) => (
              <tr key={item.itemKey}>
                <td style={S.colDesc}>{item.nameAr}</td>
                <td style={S.colTotal}>{fmt(item.computedAmount)}</td>
                <td style={S.colInvestor}>{fmt(item.computedAmount)}</td>
                <td style={S.colPaid}>—</td>
                {allMonths.map(m => {
                  const val = getVal(item.itemKey, m);
                  return <td key={m} style={numStyle(m, val)}>{fmt(val)}</td>;
                })}
              </tr>
            ))}

            {/* ── SECTION 3: OFFPLAN / RERA ── */}
            {offplanItems.length > 0 && (
              <>
                <tr>
                  <td colSpan={4 + allMonths.length} style={S.sectionHeader}>القسم الثالث — ريرا والبيع أوف بلان</td>
                </tr>
                {offplanItems.map((item: any) => (
                  <tr key={item.itemKey}>
                    <td style={S.colDesc}>{item.nameAr}</td>
                    <td style={S.colTotal}>{fmt(item.computedAmount)}</td>
                    <td style={S.colInvestor}>{fmt(item.computedAmount)}</td>
                    <td style={S.colPaid}>—</td>
                    {allMonths.map(m => {
                      const val = getVal(item.itemKey, m);
                      return <td key={m} style={numStyle(m, val)}>{fmt(val)}</td>;
                    })}
                  </tr>
                ))}
              </>
            )}

            {/* ── SECTION 4: CONSTRUCTION (investor) ── */}
            {constructionItems.length > 0 && (
              <>
                <tr>
                  <td colSpan={4 + allMonths.length} style={S.sectionHeader}>القسم الرابع — الإنشاء (حصة المستثمر فقط)</td>
                </tr>
                {constructionItems.map((item: any) => (
                  <tr key={item.itemKey}>
                    <td style={S.colDesc}>{item.nameAr}</td>
                    <td style={S.colTotal}>{fmt(item.computedAmount)}</td>
                    <td style={S.colInvestor}>{fmt(item.computedAmount)}</td>
                    <td style={S.colPaid}>—</td>
                    {allMonths.map(m => {
                      const val = getVal(item.itemKey, m);
                      return <td key={m} style={numStyle(m, val)}>{fmt(val)}</td>;
                    })}
                  </tr>
                ))}
              </>
            )}

            {/* ── SECTION 5: ESCROW ── */}
            {escrowItems.length > 0 && (
              <>
                <tr>
                  <td colSpan={4 + allMonths.length} style={S.sectionHeader}>من حساب الضمان (تُدفع من إيرادات المشترين)</td>
                </tr>
                {escrowItems.map((item: any) => (
                  <tr key={item.itemKey}>
                    <td style={S.colDesc}>{item.nameAr}</td>
                    <td style={S.colTotal}>{fmt(item.computedAmount)}</td>
                    <td style={{ ...S.colInvestor, color: "#1d4ed8" }}>من الضمان</td>
                    <td style={S.colPaid}>—</td>
                    {allMonths.map(m => {
                      const val = getVal(item.itemKey, m);
                      return <td key={m} style={numStyle(m, val, true)}>{fmt(val)}</td>;
                    })}
                  </tr>
                ))}
              </>
            )}

            {/* ── TOTAL ROW ── */}
            <tr>
              <td style={S.totalRowDesc}>إجمالي الشهر</td>
              <td style={S.totalRow}>{fmt(grandTotal)}</td>
              <td style={S.totalRow}>{fmt(investorTotal)}</td>
              <td style={S.totalRow}>{fmt(paidTotal)}</td>
              {allMonths.map(m => (
                <td key={m} style={S.totalRowNum}>{fmt(monthAllTotals[m] || 0)}</td>
              ))}
            </tr>

            {/* ── CUMULATIVE ROW ── */}
            <tr>
              <td style={S.cumRowDesc}>إجمالي تراكمي (مستثمر)</td>
              <td colSpan={2} style={S.cumRow}></td>
              <td style={S.cumRow}>{fmt(cumulativeInvestor.landTotal)}</td>
              {allMonths.map((m, i) => {
                const val = cumulativeInvestor.monthly[m] || 0;
                const isLast = i === allMonths.length - 1;
                return (
                  <td key={m} style={{ ...S.cumRow, ...(isLast ? { color: "#fbbf24", fontWeight: "bold", background: "#1a1a2e" } : {}) }}>
                    {fmt(val)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div style={{ marginTop: 16, fontSize: 10, color: "#666", lineHeight: 1.8 }}>
        <strong>ملاحظات:</strong><br />
        • الخلايا البيضاء = من المستثمر | الخلايا الزرقاء الفاتحة = من حساب الضمان (إيرادات المشترين)<br />
        • صف "إجمالي الشهر" يجمع المستثمر + الضمان معاً<br />
        • صف "إجمالي تراكمي" يتتبع رأس المال المطلوب من المستثمر فقط<br />
        • المبالغ المدفوعة = الأرض وما سبق (لا تاريخ محدد)<br />
        • التوزيع الشهري يعتمد على إعدادات التدفق المحفوظة — عدّل التوزيع من تبويب "إعدادات التدفق"<br />
        {offplanMonthsAll.length > 0 && offplanMonths.length === 0 && (
          <span style={{ color: "#1d4ed8" }}>• مرحلة الأوف بلان (شهر {offplanMonthsAll[0]}–{offplanMonthsAll[offplanMonthsAll.length-1]}) تتداخل كلياً مع مرحلة التصاميم وتُعرض ضمنها في الجدول</span>
        )}
      </div>
    </div>
  );
}
