import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  type PhaseDurations,
  type FinancingScenario,
  DEFAULT_DURATIONS,
  calculatePhases,
  getTotalMonths,
  distributeExpense,
  getInvestorExpenses,
  getEscrowExpenses,
  getDefaultCustomDistribution,
  getDefaultRevenue,
  SCENARIO_LABELS,
} from "@/lib/cashFlowEngine";
import { calculateProjectCosts } from "@/lib/projectCostsCalc";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!n || n === 0) return "—";
  return Math.round(n).toLocaleString("ar-AE");
}

function arabicMonth(n: number): string {
  const nums = ["١","٢","٣","٤","٥","٦","٧","٨","٩","١٠","١١","١٢","١٣","١٤","١٥","١٦","١٧","١٨","١٩","٢٠","٢١","٢٢","٢٣","٢٤","٢٥","٢٦","٢٧","٢٨","٢٩","٣٠","٣١","٣٢","٣٣","٣٤","٣٥","٣٦"];
  return "ش" + (nums[n - 1] || n.toString());
}

// ─── styles matching capital-schedule.html ────────────────────────────────────

const S = {
  // header rows
  hPhase: { background: "#1a1a2e", color: "#fff", fontWeight: "bold", fontSize: 11, padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const },
  hMonth: { background: "#2d4a7a", color: "#fff", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const },

  // fixed columns
  colDesc: { textAlign: "right" as const, minWidth: 180, background: "#f0f4ff", fontWeight: 500, padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, position: "sticky" as const, right: 0, zIndex: 2 },
  colTotal: { minWidth: 90, background: "#fff8e1", fontWeight: "bold", color: "#b45309", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontFamily: "monospace", fontSize: 10 },
  colInvestor: { minWidth: 90, background: "#fef3c7", fontWeight: "bold", color: "#92400e", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontFamily: "monospace", fontSize: 10 },
  colPaid: { minWidth: 90, background: "#e8f5e9", color: "#1b5e20", fontWeight: "bold", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontFamily: "monospace", fontSize: 10 },

  // phase column headers
  phDesignH: { background: "#7c3aed", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },
  phOffplanH: { background: "#1d4ed8", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },
  phConstructionH: { background: "#15803d", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },
  phHandoverH: { background: "#b45309", color: "#fff", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontWeight: "bold", fontSize: 11 },

  // phase month sub-headers
  phDesignSub: { background: "#ede9fe", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },
  phOffplanSub: { background: "#dbeafe", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },
  phConstructionSub: { background: "#dcfce7", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },
  phHandoverSub: { background: "#fef3c7", padding: "4px 6px", border: "1px solid #ccc", whiteSpace: "nowrap" as const, textAlign: "center" as const, fontSize: 10 },

  // data cells
  numCell: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  numCellDesign: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#ede9fe" },
  numCellOffplan: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#dbeafe" },
  numCellConstruction: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#dcfce7" },
  numCellHandover: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#fef3c7" },
  numCellEscrow: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#dbeafe" },
  numCellValue: { fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const, background: "#fffbeb" },

  // section header row
  sectionHeader: { background: "#e2e8f0", fontWeight: "bold", fontSize: 11, color: "#334155", textAlign: "right" as const, padding: "4px 6px", border: "1px solid #ccc" },

  // total row
  totalRow: { background: "#1a1a2e", color: "#fff", fontWeight: "bold", fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  totalRowDesc: { background: "#1a1a2e", color: "#fff", fontWeight: "bold", padding: "4px 6px", border: "1px solid #ccc", textAlign: "right" as const, whiteSpace: "nowrap" as const, position: "sticky" as const, right: 0, zIndex: 2 },
  totalRowNum: { background: "#1a1a2e", color: "#fbbf24", fontFamily: "monospace", fontSize: 10, padding: "4px 6px", border: "1px solid #ccc", textAlign: "center" as const, whiteSpace: "nowrap" as const },

  // cumulative row
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

  const moQuery = trpc.marketOverview.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId, staleTime: 5000 });
  const cpQuery = trpc.competitionPricing.getByProject.useQuery(selectedProjectId || 0, { enabled: !!selectedProjectId, staleTime: 5000 });

  const projectCosts = useMemo(() => {
    if (!selectedProject) return null;
    return calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data);
  }, [selectedProject, moQuery.data, cpQuery.data]);

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

  // Durations from project or defaults
  const durations: PhaseDurations = useMemo(() => {
    if (selectedProject?.designMonths || selectedProject?.constructionMonths) {
      return {
        design: selectedProject.designMonths || DEFAULT_DURATIONS.design,
        offplan: 2,
        construction: selectedProject.constructionMonths || DEFAULT_DURATIONS.construction,
        handover: selectedProject.handoverMonths || DEFAULT_DURATIONS.handover,
      };
    }
    return { ...DEFAULT_DURATIONS };
  }, [selectedProject]);

  const phases = useMemo(() => calculatePhases(durations), [durations]);
  const totalMonths = useMemo(() => getTotalMonths(durations), [durations]);

  // Investor expenses + distributions
  const investorExpenses = useMemo(() => getInvestorExpenses(projectCosts || undefined, scenario), [projectCosts, scenario]);
  const escrowExpenses = useMemo(() => getEscrowExpenses(projectCosts || undefined, scenario), [projectCosts, scenario]);

  const defaultRevenue = useMemo(() => getDefaultRevenue(phases, durations, projectCosts?.totalRevenue), [phases, durations, projectCosts]);

  const investorMonthly = useMemo(() => {
    return investorExpenses.map(item => {
      if (item.behavior === "FIXED_ABSOLUTE") return {};
      if (item.behavior === "CUSTOM" && !item.customDistribution) {
        return getDefaultCustomDistribution(item.id, phases, durations, projectCosts || undefined);
      }
      return distributeExpense(item, phases, durations, defaultRevenue);
    });
  }, [investorExpenses, phases, durations, defaultRevenue, projectCosts]);

  const escrowMonthly = useMemo(() => {
    return escrowExpenses.map(item => {
      if (item.behavior === "CUSTOM" && !item.customDistribution) {
        return getDefaultCustomDistribution(item.id, phases, durations, projectCosts || undefined);
      }
      return distributeExpense(item, phases, durations, defaultRevenue);
    });
  }, [escrowExpenses, phases, durations, defaultRevenue, projectCosts]);

  // Build month columns per phase
  const designMonths = useMemo(() => {
    const start = phases.find(p => p.type === "design")?.startMonth || 1;
    return Array.from({ length: durations.design }, (_, i) => start + i);
  }, [phases, durations]);

  const offplanMonths = useMemo(() => {
    const p = phases.find(p => p.type === "offplan");
    if (!p) return [];
    return Array.from({ length: p.duration }, (_, i) => p.startMonth + i);
  }, [phases]);

  const constructionMonths = useMemo(() => {
    const p = phases.find(p => p.type === "construction");
    if (!p) return [];
    return Array.from({ length: p.duration }, (_, i) => p.startMonth + i);
  }, [phases]);

  const handoverMonths = useMemo(() => {
    const p = phases.find(p => p.type === "handover");
    if (!p || p.duration === 0) return [];
    return Array.from({ length: p.duration }, (_, i) => p.startMonth + i);
  }, [phases]);

  const allMonths = useMemo(() => [...designMonths, ...offplanMonths, ...constructionMonths, ...handoverMonths], [designMonths, offplanMonths, constructionMonths, handoverMonths]);

  // Per-month totals (investor only, for total row)
  const monthInvestorTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    investorExpenses.forEach((item, idx) => {
      if (item.behavior === "FIXED_ABSOLUTE") return;
      const monthly = investorMonthly[idx];
      for (const [mStr, val] of Object.entries(monthly)) {
        const m = parseInt(mStr);
        totals[m] = (totals[m] || 0) + val;
      }
    });
    return totals;
  }, [investorExpenses, investorMonthly]);

  const monthEscrowTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    escrowExpenses.forEach((_, idx) => {
      const monthly = escrowMonthly[idx];
      for (const [mStr, val] of Object.entries(monthly)) {
        const m = parseInt(mStr);
        totals[m] = (totals[m] || 0) + val;
      }
    });
    return totals;
  }, [escrowExpenses, escrowMonthly]);

  const monthAllTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const m of allMonths) {
      totals[m] = (monthInvestorTotals[m] || 0) + (monthEscrowTotals[m] || 0);
    }
    return totals;
  }, [allMonths, monthInvestorTotals, monthEscrowTotals]);

  // Cumulative investor (running sum)
  const cumulativeInvestor = useMemo(() => {
    const landTotal = investorExpenses.filter(e => e.behavior === "FIXED_ABSOLUTE").reduce((s, e) => s + e.total, 0);
    let running = landTotal;
    const cum: Record<number, number> = {};
    for (const m of allMonths) {
      running += (monthInvestorTotals[m] || 0);
      cum[m] = running;
    }
    return { landTotal, monthly: cum };
  }, [allMonths, monthInvestorTotals, investorExpenses]);

  // Grand totals
  const grandTotalCosts = useMemo(() => {
    const investorTotal = investorExpenses.reduce((s, e) => s + e.total, 0);
    const escrowTotal = escrowExpenses.reduce((s, e) => s + e.total, 0);
    return investorTotal + escrowTotal;
  }, [investorExpenses, escrowExpenses]);

  const grandInvestorTotal = useMemo(() => investorExpenses.reduce((s, e) => s + e.total, 0), [investorExpenses]);
  const paidTotal = useMemo(() => investorExpenses.filter(e => e.behavior === "FIXED_ABSOLUTE").reduce((s, e) => s + e.total, 0), [investorExpenses]);

  // Helper: get value for a cell
  function getInvestorVal(itemIdx: number, month: number): number {
    const item = investorExpenses[itemIdx];
    if (item.behavior === "FIXED_ABSOLUTE") return 0;
    return investorMonthly[itemIdx][month] || 0;
  }

  function getEscrowVal(itemIdx: number, month: number): number {
    return escrowMonthly[itemIdx][month] || 0;
  }

  function phaseOf(m: number): "design" | "offplan" | "construction" | "handover" {
    if (designMonths.includes(m)) return "design";
    if (offplanMonths.includes(m)) return "offplan";
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

  if (!selectedProjectId) {
    return (
      <div style={{ padding: 20, textAlign: "center", direction: "rtl" }}>
        <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 16 }}>📊</div>
        <h2 style={{ color: "#9ca3af", fontSize: 18 }}>اختر مشروع لعرض جدولة رأس المال</h2>
      </div>
    );
  }

  // Section groupings
  const landItems = investorExpenses.filter(e => e.phase === "land");
  const designItems = investorExpenses.filter(e => e.phase === "design" || (e.phase !== "land" && e.behavior !== "FIXED_ABSOLUTE" && ["soil_test","survey","design_fee","developer_fee"].includes(e.id)));
  // Sections by id groups matching the HTML
  const section1 = investorExpenses.filter(e => e.behavior === "FIXED_ABSOLUTE"); // paid/land
  const section2 = investorExpenses.filter(e => ["soil_test","survey","gov_fees_design","design_fee","developer_fee","community_fee_design"].includes(e.id) || (e.phase === "design" && e.behavior !== "FIXED_ABSOLUTE" && e.table === "investor"));
  const section3 = investorExpenses.filter(e => ["fraz_fee","rera_registration","rera_units","surveyor_fee","noc_fee","escrow_fee","community_fee","escrow_deposit","contractor_20pct_m1","contractor_20pct_m2","contractor_20pct_m3"].includes(e.id));
  const section4 = investorExpenses.filter(e => ["contractor_advance","bank_fees","contingency","marketing"].includes(e.id));
  const section5 = escrowExpenses; // escrow items

  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, sans-serif", fontSize: 11, background: "#f5f5f5", padding: embedded ? 8 : 20 }}>
      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4, color: "#1a1a2e" }}>
          جدولة رأس المال — {selectedProject?.name || "المشروع"}
        </h2>
        <p style={{ fontSize: 11, color: "#666" }}>مسودة توزيع المصاريف على المراحل الزمنية | المبالغ بالدرهم الإماراتي</p>
      </div>

      {/* Scenario selector */}
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

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%", background: "#fff" }}>
          {/* ── HEADER ROW 1: Phase spans ── */}
          <thead>
            <tr>
              <th style={{ ...S.hPhase, ...S.colDesc }}>البند</th>
              <th style={S.hPhase}>إجمالي التكاليف</th>
              <th style={S.hPhase}>رأس المال المطلوب</th>
              <th style={S.hPhase}>مدفوع</th>
              {designMonths.length > 0 && (
                <th style={S.phDesignH} colSpan={designMonths.length}>
                  المرحلة 2 — التصاميم ({durations.design} أشهر)
                </th>
              )}
              {offplanMonths.length > 0 && (
                <th style={S.phOffplanH} colSpan={offplanMonths.length}>
                  المرحلة 3 — أوف بلان ({durations.offplan} شهر)
                </th>
              )}
              {constructionMonths.length > 0 && (
                <th style={S.phConstructionH} colSpan={constructionMonths.length}>
                  المرحلة 4 — الإنشاء ({durations.construction} شهر)
                </th>
              )}
              {handoverMonths.length > 0 && (
                <th style={S.phHandoverH} colSpan={handoverMonths.length}>
                  المرحلة 5 — التسليم ({durations.handover} شهر)
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
            {section1.map((item, idx) => (
              <tr key={item.id}>
                <td style={S.colDesc}>{item.name}</td>
                <td style={S.colTotal}>{fmt(item.total)}</td>
                <td style={S.colInvestor}>{fmt(item.total)}</td>
                <td style={S.colPaid}>{fmt(item.total)}</td>
                {allMonths.map(m => (
                  <td key={m} style={{ ...cellStyle(m), color: "#ccc" }}>—</td>
                ))}
              </tr>
            ))}

            {/* ── SECTION 2: DESIGN ── */}
            <tr>
              <td colSpan={4 + allMonths.length} style={S.sectionHeader}>القسم الثاني — التصاميم ورخصة البناء</td>
            </tr>
            {section2.map((item) => {
              const idx = investorExpenses.findIndex(e => e.id === item.id);
              const rowTotal = Object.values(investorMonthly[idx] || {}).reduce((s, v) => s + v, 0);
              return (
                <tr key={item.id}>
                  <td style={S.colDesc}>{item.name}</td>
                  <td style={S.colTotal}>{fmt(item.total)}</td>
                  <td style={S.colInvestor}>{fmt(item.total)}</td>
                  <td style={S.colPaid}>—</td>
                  {allMonths.map(m => {
                    const val = getInvestorVal(idx, m);
                    return <td key={m} style={numStyle(m, val)}>{fmt(val)}</td>;
                  })}
                </tr>
              );
            })}

            {/* ── SECTION 3: OFFPLAN / RERA ── */}
            {section3.length > 0 && (
              <>
                <tr>
                  <td colSpan={4 + allMonths.length} style={S.sectionHeader}>القسم الثالث — ريرا والبيع أوف بلان</td>
                </tr>
                {section3.map((item) => {
                  const idx = investorExpenses.findIndex(e => e.id === item.id);
                  return (
                    <tr key={item.id}>
                      <td style={S.colDesc}>{item.name}</td>
                      <td style={S.colTotal}>{fmt(item.total)}</td>
                      <td style={S.colInvestor}>{fmt(item.total)}</td>
                      <td style={S.colPaid}>—</td>
                      {allMonths.map(m => {
                        const val = getInvestorVal(idx, m);
                        return <td key={m} style={numStyle(m, val)}>{fmt(val)}</td>;
                      })}
                    </tr>
                  );
                })}
              </>
            )}

            {/* ── SECTION 4: CONSTRUCTION (investor) ── */}
            <tr>
              <td colSpan={4 + allMonths.length} style={S.sectionHeader}>القسم الرابع — الإنشاء (حصة المستثمر فقط)</td>
            </tr>
            {section4.map((item) => {
              const idx = investorExpenses.findIndex(e => e.id === item.id);
              return (
                <tr key={item.id}>
                  <td style={S.colDesc}>{item.name}</td>
                  <td style={S.colTotal}>{fmt(item.total)}</td>
                  <td style={S.colInvestor}>{fmt(item.total)}</td>
                  <td style={S.colPaid}>—</td>
                  {allMonths.map(m => {
                    const val = getInvestorVal(idx, m);
                    return <td key={m} style={numStyle(m, val)}>{fmt(val)}</td>;
                  })}
                </tr>
              );
            })}

            {/* ── SECTION 5: ESCROW ── */}
            {section5.length > 0 && (
              <>
                <tr>
                  <td colSpan={4 + allMonths.length} style={S.sectionHeader}>من حساب الضمان (تُدفع من إيرادات المشترين)</td>
                </tr>
                {section5.map((item, idx) => (
                  <tr key={item.id}>
                    <td style={S.colDesc}>{item.name}</td>
                    <td style={S.colTotal}>{fmt(item.total)}</td>
                    <td style={{ ...S.colInvestor, color: "#1d4ed8" }}>من الضمان</td>
                    <td style={S.colPaid}>—</td>
                    {allMonths.map(m => {
                      const val = getEscrowVal(idx, m);
                      return <td key={m} style={numStyle(m, val, true)}>{fmt(val)}</td>;
                    })}
                  </tr>
                ))}
              </>
            )}

            {/* ── TOTAL ROW ── */}
            <tr>
              <td style={S.totalRowDesc}>إجمالي الشهر</td>
              <td style={S.totalRow}>{fmt(grandTotalCosts)}</td>
              <td style={S.totalRow}>{fmt(grandInvestorTotal)}</td>
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
        • هذه مسودة — الأرقام قابلة للتعديل
      </div>
    </div>
  );
}
