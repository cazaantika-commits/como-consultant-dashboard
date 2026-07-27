# Single Source of Truth — Input Pages Mapping

## Rule: Each field can ONLY be entered/edited from ONE page. All other pages display read-only.

### 1. المدخلات العامة (GeneralInputsPage) — inside V2Hub/BateekhaPage
Exclusive inputs:
- سعر الأرض (landPrice)
- تاريخ البدء (startDate)
- مدة التصاميم (preConMonths)
- مدة الإنشاء (constructionMonths)
- تكلفة الإنشاء/قدم² (estimatedConstructionPricePerSqft)
- GFA سكني/تجزئة/مكاتب (gfaResidentialSqft, gfaRetailSqft, gfaOfficesSqft)
- نسب البيع (saleableResidentialPct, saleableRetailPct, saleableOfficesPct)
- عمولة وسيط الأرض (agentCommissionLandPct)
- أتعاب التصميم % أو مقطوع (designFeePct, designFeeFixed)
- أتعاب الإشراف % أو مقطوع (supervisionFeePct, supervisionFeeFixed)
- رسوم الفرز (separationFeePerSqft)
- أتعاب المطور (developerFeePct)
- فحص التربة (soilTestFee)
- المسح الطبوغرافي (topographicSurveyFee)
- رسوم المجتمع (communityFees)
- رسوم الجهات الحكومية (officialBodiesFees)
- مساح DWG (surveyorDwgFee)
- مساح As-built (surveyorAsbuiltFee)
- رسوم NOC المطور (developerNocFee)
- تسجيل المشروع ريرا (reraProjectRegFee)
- فتح حساب الضمان (escrowAccountFee)
- رسوم البنك (bankFees)
- تقرير مدقق ريرا (reraAuditReportFee)
- تقرير فحص ريرا (reraInspectionReportFee)

### 2. توزيع الوحدات (PricingPage/UnitDistribution)
Exclusive inputs:
- عدد الوحدات لكل نوع
- مساحة كل وحدة
- المواقف (عدد مواقف السيارات)

### 3. الإنشاء (ConstructionInputsPage)
Exclusive inputs:
- نسب الإنجاز الشهرية (%) — ONLY this

### 4. المبيعات والتسويق (V2WaelSales / WaelSalesPlan)
Exclusive inputs:
- سعر القدم² لكل نوع (سكني/تجزئة/مكاتب)
- خطة البيع الشهرية (كم وحدة تُباع كل شهر)
- خطة الدفع (أقساط المشتري)
- نسبة البيع على الخارطة (e.g. 80%)
- ميزانية التسويق (النسبة الإجمالية e.g. 2%)
- عمولة المبيعات (e.g. 5%)
- توزيع ميزانية التسويق على القنوات (رقمي، خارجية، معارض، وسطاء، علاقات عامة، محتوى)

### 5. الإعدادات والقواعد (SettingsRulesPage) — TO BE REVISED LATER
- Skipped for now, user will return to define it

---

## Pages that must become READ-ONLY for shared fields:
- FactSheetPage — financial fields (landPrice, GFA, fees, durations) → read-only
- ProjectCardOffplanPage — shared fields → read-only
- ConstructionInputsPage — constructionMonths slider → read from المدخلات العامة (no edit here)
- All other pages (V2Feasibility, CashFlow, etc.) — display/calculate only, no input
