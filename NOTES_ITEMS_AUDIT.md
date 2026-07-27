# Items Audit: Feasibility Study vs Investor Cash Flow Engine

## Feasibility Study (projectCostsCalc.ts) totalCosts includes:
1. landPrice ✓ (engine: paid)
2. agentCommissionLand ✓ (engine: paid as عمولة وسيط الأرض)
3. landRegistration ✓ (engine: paid as رسوم تسجيل الأرض)
4. soilTestFee ✓ (engine: فحص التربة)
5. topographicSurveyFee ✓ (engine: المسح الطبوغرافي)
6. officialBodiesFees ✓ (engine: رسوم الجهات الحكومية - split 10% investor / 90% escrow)
7. designFee ✓ (engine: أتعاب التصاميم)
8. supervisionFee ✓ (engine: أتعاب الإشراف)
9. separationFee ✓ (engine: رسوم الفرز)
10. constructionCost ✓ (engine: تكلفة الإنشاء)
11. communityFees ✓ (engine: رسوم المجتمع)
12. contingencies ❌ MISSING from engine!
13. developerFee ✓ (engine: أتعاب المطور)
14. salesCommission ✓ (engine: عمولة المبيعات)
15. marketingCost ✓ (engine: التسويق)
16. totalRegulatory includes:
    - reraUnitRegFee ✓ (engine: تسجيل الوحدات — ريرا)
    - reraProjectRegFee ✓ (engine: تسجيل المشروع — ريرا)
    - developerNocFee ✓ (engine: رسوم NOC المطور)
    - escrowAccountFee ✓ (engine: حساب الضمان رسوم فتح)
    - bankFees ✓ (engine: رسوم البنك)
    - surveyorDwgFee ❌ MISSING from engine! (engine has single "رسوم المساح" = surveyorFees)
    - surveyorAsbuiltFee ❌ MISSING from engine! (engine has single "رسوم المساح" = surveyorFees)
    - reraAuditReportFee ✓ (engine: تقرير مدقق ريرا)
    - reraInspectionReportFee ✓ (engine: تقرير تفتيش ريرا)

## Issues Found:
1. Engine uses single `surveyorFee` (from DB field `surveyorFees`) instead of two separate fees:
   - `surveyorDwgFee` (رسوم المساح DWG) — paid at month 1 of RERA phase
   - `surveyorAsbuiltFee` (رسوم المساح As-Built) — paid at penultimate construction month
2. `contingencies` (الاحتياطي) is missing from the engine entirely
3. The DB `projects` table HAS both `surveyorDwgFee` and `surveyorAsbuiltFee` fields

## Fix Plan:
1. Update `ProjectInputs` interface in projectData.ts to add `surveyorDwgFee` and `surveyorAsbuiltFee`
2. Update `dbProjectToInputs` to read both fields from DB
3. Update `investorCashFlowEngine.ts` to create two separate rows:
   - "رسوم المساح DWG" → month 1 of RERA phase (= first month after design ends)
   - "رسوم المساح As-Built" → penultimate construction month
4. Add contingencies row to engine
5. Ensure escrow engine also includes both surveyor fees

## Timing Rules:
- رسوم المساح DWG: شهر 1 من مرحلة ريرا (= first month of construction or RERA start)
- رسوم المساح As-Built: الشهر قبل الأخير من الإنشاء (penultimateConstruction)
- Both are investor-funded in scenarios 3/4, escrow-funded in scenarios 1/2
