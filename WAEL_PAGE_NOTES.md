# Wael Page Rebuild Notes

## What Wael is responsible for (from INPUTS_ARCHITECTURE.md):
- التسعير (unit types, counts, areas, price/sqft)
- خطة المبيعات (sales curve - monthly distribution)
- نسبة التسويق والعمولة (marketing %, commission %)
- خطة الدفع للمشترين (payment plan: booking, construction, handover)
- مواد الدعاية (advertising materials, campaigns, channels)
- توزيع القنوات التسويقية (digital, outdoor, events, broker, PR, content)

## Data Sources:
1. **Unit pricing** → `projects` table fields:
   - residential1brCount/Area/Price, residential2brCount/Area/Price, residential3brCount/Area/Price
   - retailSmallCount/Area/Price, retailMediumCount/Area/Price, retailLargeCount/Area/Price
   - officeSmallCount/Area/Price, officeMediumCount/Area/Price, officeLargeCount/Area/Price
   - salesCommissionPct, marketingPct (in projects table at line 1135-1136)

2. **Sales plan** → `wael_sales_plans` table:
   - totalRevenue (computed from pricing), offplanPct (80)
   - marketingBudgetPct (2.00), salesCommissionPct (5.00)
   - designMonths (8), constructionMonths (30), postCompletionMonths (12)
   - t12Date, t03 (3), t04 (0), t05 (5), t06 (3)
   - salesAbsorptionJson (monthly units sold array)
   - marketingDistJson (monthly marketing spend distribution)
   - channelsJson (channel percentages: digital 35, outdoor 20, events 15, broker 15, pr 10, content 5)
   - paymentPlanJson (booking %, construction %, handover %)
   - resultsJson (computed cash inflow data)

## Router: `server/routers/waelSalesPlan.ts`
- `getByProject({ projectId })` → returns array of plans
- `getById({ id })` → returns single plan
- `save({ id?, projectId, ...fields })` → create/update
- `delete({ id })` → delete plan

## Router: `server/routers/projects.ts`
- `update({ id, ...factSheetFields })` → updates any project field
- factSheetFields includes all unit count/area/price fields + constructionScheduleJson

## Current V2WaelSales.tsx structure (896 lines, ALL HARDCODED):
- UNIT_TYPES: hardcoded array with count, area, defaultPrice
- MARKETING_CHANNELS: 6 channels with defaultPct
- PROJECT_PHASES: 6 phases (design, materials, rera, marketing, sales, construction)
- State: prices, designMonths, constructionMonths, marketingPrepLead, reraLead
- State: marketingPct, commissionPct, materialsCost, channelPcts
- State: salesMode (auto/manual/detail), offPlan, speed, curveTemplate, manualUnits
- Computed: unitRevenues, totalRevenue, totalArea, constructionCost, costs, profit
- Computed: timeline (designEnd, materialsStart, salesStart, etc.)
- Computed: salesDistribution (bell/fast/gradual/late curves)
- Computed: escrowData (balance tracking)
- 6 Sections: Pricing Table, Financial Summary, Operation Costs, Timeline Gantt, Sales Curve, Escrow Impact

## Rebuild Plan:
The new V2WaelSales should:
1. Use `useProjectContext()` for selectedProjectId
2. Load unit data from `trpc.projects.getById` (count/area/price fields)
3. Load sales plan from `trpc.waelSalesPlan.getByProject`
4. Save unit pricing changes to projects table via `trpc.projects.update`
5. Save sales plan changes to wael_sales_plans table via `trpc.waelSalesPlan.save`
6. Keep the same 6-section visual layout but wire to real data
7. Timeline rules (marketingPrepLead, reraLead) should come from Settings page eventually
   but for now keep them as local state that saves to wael_sales_plans

## Key Pattern (from GeneralInputsPage):
```tsx
const { selectedProjectId, setSelectedProjectId } = useProjectContext();
const projectQuery = trpc.projects.getById.useQuery(selectedProjectId!, { enabled: !!selectedProjectId && !!user });
const updateProject = trpc.projects.update.useMutation({ onSuccess: () => projectQuery.refetch() });
```

## Available UI Components:
Card, Badge, Button, Tabs, Slider, Select, Input, Tooltip, Table
Charts: recharts (AreaChart, BarChart, LineChart, PieChart, etc.)
Icons: lucide-react
