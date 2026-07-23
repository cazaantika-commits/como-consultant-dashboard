# Wael Page - Reference from Excel Model Conversation

## Key Decision from Previous Session

The conversation with Manus in another session concluded with an important decision:

### The Agreed Approach (Phase 1 - Deterministic Engine)
Instead of connecting to Excel Online (which was deemed risky and unproven for this 290K formula file),
the agreed approach is:

1. **Extract the exact formulas from Excel** and implement them as deterministic code
2. **The web page uses the SAME mathematical logic** as Excel - not AI, not approximations
3. **Every calculation is testable** against known Excel results
4. **Wael sees a simplified interface** but the math behind it is identical to Excel

### Timeline Logic (from Excel - Approved Tests)

| Code | Meaning | Default (Majan) |
|------|---------|-----------------|
| T12 | Schematic Design Completion | Nov 2026 |
| T03 | Months from T12 to Approval Month 1 | 3 |
| T05 | Months from T12 to Sales Start | 5 |
| T06 | Months from T12 to Campaign Start | 3 |
| T04 | Construction Start Offset (signed) | 0 |
| P06 | Project Start Date | varies |
| F28 | Design Duration (months) | varies |
| F29 | Construction Duration (months) | varies |
| F135 | Post-completion sales months | varies |

### Timeline Sequence (Nov 2026 Example)
1. T12 = Nov 2026 (Schematic Design Completion)
2. T12+1 = Dec 2026 (Materials Prep Month 1) → M09 cost 50%
3. T12+2 = Jan 2027 (Materials Prep Month 2) → M09 cost 50%
4. T12+3 = Feb 2027 (Approval Month 1 + Campaign Start)
5. T12+4 = Mar 2027 (Approval Month 2 = Sales Approval Month + 20% Escrow)
6. T12+5 = Apr 2027 (Sales Start = First Buyer Payment)

### Campaign Window Rules
- Start: T12 + T06
- End: Construction Completion + 12 months
- Max: 60 months (M1:M60)
- Total <= 100% (below OK, above REJECTED)
- No entries after window end

### Payment Plan (from Excel row 1311+)
- First milestone: "Months After Signing" trigger=0, lag=0
  → Payment in SAME month as sale
- Subsequent milestones configurable
- Each has: trigger type, trigger value, lag, percentage

### Sales Absorption
- Starts at T12 + T05
- Monthly % of off-plan target
- Continues through construction + post-completion months

### What Wael Controls
1. Marketing budget distribution (monthly % across campaign window)
2. Sales absorption plan (monthly % of off-plan target)
3. Payment plan (milestone percentages and timing)
4. Off-plan vs post-completion split

### What the System Calculates
1. All milestone dates (from T12 + offsets)
2. Monthly cash inflow (sales × payment plan timing)
3. Marketing spend per month
4. Cumulative collections
5. Warnings when totals don't match

### Key Principle
The web is a SIMPLIFIED SAFE WRAPPER around the Excel logic.
It does NOT replace Excel. It uses the SAME deterministic formulas.
No AI in the calculation path. AI only for explaining results.
