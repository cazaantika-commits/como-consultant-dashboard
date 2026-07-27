# Timeline Settings Issue

## Problem
marketingPrepLead and reraLead are NOT stored as separate fields in the projects table.
They are only stored inside `salesAbsorptionJson` in the sales_plans table.
This means they are only saved when the user saves from V2WaelSales page.

## Current State
- GeneralInputsPage has: preConMonths, constructionMonths, startDate — but NO marketingPrepLead or reraLead
- V2WaelSales reads marketingPrepLead/reraLead from salesAbsorptionJson (plan data)
- Default values: marketingPrepLead=3, reraLead=2

## Fix Needed
1. Add `marketingPrepMonths` and `reraLeadMonths` columns to the projects table in schema
2. Add them to GeneralInputsPage ALL_FIELDS
3. V2WaelSales and MarketingPage should read from project data (not just salesAbsorptionJson)
4. Push schema changes to DB

## Schema location
drizzle/schema.ts line ~1147-1150 (projects table, near preConMonths)
