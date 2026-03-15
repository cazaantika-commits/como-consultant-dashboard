/**
 * CPA True Cost Report — HTML/Print Route
 * GET /api/cpa/report/:projectId
 *
 * Generates a printable HTML report identical in structure to the Claude TrueCost report.
 * Sections:
 *   1. Design Fee Analysis (per consultant)
 *   2. Supervision Fee Analysis (per consultant)
 *   3. Final Ranking Table
 */

import { Router } from "express";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

const router = Router();

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function fmtAED(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "AED " + new Intl.NumberFormat("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n + "%";
}

async function qRows<T = Record<string, unknown>>(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  query: ReturnType<typeof sql>
): Promise<T[]> {
  const result = await db.execute(query);
  return (result[0] as unknown as T[]) ?? [];
}

router.get("/:projectId", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(503).send("Database unavailable");

    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) return res.status(400).send("Invalid project ID");

    // ---- Project info ----
    const projects = await qRows<any>(
      db,
      sql`SELECT p.*, bc.code as cat_code, bc.label as cat_label
          FROM cpa_projects p
          LEFT JOIN cpa_building_categories bc ON bc.id = p.building_category_id
          WHERE p.id = ${projectId}`
    );
    if (!projects[0]) return res.status(404).send("Project not found");
    const proj = projects[0];
    const totalCC = toNum(proj.bua_sqft) * toNum(proj.construction_cost_per_sqft);
    const durationMonths = toNum(proj.duration_months);

    // ---- Mandatory scope items ----
    // Only show add-on scope items (29-43) — items 1-28 are base design scope
    // and are implicitly included in any proposal, not tracked as gaps
    const mandatoryItems = await qRows<any>(
      db,
      sql`SELECT si.id, si.item_number, si.code, si.label,
                 COALESCE(src.cost_aed, 0) as ref_cost
          FROM cpa_scope_category_matrix scm
          JOIN cpa_scope_items si ON si.id = scm.scope_item_id
          LEFT JOIN cpa_scope_reference_costs src
            ON src.scope_item_id = scm.scope_item_id
            AND src.building_category_id = scm.building_category_id
          WHERE scm.building_category_id = ${proj.building_category_id}
            AND scm.status IN ('INCLUDED', 'GREEN')
            AND si.item_number BETWEEN 29 AND 43
          ORDER BY si.item_number`
    );

    // ---- Supervision baseline ----
    const supervisionBaseline = await qRows<any>(
      db,
      sql`SELECT sb.supervision_role_id, sb.required_allocation_pct,
                 sr.code, sr.label, sr.monthly_rate_aed
          FROM cpa_supervision_baseline sb
          JOIN cpa_supervision_roles sr ON sr.id = sb.supervision_role_id
          WHERE sb.building_category_id = ${proj.building_category_id}
            AND sb.required_allocation_pct > 0
          ORDER BY sr.sort_order`
    );

    // ---- Evaluation results ----
    const results = await qRows<any>(
      db,
      sql`SELECT er.*, er.eval_rank as result_rank,
                 pc.consultant_id, cm.legal_name, cm.trade_name, cm.code as consultant_code,
                 pc.design_fee_method, pc.design_fee_amount, pc.design_fee_percentage,
                 pc.supervision_fee_method, pc.supervision_fee_amount, pc.supervision_fee_percentage,
                 pc.supervision_stated_duration_months, pc.supervision_submitted,
                 pc.proposal_reference, pc.proposal_date
          FROM cpa_evaluation_results er
          JOIN cpa_project_consultants pc ON pc.id = er.project_consultant_id
          JOIN cpa_consultants_master cm ON cm.id = pc.consultant_id
          WHERE pc.cpa_project_id = ${projectId}
          ORDER BY COALESCE(er.eval_rank, 999), er.total_true_cost`
    );

    if (results.length === 0) return res.status(404).send("No evaluation results found. Please run the calculation first.");

    // Parse calculation_notes for each result
    for (const r of results) {
      try {
        r.notes = r.calculation_notes ? JSON.parse(r.calculation_notes) : { scopeGaps: [], supervisionGaps: [] };
      } catch {
        r.notes = { scopeGaps: [], supervisionGaps: [] };
      }
    }

    // ---- Build scope coverage maps per consultant ----
    const allPcIds = results.map((r: any) => r.project_consultant_id);
    const scopeCoverageAll: Record<number, Record<number, string>> = {};
    for (const pcId of allPcIds) {
      const rows = await qRows<any>(
        db,
        sql`SELECT csc.scope_item_id, csc.coverage_status
            FROM cpa_consultant_scope_coverage csc
            WHERE csc.project_consultant_id = ${pcId}`
      );
      scopeCoverageAll[pcId] = {};
      for (const row of rows) {
        scopeCoverageAll[pcId][Number(row.scope_item_id)] = String(row.coverage_status);
      }
    }

    // ---- Build supervision team maps per consultant ----
    const supTeamAll: Record<number, Record<number, any>> = {};
    for (const pcId of allPcIds) {
      const rows = await qRows<any>(
        db,
        sql`SELECT cst.supervision_role_id, cst.proposed_allocation_pct, cst.proposed_monthly_rate
            FROM cpa_consultant_supervision_team cst
            WHERE cst.project_consultant_id = ${pcId}`
      );
      supTeamAll[pcId] = {};
      for (const row of rows) {
        supTeamAll[pcId][Number(row.supervision_role_id)] = row;
      }
    }

    const rankable = results.filter((r: any) => r.can_rank === 1);
    const unrankable = results.filter((r: any) => r.can_rank !== 1);
    const lowestCost = rankable.length > 0 ? Math.min(...rankable.map((r: any) => toNum(r.total_true_cost))) : 0;

    // ---- Helper: design method label ----
    function designMethodLabel(r: any): string {
      if (r.design_fee_method === "LUMP_SUM") return "LUMP_SUM";
      if (r.design_fee_method === "PERCENTAGE") {
        const pct = toNum(r.design_fee_percentage);
        return `PERCENTAGE (${pct}% of CC)`;
      }
      return r.design_fee_method ?? "—";
    }

    function supMethodLabel(r: any): string {
      if (!r.supervision_submitted) return "لم يُقدَّم";
      if (r.supervision_fee_method === "LUMP_SUM") {
        const stated = r.supervision_stated_duration_months;
        return stated ? `LUMP_SUM — stated ${stated} months` : "LUMP_SUM";
      }
      if (r.supervision_fee_method === "PERCENTAGE") {
        const pct = toNum(r.supervision_fee_percentage);
        return `PERCENTAGE (${pct}% of CC)`;
      }
      return r.supervision_fee_method ?? "—";
    }

    // ---- HTML Generation ----
    const now = new Date().toLocaleDateString("en-AE", { year: "numeric", month: "long", day: "numeric" });

    let html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>True Cost Report — ${proj.name || "Project " + projectId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; background: #fff; }
  .page { max-width: 900px; margin: 0 auto; padding: 32px 40px; }
  
  /* Header */
  .report-header { text-align: center; border-bottom: 3px solid #1a3a5c; padding-bottom: 20px; margin-bottom: 28px; }
  .report-header .company { font-size: 18pt; font-weight: 700; color: #1a3a5c; letter-spacing: 1px; }
  .report-header .title { font-size: 13pt; color: #444; margin-top: 4px; }
  .report-header .subtitle { font-size: 10pt; color: #666; margin-top: 6px; }
  .report-header .meta-table { margin: 16px auto 0; border-collapse: collapse; }
  .report-header .meta-table td { padding: 4px 20px; font-size: 10pt; }
  .report-header .meta-table .label { color: #888; font-weight: 600; text-transform: uppercase; font-size: 8pt; }
  .report-header .meta-table .value { color: #1a1a1a; font-weight: 700; font-size: 11pt; }

  /* Section headings */
  .section-title { background: #1a3a5c; color: #fff; padding: 8px 16px; font-size: 12pt; font-weight: 700; margin: 32px 0 20px; border-radius: 4px; }
  .consultant-title { font-size: 12pt; font-weight: 700; color: #1a3a5c; border-bottom: 2px solid #e0e8f0; padding-bottom: 6px; margin: 24px 0 12px; }
  .consultant-title span { font-size: 9pt; color: #888; font-weight: 400; margin-left: 8px; }

  /* Warning banner */
  .warning { background: #fff8e1; border-left: 4px solid #f59e0b; padding: 8px 12px; font-size: 9.5pt; color: #92400e; margin-bottom: 12px; border-radius: 0 4px 4px 0; }
  .excluded-notice { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 8px 12px; font-size: 9.5pt; color: #0369a1; margin-bottom: 12px; border-radius: 0 4px 4px 0; }

  /* Info row */
  .info-row { display: flex; gap: 24px; margin-bottom: 12px; font-size: 10pt; }
  .info-row .item { }
  .info-row .item .lbl { color: #888; font-size: 8.5pt; text-transform: uppercase; font-weight: 600; }
  .info-row .item .val { font-weight: 700; color: #1a1a1a; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 12px; }
  th { background: #f0f4f8; color: #1a3a5c; font-weight: 700; padding: 7px 10px; text-align: left; border: 1px solid #d0dce8; }
  td { padding: 6px 10px; border: 1px solid #e8eef4; vertical-align: top; }
  tr:nth-child(even) td { background: #fafbfc; }
  .included { color: #16a34a; font-weight: 600; }
  .excluded { color: #dc2626; font-weight: 600; }
  .gap-cost { color: #dc2626; }
  .subtotal-row td { background: #f0f4f8 !important; font-weight: 700; border-top: 2px solid #d0dce8; }
  .total-row td { background: #1a3a5c !important; color: #fff !important; font-weight: 700; font-size: 10.5pt; }
  .total-row td.amount { font-size: 12pt; }

  /* Ranking table */
  .rank-table th { background: #1a3a5c; color: #fff; }
  .rank-1 td { background: #fefce8 !important; }
  .rank-2 td { background: #f8fafc !important; }
  .rank-badge { display: inline-block; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 700; font-size: 10pt; }
  .rank-1 .rank-badge { background: #f59e0b; color: #fff; }
  .rank-2 .rank-badge { background: #94a3b8; color: #fff; }
  .rank-3 .rank-badge { background: #cd7c3a; color: #fff; }
  .rank-n .rank-badge { background: #e2e8f0; color: #64748b; }

  /* Footer */
  .report-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e8f0; text-align: center; font-size: 8.5pt; color: #999; }

  @media print {
    .page { padding: 16px 24px; }
    .section-title { break-before: page; }
    .consultant-block { break-inside: avoid; }
    @page { margin: 1cm; }
  }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #1a3a5c; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 10pt; font-weight: 600; z-index: 1000; }
  .print-btn:hover { background: #2563eb; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
<div class="page">

<!-- HEADER -->
<div class="report-header">
  <div class="company">COMO REAL ESTATE DEVELOPMENT</div>
  <div class="title">Engineering Consultancy Evaluation — True Cost Report</div>
  <div class="subtitle">${proj.name || "Project " + projectId} | ${now} | Confidential</div>
  <table class="meta-table">
    <tr>
      <td><div class="label">BUA</div><div class="value">${new Intl.NumberFormat("en-AE").format(toNum(proj.bua_sqft))} sqft</div></td>
      <td><div class="label">Construction Cost</div><div class="value">${fmtAED(totalCC)}</div></td>
      <td><div class="label">Duration</div><div class="value">${durationMonths} months</div></td>
      <td><div class="label">Category</div><div class="value">${proj.cat_label || proj.cat_code || "—"}</div></td>
    </tr>
  </table>
</div>

<!-- SECTION 1: DESIGN FEE ANALYSIS -->
<div class="section-title">SECTION 1 — DESIGN FEE ANALYSIS</div>
`;

    // Design fee section for each consultant
    for (const r of results) {
      const pcId = r.project_consultant_id;
      const coverageMap = scopeCoverageAll[pcId] || {};
      const name = r.trade_name || r.legal_name;
      const code = r.consultant_code;

      let quotedDesign = toNum(r.quoted_design_fee);
      let scopeGap = toNum(r.design_scope_gap_cost);
      let trueDesign = toNum(r.true_design_fee);

      html += `<div class="consultant-block">
<div class="consultant-title">${name} <span>(${code})</span></div>
<div class="info-row">
  <div class="item"><div class="lbl">Pricing Method</div><div class="val">${designMethodLabel(r)}</div></div>
  <div class="item"><div class="lbl">Quoted Design Fee</div><div class="val">${fmtAED(quotedDesign)}</div></div>
</div>

<table>
  <thead><tr><th>#</th><th>Scope Item</th><th>Status</th><th>Reference Cost (${proj.cat_label || ""})</th></tr></thead>
  <tbody>`;

      for (const item of mandatoryItems) {
        const status = coverageMap[item.id] ?? "NOT_MENTIONED";
        const isIncluded = status === "INCLUDED";
        const refCost = toNum(item.ref_cost);
        html += `<tr>
      <td>${item.item_number}</td>
      <td>${item.label}</td>
      <td class="${isIncluded ? "included" : "excluded"}">${isIncluded ? "✅ Included" : "❌ Excluded — Gap added"}</td>
      <td class="${isIncluded ? "" : "gap-cost"}">${refCost > 0 ? fmtAED(refCost) : "—"}</td>
    </tr>`;
      }

      html += `<tr class="subtotal-row">
      <td colspan="3"><strong>Total Design Gap Cost</strong></td>
      <td><strong>${fmtAED(scopeGap)}</strong></td>
    </tr>
    <tr class="total-row">
      <td colspan="3" class="amount"><strong>TRUE DESIGN FEE</strong></td>
      <td class="amount"><strong>${fmtAED(trueDesign)}</strong></td>
    </tr>
  </tbody>
</table>
</div>`;
    }

    // SECTION 2: SUPERVISION FEE ANALYSIS
    html += `<div class="section-title">SECTION 2 — SUPERVISION FEE ANALYSIS</div>`;

    for (const r of results) {
      const pcId = r.project_consultant_id;
      const name = r.trade_name || r.legal_name;
      const code = r.consultant_code;
      const teamMap = supTeamAll[pcId] || {};

      html += `<div class="consultant-block">
<div class="consultant-title">${name} <span>(${code})</span></div>`;

      if (!r.supervision_submitted) {
        html += `<div class="excluded-notice">⚠ DESIGN ONLY — No supervision fee submitted. Excluded from main ranking.</div>`;
        html += `</div>`;
        continue;
      }

      // RE part-time warning
      const reBaseline = supervisionBaseline.find((b: any) => b.code === "RE");
      if (reBaseline) {
        const reTeamEntry = Object.values(teamMap).find((t: any) => {
          // find by role_id matching RE
          return Number(t.supervision_role_id) === Number(reBaseline.supervision_role_id);
        });
        const reProposed = reTeamEntry ? toNum((reTeamEntry as any).proposed_allocation_pct) : 0;
        if (reProposed > 0 && reProposed < 100) {
          html += `<div class="warning">⚠ RE PART-TIME WARNING — Resident Engineer proposed at less than 100% allocation. This is a SOI violation.</div>`;
        }
      }

      const quotedSup = toNum(r.quoted_supervision_fee);
      const supGap = toNum(r.supervision_gap_cost);
      const adjSup = toNum(r.adjusted_supervision_fee);
      const statedDuration = r.supervision_stated_duration_months ? toNum(r.supervision_stated_duration_months) : null;
      const adjFactor = statedDuration && statedDuration < durationMonths ? durationMonths / statedDuration : 1;

      html += `<div class="info-row">
  <div class="item"><div class="lbl">Pricing Method</div><div class="val">${supMethodLabel(r)}</div></div>
  <div class="item"><div class="lbl">Quoted Supervision Fee</div><div class="val">${fmtAED(quotedSup)}</div></div>
</div>`;

      if (adjFactor > 1 && statedDuration) {
        const originalFee = quotedSup / adjFactor;
        const adjAmount = quotedSup - originalFee;
        html += `<div class="info-row">
  <div class="item"><div class="lbl">Duration Adjustment (${statedDuration}m → ${durationMonths}m)</div><div class="val" style="color:#f59e0b">+ ${fmtAED(adjAmount)}</div></div>
  <div class="item"><div class="lbl">Adjusted Quoted Fee (after duration)</div><div class="val">${fmtAED(quotedSup)}</div></div>
</div>`;
      } else {
        html += `<div class="info-row">
  <div class="item"><div class="lbl">Adjusted Quoted Fee (after duration)</div><div class="val">${fmtAED(quotedSup)}</div></div>
</div>`;
      }

      // Team gap table
      html += `<table>
  <thead>
    <tr>
      <th>Role</th>
      <th>Baseline %</th>
      <th>Proposed %</th>
      <th>Gap %</th>
      <th>Ref Rate/Month</th>
      <th>Gap Cost (AED)</th>
    </tr>
  </thead>
  <tbody>`;

      for (const baseline of supervisionBaseline) {
        const roleId = Number(baseline.supervision_role_id);
        const required = toNum(baseline.required_allocation_pct);
        const teamEntry = teamMap[roleId];
        const rawProposed = toNum(teamEntry?.proposed_allocation_pct ?? 0);
        const proposed = (rawProposed === 0 && teamEntry?.proposed_monthly_rate) ? required : rawProposed;
        const gapPct = Math.max(0, required - proposed);
        const rateToUse = r.supervision_fee_method === "MONTHLY_RATE" && teamEntry?.proposed_monthly_rate
          ? toNum(teamEntry.proposed_monthly_rate)
          : toNum(baseline.monthly_rate_aed);
        const gapCost = rateToUse * durationMonths * (gapPct / 100);

        const proposedLabel = teamEntry ? fmtPct(proposed) : `<span style="color:#999">Not mentioned</span>`;

        html += `<tr>
      <td><strong>${baseline.code}</strong></td>
      <td>${fmtPct(required)}</td>
      <td>${proposedLabel}</td>
      <td class="${gapPct > 0 ? "gap-cost" : "included"}">${gapPct > 0 ? fmtPct(gapPct) : "—"}</td>
      <td>${fmtAED(toNum(baseline.monthly_rate_aed))}</td>
      <td class="${gapCost > 0 ? "gap-cost" : ""}">${gapCost > 0 ? fmtAED(gapCost) : "—"}</td>
    </tr>`;
      }

      html += `<tr class="subtotal-row">
      <td colspan="5"><strong>Total Team Gap Cost</strong></td>
      <td><strong>${fmtAED(supGap)}</strong></td>
    </tr>
    <tr class="total-row">
      <td colspan="5" class="amount"><strong>ADJUSTED SUPERVISION FEE</strong></td>
      <td class="amount"><strong>${fmtAED(adjSup)}</strong></td>
    </tr>
  </tbody>
</table>
</div>`;
    }

    // SECTION 3: FINAL RANKING
    html += `<div class="section-title">SECTION 3 — TOTAL TRUE COST — FINAL RANKING</div>`;

    html += `<table class="rank-table">
  <thead>
    <tr>
      <th>Rank</th>
      <th>Consultant</th>
      <th>True Design Fee (AED)</th>
      <th>Adj. Supervision Fee (AED)</th>
      <th>Total True Cost (AED)</th>
      <th>vs. Cheapest</th>
    </tr>
  </thead>
  <tbody>`;

    for (const r of rankable) {
      const diff = toNum(r.total_true_cost) - lowestCost;
      const rankClass = r.result_rank === 1 ? "rank-1" : r.result_rank === 2 ? "rank-2" : r.result_rank === 3 ? "rank-3" : "rank-n";
      html += `<tr class="${rankClass}">
      <td><span class="rank-badge">${r.result_rank}</span></td>
      <td><strong>${r.trade_name || r.legal_name}</strong><br/><span style="color:#888;font-size:8.5pt">${r.consultant_code}</span></td>
      <td>${fmtAED(toNum(r.true_design_fee))}</td>
      <td>${fmtAED(toNum(r.adjusted_supervision_fee))}</td>
      <td><strong>${fmtAED(toNum(r.total_true_cost))}</strong></td>
      <td>${r.result_rank === 1 ? "<strong style='color:#16a34a'>Lowest True Cost</strong>" : `<span style='color:#dc2626'>+ ${fmtAED(diff)}</span>`}</td>
    </tr>`;
    }

    html += `</tbody></table>`;

    if (unrankable.length > 0) {
      html += `<div class="warning" style="margin-top:20px">⚠ The following consultants submitted DESIGN FEES ONLY. They are excluded from the main ranking as no supervision fee was provided.</div>
<table>
  <thead>
    <tr>
      <th>Consultant</th>
      <th>Quoted Design Fee (AED)</th>
      <th>True Design Fee (AED)</th>
      <th>Missing Design Gap (AED)</th>
    </tr>
  </thead>
  <tbody>`;
      for (const r of unrankable) {
        html += `<tr>
      <td><strong>${r.trade_name || r.legal_name}</strong> <span style="color:#888">(${r.consultant_code})</span></td>
      <td>${fmtAED(toNum(r.quoted_design_fee))}</td>
      <td>${fmtAED(toNum(r.true_design_fee))}</td>
      <td class="gap-cost">${fmtAED(toNum(r.design_scope_gap_cost))}</td>
    </tr>`;
      }
      html += `</tbody></table>`;
    }

    html += `
<div class="report-footer">
  COMO Real Estate Development | True Cost Evaluation Report | ${proj.name || "Project " + projectId} | ${now} | Confidential
</div>
</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    console.error("[CPA Report]", err);
    res.status(500).send("Error generating report: " + err.message);
  }
});

export default router;
