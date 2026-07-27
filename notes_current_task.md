# Current Task Notes

## Files where marketingPct / salesCommissionPct are EDITABLE (need to lock):

1. **V2WaelSales.tsx** (Sales page):
   - Lines 547-598: "تكاليف العملية" section with sliders for marketing%, commission%, offplan%
   - Lines 579-597: "توزيع قنوات التسويق" with channel sliders
   - Lines 287-288: handleSaveUnits saves marketingPct/salesCommissionPct to projects table
   - Lines 302-303: handleSavePlan saves them to waelSalesPlan
   - Line 542: KPI card "التسويق + العمولة" merged (needs split)
   - Lines 395-472: Pricing table - all inputs (count, area, price) editable - need to lock count+area, keep only price

2. **FactSheetPage.tsx** (المدخلات العامة):
   - Lines 596-597: Field controls for "وسيط بيع%" and "تسويق%" are editable
   - Need to make these read-only (display only)

3. **ProjectCardOffplanPage.tsx**:
   - Lines 456-457: CostRowEditable for عمولة المبيعات and التسويق
   - These are editable when isEditing=true

## Changes needed in V2WaelSales.tsx:
1. REMOVE section 3 entirely (lines 547-598): "تكاليف العملية" + "توزيع قنوات التسويق"
2. SPLIT KPI card line 542: "التسويق + العمولة" → two cards: "التسويق" and "العمولة"
3. LOCK pricing table: count and area inputs → read-only display, keep only price (سعر/قدم) editable
4. Remove marketingPct/commissionPct from save handlers (they come from MarketingPage now)
5. Keep offPlan slider somewhere? User said remove the section... need to keep offPlan% somewhere or it's lost

## Changes needed in FactSheetPage.tsx:
- Make salesCommissionPct and marketingPct fields read-only (display badge only, not editable Field)

## IMPORTANT: Keep "نسبة البيع على الخارطة" (offPlan%) - user didn't mention removing it
- Actually user said "شيل هادا لانه موجود في التسويق" referring to the whole تكاليف العملية section
- But offPlan% is NOT in MarketingPage... need to be careful
- MarketingPage has: marketingPct slider + commissionPct slider (no offPlan)
- So offPlan% needs to stay somewhere in Sales page
