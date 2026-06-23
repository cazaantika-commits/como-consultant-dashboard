# Analysis: Data Flow Comparison

## ExcelCashFlowPage (المستثمر)
- Fetches: projects.list, marketOverview.getByProject, competitionPricing.getByProject
- Calculates: calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data)
- Uses: getInvestorExpenses(projectCosts)
- Revenue: getDefaultRevenue(phases, durations, projectCosts?.totalRevenue)
- ✅ Dynamic from project card

## EscrowCashFlowPage (الإسكرو)
- Fetches: projects.list, marketOverview.getByProject, competitionPricing.getByProject
- Calculates: calculateProjectCosts(selectedProject, moQuery.data, cpQuery.data)
- Uses: getEscrowExpenses(projectCosts)
- Revenue: getDefaultRevenue(phases, durations, projectCosts?.totalRevenue)
- ✅ Dynamic from project card

## FinancialCommandCenter (مركز القيادة المالي)
- Fetches: projects.list, marketOverview.getByProject(firstProjectId), competitionPricing.getByProject(firstProjectId)
- **BUG**: Only fetches MO/CP for firstProjectId, all other projects get `null` for MO/CP
- Calculates: calcCosts(p, p.id === firstProjectId ? moQuery.data : null, ...)
- **BUG**: For non-first projects, costs will be null → falls back to hardcoded SALES_VALUE/CONSTRUCTION_COST
- Uses: calculateProjectCashFlow(config, projectCostsMap[config.projectId])
- ✅ For first project: dynamic
- ❌ For other projects: hardcoded fallback

## Root Cause
The FinancialCommandCenter only fetches market overview and competition pricing for the FIRST project.
For all other projects, it passes null to calcCosts, which means:
- If calcCosts returns null (when project exists but no MO data), it won't be in projectCostsMap
- calculateProjectCashFlow will use undefined costs → falls back to hardcoded values

## Fix
Need to fetch MO and CP for ALL projects, not just the first one.
