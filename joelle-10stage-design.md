# Joelle 10-Stage Workflow - Architecture Design

## Current State
- competitionPricing router: single `generateSmartReport` endpoint that generates 1 report + 1 JSON recommendations in parallel
- CompetitionPricingTab.tsx: 852 lines, renders report + pricing tables + payment plan
- Tab4Competition.tsx: 179 lines, static scenario display (seems unused/legacy)
- Database: competition_pricing table has aiSmartReport (longtext), aiRecommendationsJson (text)

## Design Decision
Instead of creating 10 separate DB tables and 10 separate API calls, we will:

1. **Add a new `joelle_analysis_stages` table** to track each stage's progress and output
2. **Restructure the backend** to have a `runStage` mutation that runs one stage at a time
3. **Restructure the frontend** to show a stepper/progress UI with 10 stages
4. **Each stage produces its own report** stored in the stages table
5. **Stage 8** auto-populates the existing competition_pricing fields
6. **Stage 9** generates 5 separate reports from accumulated stage data

## New DB Table: joelle_analysis_stages
- id, userId, projectId
- stageNumber (1-10)
- stageName
- stageStatus (pending, running, completed, error)
- stageOutput (longtext - the report/analysis text)
- stageDataJson (longtext - structured data from this stage)
- startedAt, completedAt
- createdAt, updatedAt

## Stage Flow
1. Read Fact Sheet → reads from projects + feasibilityStudies tables
2. Market Context → LLM generates area analysis (demographics, buyer profile, infrastructure)
3. Demand Structure → LLM analyzes transaction patterns, unit types
4. Competitive Landscape → LLM maps competitors within 1/2/3 km radius
5. Product Strategy → LLM defines optimal unit mix, sizes, quality
6. Pricing Intelligence → LLM generates 3 scenarios per unit type
7. Payment Plan → LLM benchmarks competitor payment plans
8. Populate Fields → Auto-fills competition_pricing table from stage 5+6+7 data
9. Generate Reports → Creates 5 separate reports from all stage data
10. Validation → Cross-checks recommendations against multiple sources

## Frontend UI
- Stepper showing stages 1-10 with status icons
- "Run Next Stage" button (or "Run All" for convenience)
- Each completed stage shows expandable report
- Stage 8 shows populated fields preview
- Stage 9 shows 5 report tabs
