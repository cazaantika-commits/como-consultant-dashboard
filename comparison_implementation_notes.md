# Implementation Notes for Engine Comparison Page

## Backend: New tRPC procedure in cashFlowSettings.ts

Insert BEFORE the closing `});` at line 2389.

```ts
  getEngineComparison: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new Error("Unauthorized");
    const db = await getDb();
    if (!db) return [];
    
    const allProjects = await db.select().from(projects);
    const [allMo, allCp] = await Promise.all([
      db.select().from(marketOverview),
      db.select().from(competitionPricing),
    ]);
    const moByProject = new Map(); // projectId -> mo row
    const cpByProject = new Map(); // projectId -> cp row
    for (const row of allMo) moByProject.set(row.projectId, row);
    for (const row of allCp) cpByProject.set(row.projectId, row);
    
    const results = [];
    for (const project of allProjects) {
      const mo = moByProject.get(project.id) || null;
      const cp = cpByProject.get(project.id) || null;
      
      // OLD ENGINE
      const oldCosts = calculateProjectCosts(project, mo, cp);
      if (!oldCosts) continue;
      const legacyDurations = { preCon: project.preConMonths || 6, construction: project.constructionMonths || 16, handover: project.handoverMonths || 2 };
      const durations = legacyToNewDurations(legacyDurations);
      const totalMonths = getTotalMonths(durations);
      // Build old totals using getDefaultItemDefs + computeItemAmount for default scenario
      const scenario = (project.financingScenario || "offplan_escrow") as Scenario;
      const phases = calculatePhases(durations, 0, scenario);
      let oldInvestorTotal = 0, oldEscrowTotal = 0;
      const oldSectionTotals: Record<string, number> = {};
      const oldItems: Array<{key: string, name: string, amount: number, source: string, section: string}> = [];
      for (const def of getDefaultItemDefs(scenario)) {
        const amount = computeItemAmount(def, oldCosts);
        const effectiveSource = scenario === "no_offplan" ? "investor" : def.fundingSource;
        if (effectiveSource === "investor") oldInvestorTotal += amount;
        else oldEscrowTotal += amount;
        oldSectionTotals[def.section] = (oldSectionTotals[def.section] || 0) + amount;
        oldItems.push({ key: def.itemKey, name: def.nameAr, amount, source: effectiveSource, section: def.section });
      }
      
      // NEW ENGINE
      const inputs = projectToInputs(project, { approvedRevenue: mo?.approvedRevenue }, totalUnitsFromMo, oldCosts.totalRevenue);
      const newResult = computeFullFinancials(inputs);
      const adapted = adaptToPortfolioShape(newResult, inputs);
      
      results.push({
        projectId: project.id,
        name: project.name,
        scenario,
        old: { investorTotal: oldInvestorTotal, escrowTotal: oldEscrowTotal, grandTotal: oldInvestorTotal + oldEscrowTotal, sectionTotals: oldSectionTotals, items: oldItems, totalRevenue: oldCosts.totalRevenue },
        new: { investorTotal: adapted.investorTotal, escrowTotal: adapted.escrowTotal, grandTotal: adapted.grandTotal, sectionTotals: adapted.sectionTotals, totalRevenue: newResult.costs.totalRevenue },
        // item-level comparison from new engine
        newItems: [...newResult.investorCashFlow, ...newResult.escrowCashFlow].map(item => ({
          key: item.id, name: item.name, amount: item.total, source: item.table, section: getItemSection(item.id, inputs.financingScenario)
        })),
      });
    }
    return results;
  }),
```

## Key imports needed at top of cashFlowSettings.ts:
```ts
import { computeFullFinancials, projectToInputs } from "../financialEngine";
import { adaptToPortfolioShape } from "../financialEngineAdapter";
```

## Frontend: EngineComparisonPage.tsx

- Route: `/engine-comparison`
- Shows all projects in a table
- For each project: old total vs new total with diff %
- Expandable rows showing item-by-item comparison
- Color coding: green (<1% diff), yellow (1-5%), red (>5%)

## App.tsx changes:
- Add import: `import EngineComparisonPage from "./pages/EngineComparisonPage";`
- Add route: `<Route path="/engine-comparison" component={EngineComparisonPage} />`
