# Page Split Architecture Notes

## Current V2WaelSales Structure
- All data comes from 2 queries: `projects.getById` and `waelSalesPlan.getByProject`
- Marketing data stored in `salesAbsorptionJson` field: marketingActualStart, marketingActualEnd, marketingDistribution
- Channel percentages stored in `channelsJson`
- Timeline computed from: designMonths, constructionMonths, marketingPrepLead, reraLead, schematicCompletionMonth
- Save handler: `savePlan.mutate(...)` saves everything to one plan record

## What to Move to Marketing Page
- SECTION 3 (lines 682-733): Operation costs + marketing channel sliders
- SECTION 9 (lines 1173-1334): Marketing budget distribution table (channels × months)
- State: marketingPct, channelPcts, marketingActualStart, marketingActualEnd, marketingDistribution
- The marketing page needs: totalRevenue (from project data), timeline (computed), and its own save

## What to Move to Timeline Page
- SECTION 4 (lines 735-818): Project phases timeline bar + phase inputs
- State: designMonths, constructionMonths, marketingPrepLead, reraLead
- PROJECT_PHASES constant
- schematicCompletionMonth computation
- timeline useMemo computation

## Key Constraint
- Both new pages must read from the SAME DB (projects + waelSalesPlan)
- Both must save back to the SAME plan record (using savePlan mutation)
- The sales page still needs timeline computed values for its calculations
- The sales page still needs marketingCost for display

## BateekhaPage Tab Registration
- Type: TabId union add "marketing" | "timeline"
- TABS array: add entries with appropriate icons
- TabContent switch: add cases
- Lazy imports: add new page components

## Approach: Keep shared computation in V2WaelSales, new pages are views
Actually BETTER approach: Create standalone pages that load their own data independently.
Each page:
1. Uses useProjectContext() for selectedProjectId
2. Queries projects.getById and waelSalesPlan.getByProject independently
3. Has its own state and save handler
4. Saves only its relevant fields back to the plan

This avoids prop drilling and keeps pages independent.
