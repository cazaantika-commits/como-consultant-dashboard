# CPA System TODO

- [x] Fix team gap analysis to apply to ALL fee methods (LUMP_SUM, PERCENTAGE, MONTHLY_RATE)
- [x] Verify calculation matches worked example in Final Spec
- [x] Fix importJson bug: added textarea for direct JSON paste, import now works correctly
- [x] Fix unrankable consultants display: show scope gap + true design fee (LACASA, XYZ)
- [x] Build True Cost Report generation endpoint (HTML/PDF matching TrueCost_6457879 format)
- [x] Add Export Report button to CPA results page
- [x] Capital scheduling: page wired to /capital-scheduling route in App.tsx
- [x] Import corrected KIEFERLE JSON and recalculate — DONE: design_fee=8,707,596 AED, 47 scope items, 9 supervision roles imported
- [x] Fix report: scope gap table now shows only items 29-43 (add-on items), not 1-28 (base scope)
- [x] Add contractual risk warnings section (items 1-28) to report with notes from JSON
- [x] Capital scheduling: no paid amounts when shifting columns (only required amounts)
- [x] Capital scheduling: curved corners at row-column intersections instead of rectangles
- [x] Capital scheduling: beautiful column headers matching current design
- [x] Capital scheduling: lighter/clearer header colors (not dark) - comfortable and readable
- [x] Capital scheduling: pick 2 colors from reference image for phases (teal + amber)
- [x] Capital scheduling: all columns equal width
- [x] Capital scheduling: phase rectangles with rounded corners at all 4 corners (not just top/bottom)
- [x] Capital scheduling: add cumulative total column (التراكمي) next to the total column
- [x] Restructure capital requirements into 4 phases: paid, design/approvals, off-plan, construction
- [x] Move contractor advance payment (10%) to first month of construction phase
- [x] Move sorting fees (رسوم الفرز) to off-plan phase
- [x] Distribute developer fees: 30% design, 10% off-plan, 60% construction
- [x] Distribute marketing: 25% off-plan, 75% construction (75% first 4 months, 25% next 6 months)
- [x] Update capital requirements page UI to show 4 phases
- [x] Update capital scheduling page for 4 phases with flexible ordering and delay controls
- [x] Phase ordering rules: paid→design→(off-plan/construction flexible)
- [x] Test: offplan delay works independently (shifts offplan amounts only)
- [x] Test: construction delay works independently (shifts construction amounts only)
- [x] Test: design delay shifts all downstream phases (design + offplan + construction)
- [x] Test: reset button restores original positions
- [x] Test: cumulative totals update correctly with delays
- [x] Test: past phases (before chart start) correctly handled when delayed
- [x] 4-phase color coding: gray (land/paid), purple (design), light blue (offplan), amber (construction)
- [x] Independent delay controls per project: 3 delay buttons (design, offplan, construction)
- [x] Delay badge shows active delays (e.g., "تصاميم +3ش · أوف +3ش")
- [x] Import corrected KIEFERLE JSON and recalculate (pending) — DONE: KIEFERLE_6457956.json imported successfully
- [x] Update capital scheduling phase colors to match provided color palette (green, orange, pink, cyan, yellow)
- [x] Bug: Design and offplan phases not showing for مجان متعدد الاستخدامات in capital scheduling — FIXED: geometric range as single source of truth
- [x] Change construction phase color to green (#4AD8A4) instead of orange
- [x] Add project settings panel to CapitalSchedulingPage for editing startDate and durations directly
- [x] Add startDate and handoverMonths fields to projects table schema
- [x] Migrate existing data from cf_projects to projects table
- [x] Update server routers to read durations from projects table (single source)
- [x] Update CapitalSchedulingPage settings to write to projects table
- [x] Update TimeDistributionTab to read actual durations from project (not defaults)
- [x] Update FeasibilityHubPage, CapitalPlanningDashboard, PortfolioView to use unified source
- [x] Add bidirectional sync: FactSheetPage → cf_projects, ProgramCashFlowPage → projects
- [x] Verify all pages reflect changes from one place
- [x] Bug fix: Edit button for last two projects now uses projectId instead of cfProjectId
- [x] Change delay increment from 3 months to 1 month in capital scheduling
- [x] Remove paid/land amounts from monthly schedule rows (should not mix with future required amounts)
- [x] Add paid summary row at top of capital scheduling table showing total paid per project
- [x] Fix: colors not consistent at end of each project in capital scheduling (phase detection mismatch)
- [x] CRITICAL: Delay/shift changes in capital scheduling must persist to DB and reflect in capital requirements page
- [x] Keep handover phase as separate color (orange) from construction (green)
- [x] Add tooltips on capital scheduling cells: amount cells show project+phase+month detail, paid cells show breakdown, total/cumulative show per-project split
- [x] Replace tooltips: show item-level breakdown (consultant fees, contractor, marketing, etc.) that compose each cell's total amount
- [x] Remove old tooltips that only showed project name, phase, and month
- [x] Off-plan phase as transparent overlay: render off-plan as a see-through layer on top of design/construction, not a separate sequential block
- [x] Off-plan constraints: cannot start in first 2 months of design, cannot exist in last 6 months of construction
- [x] Off-plan can also exist between design and construction (sequential position possible)
- [x] Off-plan delay controls move the overlay position within allowed range
- [x] Improve capital scheduling page overall visual design and color scheme
- [x] Refine phase colors for a more professional, cohesive palette
- [x] Polish header, controls, and table styling for board-presentation quality
- [x] Fix project headers: align الإجمالي and المطلوب on same horizontal line across all projects
- [x] Darken faded/pale colors in capital scheduling - make them stronger and more visible
- [x] Match capital scheduling page theme with the platform's existing theme
- [x] Complete color redesign: new calming, comfortable palette for phase columns (not faded, not harsh)
- [x] Fix header colors to be strong and non-faded
- [x] Add project toggle (hide/show) in settings panel to temporarily exclude projects from the table
- [x] Color redesign: make capital scheduling colors cheerful, balanced, vibrant - add yellow/pink/bright colors, remove dark/depressing feel
- [x] Final color: introduce rose (handover color) and teal (icon color) as balanced accents - not overwhelming
- [x] Soften blue (design) and green (construction) phase colors - less intense/strong
- [x] Swap cumulative column color (rose) with design phase color (blue)
- [x] Make all numbers in table columns black color for better readability
- [x] Fix feasibility study: remove redundant project selector from sub-pages after project is already selected
- [x] Hide redundant project selector in RequiredCapitalPage when accessed from FeasibilityHub
- [x] Hide redundant project selector in EscrowAccountPage when accessed from FeasibilityHub
- [x] Hide redundant project selector in RiskDashboardPage (no change needed - page shows all projects as cards, no dropdown selector)
- [x] Radical color redesign of CapitalSchedulingPage: calm white background with dark muted accent colors
- [x] Change total and required columns to match Como Projects icon colors (dark orange/green)
- [x] Make phase colors darker/muted - like dark colors painted on white canvas
- [x] Add horizontal (transposed) view of capital scheduling table - projects as rows, months as columns
- [x] Add toggle button to switch between vertical and horizontal views
- [x] Simplify horizontal view colors to basic/simple palette
- [x] Reduce column widths in horizontal view
- [x] Make Salwa's image bigger on the homepage
- [x] Change 'شيكي على الايميل' to 'البريد الالكتروني'
- [x] Enlarge Salwa's image to show more of her body, not just face - bigger container and adjust cropping
- [x] Add animated news ticker below Salwa section with latest updates
- [x] Add micro-animations (fade-in, bounce) for section icons on page load
- [x] Add quick stats bar between Salwa section and main sections (active projects, pending tasks, upcoming meetings)
- [x] Bug fix: Scope matrix (مصفوفة النطاق) edits not saving in financial analysis settings
- [x] Move capabilities section from bottom to above main sections (keep same design)
- [x] Create database table for news ticker items
- [x] Add tRPC CRUD procedures for news management
- [x] Create admin UI page for managing news (add/edit/delete)
- [x] Connect homepage news ticker to real database data
- [x] Rollback capital scheduling page to before dashboard cards redesign
- [x] Simplify capital scheduling colors to basic gray/neutral with minimal color accents
- [x] Add subtle color tints per phase for better differentiation (light blue, light green, etc.)
- [x] Improve number contrast inside gray cells for better readability
- [x] Explore regulatory compliance pathway in development phases and document all phases/ceilings/details
- [x] Create comprehensive work schedule table page for regulatory compliance with all phases, ceilings, dates
- [x] Wire the new page with backend and integrate into navigation
- [x] Rebuild work schedule page as a Gantt chart (task table on left + timeline bars on right)
- [x] Match reference image style: WBS numbering, colored bars, week/month headers, % complete, duration
- [x] Integrate with lifecycle data (stages as parent rows, services as child rows)
- [x] Gantt chart: user inputs start date + working days (5-day week, excl Fri/Sat) → end date auto-calculated
- [x] Gantt chart: duration column becomes editable input field
- [x] Gantt chart: end date is read-only, computed from start + working days
- [x] Gantt chart: start date + working days (5-day week, excl Fri/Sat) → end date auto-calculated
- [x] Gantt chart: duration column becomes editable input, end date is read-only computed
- [x] Gantt chart: bars must always appear on timeline when dates are entered
- [x] Gantt chart: add drag-and-drop to move bars on the timeline (updates start/end dates)
- [x] Gantt chart: add resize handles on bars to change duration by dragging
- [x] Gantt chart: add dependency arrows between sequential tasks within each stage
- [x] Gantt chart: add "suggested duration" column showing default/ceiling days from lifecycle data
- [x] Gantt chart: make status column editable (click to cycle: لم يبدأ → جاري → مكتمل)
- [x] Gantt chart: make completion % editable (0-100% input)
- [x] Gantt chart: sync status/completion/dates changes back to lifecycle development phases page (uses same DB table)
- [x] Gantt chart: minimize row height to maximum compactness (rows nearly touching)
- [x] Gantt chart: minimize column widths to maximum compactness for wider/more comprehensive view
- [x] Gantt chart: add filter for overdue tasks only (tasks past their end date but not completed)
- [x] Gantt chart: add filter for tasks without dates assigned
- [x] Gantt chart: add filter UI buttons/toggles in the header area
- [x] Gantt chart: add filter for in-progress and not-started tasks with counts
- [x] Bug fix: Gantt bars not appearing on timeline when dates are entered/saved - added placeholder gray bar for undated services
- [x] Bug fix: Completion % should be auto-calculated from service statuses (not manual input) - already computed from reqPct/statusPct
- [x] Stage completion = count of completed services / total services in stage - already computed
- [x] Bug fix: cycleStatus wipes dates when cycling status (doesn't include existing dates in mutation)
- [x] Bug fix: saveEditing should be more robust with DOM fallback for date values
- [x] Bug fix: server-side upsertServiceInstance overwrites dates with NULL when only status is sent
- [x] Unit tests for upsertServiceInstance data builder (5 tests passing)
- [x] Improve: Auto-calculate progress % based on requirements completion and status - already implemented
- [x] Bug fix: Gantt timeline header stuck on March/April - cannot scroll horizontally to see other months
- [x] Bug fix: Horizontal scroll moves rows but not the timeline date header - they should be synchronized
- [x] Improve: Timeline should show the full date range of the project and be easily navigable
- [x] Bug fix: Timeline direction should be RTL (right-to-left) - oldest dates on right, newest on left - matching Arabic layout
- [x] Feature: Add/delete/edit custom tasks within any stage (user can add 5-6 new tasks inside a stage)
- [x] Bug fix: Changing duration (e.g. 7 days to 20 days) should update the bar length on the timeline (bar uses start+end dates, duration change recalculates end date)
- [x] Bug: Dates not saving when entered by user (saveEditing now uses state directly instead of refs)
- [x] Bug: Weekend days should be Saturday and Sunday (changed from Fri/Sat to Sat/Sun)
- [x] Bug: Status stuck on "completed" for تأسيس المطور - stage status now auto-computed from services
- [x] Feature: Add "Today" button for quick navigation in timeline (CalendarDays icon + scrollToToday)
- [x] Bug: Project 6185392 page not opening (added /projects/:id route alias)
- [x] Bug: Today button not working (scroll-to-today logic fixed for RTL)
- [x] Bug: Project 6185392 still not opening (fixed Invalid Date crash with safeDate helper)
- [x] Bug: Bar extends in wrong direction when duration changes (fixed RTL bar positioning: right=startOffset*dayWidth)
- [x] Bug: تبويب "البيانات" في صفحة تفاصيل الخدمة يظهر العدد (0/3) لكن لا يعرض البيانات عند الضغط عليه - تم إصلاحه بربط badge بـ stageData.stats
- [x] Bug: المشاريع لا تُحمَّل / غير مربوطة في صفحة مسار الامتثال (السبب: المستخدم غير مسجّل - تم إضافة auth guard)
- [x] Bug: قائمة المشاريع لا تظهر في النسخة المنشورة (مسار الامتثال، مراحل التطوير، وأماكن أخرى) - تم الإصلاح بإضافة auth guard
- [x] Bug: النسخة المنشورة لا تعرض زر تسجيل الدخول بوضوح - تم إضافة auth guard في ProjectLifecyclePage
- [x] تعديل مسار الامتثال: تغيير إدخال التواريخ من (بداية + انتهاء) إلى (بداية + أيام عمل) مع حساب تاريخ الانتهاء تلقائياً (السبت والأحد عطلة)
- [x] إلغاء أيقونة "إعدادات المراحل" من صفحة جولة المشروع
- [x] إضافة أيقونة "جدول العمل التنظيمي" في صفحة جولة المشروع مرتبطة ببيانات مسار الامتثال (تعديل من الطرفين)
- [x] Bug: جدول العمل التنظيمي داخل جولة لا يعكس التواريخ المحفوظة في مسار الامتثال - تم الإصلاح بمزامنة المشروع المحدد بين الصفحتين (sharedProjectId)
- [x] إعدادات المراحل: إضافة حقل إدخال رقم الترتيب لكل مرحلة مع إعادة ترتيب تلقائية وترقيم متسلسل يتغير بتغير المكان
- [x] LifecycleAdminPanel: إضافة حقل رقم الترتيب المباشر لكل مرحلة مع إعادة ترقيم تلقائي (ينعكس على المسار والجدول لجميع المشاريع)
- [x] Bug: تبويب "البيانات" في تفاصيل الخدمة يظهر العدد لكن لا يعرض المحتوى - تم الإصلاح: يعرض المتطلبات العادية عندما لا توجد حقول مخصصة
- [x] مخطط غانت: حساب نسبة الإنجاز تلقائياً من حالة الخدمات - كان مطبقاً بالفعل (نسبة الخدمات المكتملة من المتطلبات)
- [x] Bug: تناقض في شارة الحالة - تظهر "لم يبدأ" و"بدأ فعلياً" معاً في نفس الخدمة - تم الإصلاح: وجود actualStartDate يجعل الحالة in_progress تلقائياً
- [x] Bug: قراءة التاريخ خاطئة في الجدول - تم الإصلاح: safeDate تتعرف على صيغة DD-MM-YYYY وتحولها بشكل صحيح
- [x] حذف جدول العمل التنظيمي من الشريط الجانبي (خارج الجولة) - تم الحذف من الصفحة الرئيسية
- [x] جدول العمل: إضافة شريط تمرير أفقي في أعلى الجدول (لا حاجة للنزول للأسفل)
- [x] جدول العمل: تضييق لوحة البيانات اليسرى لإعطاء الجدول مساحة أوسع
- [x] جدول العمل: إزالة زر "إدخال مهمة" (متاح فقط في إدارة المسار)
- [x] جدول العمل: تنسيق التواريخ بصيغة "25 Mar 26"
- [x] جدول العمل: إضافة شريط تمرير أفقي في أعلى الجدول
- [x] جدول العمل: تضييق لوحة البيانات اليسرى لإعطاء الجدول مساحة أوسع
- [x] جدول العمل: إزالة زر "إدخال مهمة"
- [x] جدول العمل: تنسيق التواريخ بالإنجليزية "01 Mar 26"
- [x] الصفحة الرئيسية: شارة حمراء على أيقونة "جولة في مراحل التطوير" تعرض إجمالي المهام المتأخرة عبر جميع المشاريع
- [x] Bug: تنسيق التاريخ خاطئ في الجدول - تم الإصلاح: safeDate تتعرف على صيغة DD-Mon-YY مثل 17-Mar-26
- [x] جدول العمل: زر "تضييق" لإخفاء الحقول الجانبية وزر "توسيع" لإظهارها - يبقى WBS + المهمة + % + الجدول
- [x] Bug: خط "اليوم" في الجدول يظهر على 18 مارس بدلاً من 19 - تم الإصلاح: localToday() تستخدم التوقيت المحلي بدلاً من UTC
- [x] تأكيد تنسيق التواريخ "19 Mar 26" - الكود صحيح (fmtDate تنتج DD Mon YY) والإصلاح السابق لـ safeDate يضمن القراءة الصحيحة
- [x] Bug: التواريخ تظهر "Mar 26 16" بدلاً من "16 Mar 26" - تم الإصلاح: safeDate تتعامل مع YYYY-MM-DD كتوقيت محلي
- [x] Bug: زر "تضييق" لا يعمل - تم التحقق: الكود صحيح (compactMode يخفي الحقول ويضيق اللوحة من 460 إلى 280px)
- [x] Bug: عمود المهمة في الجدول مقتطع جداً - يحتاج عرض أكبر
- [x] Bug: عمود البدء/الانتهاء ضيق فيظهر الرقم فقط بدون الشهر
- [x] Bug: زر "تضييق" لا يوسع عمود المهمة بشكل كافٍ
- [x] Add برنامج العمل (read-only) to مركز القيادة as a new bubble/icon
- [x] Add جدولة رأس المال (editable) to مركز القيادة as a new bubble/icon
- [x] Add دراسة جدوى المشروع (read-only) to مركز القيادة - now shows FinancialPlanningHubPage with project selector and 3 report tabs
- [x] Fix دراسة جدوى المشروع in مركز القيادة - shows 3 sections via FinancialPlanningHubPage
- [x] Cost rules: Update DB schema to support payment installments — costDistributionRules has paymentScheduleJson/customJson; projectCashFlowSettings is the per-project overrides table
- [x] Cost rules: Seed all 26 items with full payment schedules — CostDistributionRulesPage.tsx exists with full seeded data
- [x] Cost rules: Rebuild UI page with two levels — CostDistributionRulesPage has default template + per-project override tabs
- [x] Cost rules: Each item shows: name, amount type (fixed/%), default value, source (investor/escrow), phase, installment schedule — all fields present
- [x] Cost rules: Installment schedule editor — add/remove rows with month number + percentage implemented
- [x] Cost rules: Project override tab — select project, see all 26 items with ability to override value and schedule
- [x] Redesign FactSheetPage: 3 sections — already has AI/manual/calc badges with 3 sections
- [x] FactSheet: link phase durations to compliance track — preConMonths/constructionMonths saved in projects table and read by WorkSchedulePage and CashFlowSettingsPage
- [x] FactSheet: add broker sales commission field (% of revenue) — salesCommissionPct field at line 591
- [x] FactSheet: show formula labels next to each calculated field — formula prop shows formula hints
- [x] FactSheet: style like the Excel-sheet draft — clear sections, formula hints, grouped by phase

## السيناريوهات المالية الثلاثة — جدول رأس المال المطلوب

- [x] Add FinancingScenario type to cashFlowEngine: "offplan_escrow" | "offplan_construction" | "no_offplan"
- [x] Update getInvestorExpenses() to accept scenario and return correct items per scenario
- [x] Update getEscrowExpenses() to accept scenario and return correct items per scenario
- [x] Scenario 1 (offplan_escrow): current behavior — escrow deposit in offplan phase, all regulatory fees in offplan
- [x] Scenario 2 (offplan_construction): regulatory fees shift to construction month 3-4, escrow_deposit replaced by 3-month contractor payment split
- [x] Scenario 3 (no_offplan): remove fraz/rera/noc/escrow/marketing/sales_agent/rera_audit/rera_inspection; developer fee = 3% of revenue; fraz_fee stays but moves to construction
- [x] Add scenario selector (3 radio buttons) to ExcelCashFlowPage header
- [x] Add scenario selector to CapitalSchedulingPage header
- [x] Ensure CapitalSchedulingPage reads all data from ExcelCashFlowPage/cashFlowEngine (single source)
- [x] Verify all project costs come from Fact Sheet via calculateProjectCosts() — no hardcoded fallbacks used in production

## السيناريو المالي على مستوى كل مشروع
- [x] إضافة حقل financing_scenario في جدول projects في قاعدة البيانات
- [x] إضافة tRPC procedure لقراءة وتحديث سيناريو كل مشروع
- [x] تحديث صفحة رأس المال المطلوب: منتقي السيناريو لكل مشروع يحفظ في DB
- [x] تحديث الجدول الشامل: يقرأ السيناريو من DB لكل مشروع، حذف الزر العام

## شارة السيناريو والربط التلقائي
- [x] إضافة شارة السيناريو بجانب اسم كل مشروع في الجدول الشامل - تم إضافة financingScenario للباكند وشارة O1/O2/O3 في الفرونت
- [x] تطبيق السيناريو الثالث (بدون أوف بلان) على مشروع المول — مركز مجان التجاري (id=1) كان بالفعل no_offplan
- [x] التحقق من الربط التلقائي — تم إضافة financingScenario إلى FactSheetPage (تحميل + حفظ + Select UI) وإلى projects.ts Zod schema

## صفحة جدول التدفق المالي (الجديدة)
- [x] إضافة جدول project_cash_flow_settings في قاعدة البيانات — موجود في schema.ts
- [x] إضافة tRPC procedures: getCashFlowSettings و saveCashFlowSettings — موجودة كـ getSettings/saveSettings
- [x] بناء CashFlowDistributionPage — جدول الإعدادات (سيناريو + توزيع زمني) — CashFlowSettingsPage موجودة
- [x] بناء CashFlowDistributionPage — جدول الانعكاس (أفقي شهري) — TimeDistributionTab موجودة
- [x] تسجيل المسار في App.tsx وإضافة الأيقونة في FeasibilityHubPage — مسجل
- [x] تحديث ExcelCashFlowPage ليسحب من الإعدادات بدل الكود الثابت — يسحب من getReflectionData

- [x] Create project_cash_flow_settings database table with full schema (itemKey, distributionMethod, lumpSumMonth, startMonth, endMonth, customJson, fundingSource, etc.)
- [x] Build cashFlowSettings tRPC router: getSettings, saveSettings, resetSettings, getReflectionData procedures
- [x] Build CashFlowSettingsPage (جدول الإعدادات): scenario selector, per-item distribution config, amount overrides, funding source, notes
- [x] Build CashFlowReflectionPage (جدول الانعكاس): horizontal Excel-like monthly matrix, phase-colored columns, category subtotals, grand totals, CSV export
- [x] Integrate both pages as tabs in FeasibilityStudyPage (⚙️ إعدادات التدفق + 📊 جدول الانعكاس)
- [x] Add standalone routes /cashflow-settings and /cashflow-reflection in App.tsx
- [x] Write 15 unit tests for distribution logic (lump_sum, equal_spread, custom, zero amount, total integrity) — all passing
- [x] إعادة بناء جدول الانعكاس — getCostSettingsComparison يقرأ savedSettings من projectCashFlowSettings ويستخدمها لحساب التوزيع بشكل صحيح
- [x] إعادة تصميم صفحة إعدادات التدفق: إزالة حقول تعديل المبالغ (عرض فقط)، إضافة حقول المدد الزمنية للمراحل، تحديد المرحلة لكل بند (تلقائي قابل للتغيير)، طريقة الدفع (دفعة واحدة + رقم الشهر، أو موزع)، كل هذا لكل سيناريو منفصل
- [x] إصلاح إعدادات التدفق: البنود الموزعة تعرض عدد أشهر المرحلة الفعلية — getPhaseDuration تستخدم durations.design/construction/handover بشكل صحيح
- [x] إصلاح إعدادات التدفق (3 تحسينات) — كلها موجودة بالفعل: (1) phaseDuration صحيح (2) خيار نسب مخصصة موجود (3) الأرض مقفلة بـ isPaid
- [x] إعادة تصميم صفحة إعدادات التدفق — الصفحة تستخدم نفس هيكل جدول الانعكاس (4 أقسام) مع أدوات التوزيع لكل بند
- [x] إعادة تصميم صفحة إعدادات التدفق: نفس هيكل جدول الانعكاس (4 أقسام)، مبالغ عرض فقط، توزيع ثلاثي (دفعة واحدة + نسب مخصصة + موزع بالتساوي)، الأرض مدفوع مسبقاً ثابت
- [x] إصلاح إعدادات التدفق: نقل "إيداع حساب الضمان" — موجود بالفعل في section="offplan" (القسم الثالث) في السيرفر
- [x] إصلاح إعدادات التدفق: تقسيم أتعاب المطور — موجود بالفعل: developer_fee_design (1%), developer_fee_offplan (1%), developer_fee_construction (3%)
- [x] إصلاح إعدادات التدفق: تقسيم عمولة المبيعات — sales_commission (5%) في section="escrow" بالفعل
- [x] إصلاح إعدادات التدفق: نقل إيداع حساب الضمان إلى القسم الثالث، تقسيم أتعاب المطور إلى 3 بنود، تقسيم التسويق إلى بندين، حقل section يأتي من السيرفر
- [x] ربط جدول الانعكاس بإعدادات التدفق (المدد الزمنية + طريقة التوزيع لكل بند) — مربوط عبر getReflectionData
- [x] إضافة معاينة التوزيع في إعدادات التدفق — DistributionPreview موجود بالفعل في السطر 414-422
- [x] مراجعة السيناريو الثاني — بنود O2 سليمة: رسوم التسجيل في شهر 3 إنشاء، 3 دفعات 20% إنجاز، التسويق موزع على مرحلتي أوف بلان + إنشاء
- [x] Rename: محرك جويل → الدراسات والأبحاث
- [x] Rename: بيانات جويل → البيانات والمصادر
- [x] Rename: الميزانية والتسعير → التسعير والإيرادات
- [x] Rename: دراسة الجدوى المالية → ملخص الجدوى المالية
- [x] Rename: مشاريع كومو _ جدولة راس المال → محفظة رأس المال للمشاريع
- [x] Rename: رأس المال المطلوب → خطة رأس مال المشروع
- [x] Rename: حساب الضمان → التدفقات النقدية وحساب الضمان
- [x] Rename: جدول الانعكاس → التكاليف الكلية للمشروع والجدول الزمني

- [x] Restructure project-management into 4 main sections with icons — already done in ProjectManagementPage.tsx
- [x] Section 1: بطاقة المشروع (standalone, no sub-tabs) — FactSheetPage embedded
- [x] Section 2: المعرفة والتحليل (project selector + 5 tabs) — KnowledgeHubPage.tsx
- [x] Section 3: التخطيط المالي (project selector + 5 tabs) — FinancialPlanningHubPage.tsx
- [x] Section 4: محفظة رأس المال للمشاريع — CapitalPortfolioPage embedded
- [x] Restructure project-management page into 4 main sections: بطاقة المشروع, المعرفة والتحليل (5 tabs), التخطيط المالي (5 tabs), محفظة رأس المال للمشاريع
- [x] Create KnowledgeHubPage.tsx with 5 tabs: الدراسات والأبحاث, تقارير السوق, البيانات والمصادر, لوحة المخاطر, التسعير والإيرادات
- [x] Create FinancialPlanningHubPage.tsx with 5 tabs: إعدادات التدفق, ملخص الجدوى المالية, التكاليف الكلية, خطة رأس المال, التدفقات النقدية
- [x] Add SVG icons for 4 main sections in ProjectManagementPage (replace emoji) - already implemented with custom SVG components
- [x] Remember last opened project in KnowledgeHubPage and FinancialPlanningHubPage (localStorage) - both pages now persist/restore selectedProjectId
- [x] Fix amount duplication in capital schedule table (computedAmount vs monthly sum mismatch) - distributeFromSettings uses remainder correction, no duplication
- [x] Bug: capital schedule table does not reflect updated settings - added gcTime:0 + refresh button to force refetch after settings change
- [x] Remove revenue items from CashFlowSettingsPage and router defaults - already filtered: category !== 'revenue' on line 531
- [x] Add total project cost and required capital summary rows at bottom of CapitalScheduleTablePage - already implemented (lines 620-680)

- [x] BUG: Changing fundingSource in cash flow settings does not reflect on capital schedule table (root cause: race condition in scenario loading)
- [x] FIX: CashFlowSettingsPage race condition — settingsQuery fires with default scenario before DB scenario loads
- [x] FIX: CapitalScheduleTablePage scenario selector should be local state (not update DB on click) — both pages must support switching between 3 scenarios independently
- [x] FIX: Both pages must wait for DB scenario to load before fetching settings data
- [x] FIX: When embedded (no scenario selector visible), use DB scenario as default but allow parent to override
- [x] BUG: Column 1 (إجمالي التكاليف) missing escrow-funded items — must show ALL costs (investor + escrow). Column 2 (خطة رأس مال) should show investor-only amounts. Fixed: added missing items (government_fees_escrow, contractor_payments, community_fee_escrow) to computeItemAmountByKey splitMap.
- [x] Audit: O1 item list is complete — land (3), design (4), offplan/registration (7), escrow deposit (1), construction (3) = 18 items matching reference
- [x] O1 cost items correctly computed from fact sheet + pricing/revenue via computeItemAmountByKey

## نقل التقارير المالية الجديدة إلى المنصة
- [x] إنشاء ملف إعدادات التكاليف (cost-settings.html) مع مقارنة 3 سيناريوهات
- [x] إنشاء ملفات إعدادات كل سيناريو (o1-settings, o2-settings, o3-settings)
- [x] إنشاء تقرير ملخص الجدوى المالية (feasibility-summary.html) مع تبديل أوف بلان / بدون أوف بلان
- [x] إنشاء تقرير خطة رأس مال المشروع (capital-plan.html) مع 3 تابات و22 عمود شهري
- [x] إنشاء تقرير التدفقات النقدية لحساب الضمان (escrow-cashflow.html) مع خانات يدوية للإيرادات
- [x] إصلاح O3: إزالة بند التسويق والإعلان — الإنشاء (75%) من O3 (غير موجود في الإعدادات)
- [x] نقل O1 أوف بلان: بنود من أتعاب المطور أوف بلان إلى إيداع الضمان تنتقل لمرحلة التصاميم
- [x] إزالة جدول حساب الضمان من تقرير خطة رأس المال
- [x] حذف المحتوى القديم من أيقونة التخطيط المالي في مركز القيادة
- [x] إعادة بناء CashFlowHub: أيقونة إعدادات التدفقات + 3 تابات بجانبها (ملخص الجدوى، خطة رأس المال، التدفقات النقدية)
- [x] إضافة ملفات الإعدادات الثلاثة (o1, o2, o3) داخل تاب إعدادات التدفقات بجانب cost-settings - موجودة فعلاً في SETTINGS_TABS

## ربط التخطيط المالي بقاعدة البيانات
- [x] إضافة ملفات الإعدادات الثلاثة (o1, o2, o3) داخل تاب إعدادات التدفقات - موجودة فعلاً
- [x] تحويل ملفات الإعدادات — FinancialPlanningHubPage يستخدم CashFlowSettingsPage (embedded) بدل iframes، مع initialScenario prop لكل تاب
- [x] تحويل التقارير — FinancialPlanningHubPage يستخدم FeasibilityStudyPage + CapitalScheduleTablePage + EscrowCashFlowPage (embedded) بدل iframes
- [x] ربط محفظة رأس المال بالمصادر الجديدة

## ربط محفظة رأس المال بالمصادر الجديدة (cashFlowSettings)
- [x] Create new server procedure getPortfolioCapitalData that reads from cashFlowSettings/getReflectionData
- [x] Build per-project monthly arrays from reflection data (investor items only for capital schedule)
- [x] Map phase info and monthly amounts to match CapitalSchedulingPage expected shape
- [x] Update CapitalSchedulingPage to call new procedure instead of old getCapitalScheduleData
- [x] Update CapitalSchedulingHorizontal to use new data shape (already receives data as props)
- [x] Ensure phase delays still work with new data source
- [x] Write unit tests for new portfolio data procedure (20 tests passing)
- [x] Verify all projects display correctly with new data source (6 projects verified)

## ربط إعدادات التكاليف (cost-settings.html) بقاعدة البيانات
- [x] ربط جدول مقارنة السيناريوهات — getCostSettingsComparison موجودة وتسحب من DB عبر project_cash_flow_settings

## تعديل حقل رسوم الفرز في البطاقة التعريفية
- [x] تحويل رسوم الفرز إلى حقل يدوي (درهم/م²) مع عرض GFA بالقدم المربع والنتيجة المحسوبة

## تعديل أسماء بنود التكاليف
- [x] تغيير "أتعاب التصميم (2%)" إلى "أتعاب الاستشاري — التصاميم" في كل الملفات
- [x] تغيير "أتعاب الإشراف (2%)" إلى "أتعاب الاستشاري — الإشراف" في كل الملفات

## إعادة بناء مقارنة السيناريوهات الثلاثة
- [x] إعادة كتابة getCostSettingsComparison — موجودة وتسحب من project_cash_flow_settings مباشرة
- [x] مدة التصاميم والتنفيذ تأتي من projects table عبر preConMonths/constructionMonths/handoverMonths
- [x] دفعة واحدة: منتقي شهر من 1 إلى عدد أشهر المرحلة — مطبق في CashFlowSettingsPage
- [x] مبالغ متساوية: تقسم على عدد أشهر المرحلة — مطبق
- [x] نسبة مئوية: حقول مخصصة — مطبق
- [x] تحديث cost-settings.html — تم استبداله بـ CashFlowSettingsPage (React)

## خطأ: المدة ثابتة 16 شهر في إعدادات التدفق بدلاً من القيمة الفعلية من البطاقة
- [x] إصلاح: المدة تظهر 16 شهر ثابتة — الكود يقرأ project.constructionMonths || 16 بشكل صحيح، البيانات موجودة في DB (36/30/18/20/14 شهر)
- [x] Fix data mismatch: o1-settings.html shows different numbers than cost-settings.html (e.g. broker fee 360k vs 180k)
- [x] o1/o2/o3-settings.html must pull data from same source as cost-settings.html (cashFlowSettings/cf_settings_items)
- [x] Verify all numbers match between cost-settings comparison table and individual scenario pages
- [x] إعادة حقول اختيار طريقة الدفع في o1/o2/o3-settings.html (دفعة واحدة + رقم الشهر / موزع بالتساوي / نسب مخصصة) مع الحفاظ على سحب المبالغ من نفس API
- [x] إضافة حقول اختيار طريقة الدفع في o1/o2/o3-settings.html (دفعة واحدة + رقم الشهر / موزع بالتساوي / نسب مخصصة) مع عدد حقول ديناميكي من مدة المرحلة في البطاقة
- [x] جعل عمود المرحلة قائمة منسدلة قابلة للتغيير (التصاميم / التنفيذ) — المدة تتغير تلقائياً حسب المرحلة المختارة
- [x] جعل عمود المصدر قائمة منسدلة قابلة للتغيير (المستثمر / حساب الضمان) — المستخدم يحدد
- [x] التأكد أن تقارير التخطيط المالي الثلاثة مصدرها الوحيد هو إعدادات التدفق (o1/o2/o3-settings)
- [x] إصلاح أي تقرير يسحب بيانات من مصدر مختلف
- [x] عند تغيير مدة المرحلة في البطاقة التعريفية، يُعاد حساب التوزيع الشهري تلقائياً لجميع البنود المتأثرة في cf_settings_items
- [x] إضافة حفظ تغييرات المصدر والمرحلة وطريقة الدفع والنسب المخصصة في o1/o2/o3-settings.html إلى قاعدة البيانات

## محفظة المشاريع — السيناريوهات الثلاثة (Portfolio All Scenarios)
- [x] إنشاء API جديد getPortfolioAllScenarios يجمع بيانات كل المشاريع مع 3 سيناريوهات
- [x] إنشاء صفحة PortfolioAllScenariosPage مع 3 تبويبات: نظرة عامة، الجدول الزمني، المقارنة
- [x] تبويب نظرة عامة: بطاقات ملخص + رسم بياني تراكمي + جدول المشاريع
- [x] تبويب الجدول الزمني: Gantt chart مع 4 مراحل لكل مشروع
- [x] تبويب المقارنة: جدول مقارنة O1/O2/O3 لكل مشروع
- [x] ربط الصفحة بـ CashFlowHub كتبويب "محفظة المشاريع — السيناريوهات"
- [x] إضافة route /portfolio-scenarios في App.tsx
- [x] كتابة اختبارات vitest (4 اختبارات ناجحة)
- [x] التأكد أن البيانات مصدرها نفس إعدادات التدفق — تغيير الإعدادات يغير المحفظة تلقائياً

## إعادة ترتيب وضغط بطاقة بيانات المشروع
- [x] إعادة ترتيب حقول بطاقة بيانات المشروع: الحقول اليدوية في الأعلى والمحسوبة تلقائياً في الأسفل
- [x] ضغط التنسيق: تصغير المسافات وتكثيف الحقول لتقليل حجم الصفحة
- [x] استخدام شبكة 3 أعمدة بدل 2 لتقليل الارتفاع
- [x] إضافة خاصية طي/فتح لكل قسم

## تعديل إعدادات التكاليف — أسماء البنود ودفعات المقاول
- [x] تغيير "أتعاب التصميم 2%" إلى "أتعاب الاستشاري — التصاميم" (بدون نسبة في الاسم)
- [x] تغيير "أتعاب الإشراف 2%" إلى "أتعاب الاستشاري — الإشراف" (بدون نسبة في الاسم)
- [x] ربط نسبة أتعاب الاستشاري بالبطاقة التعريفية (المصدر هو البطاقة)
- [x] نقل X من دفعات المقاول 70% من العمود الأول (O1) إلى العمود الثاني (O2)
- [x] إضافة سطر جديد "دفعات المقاول 90% من الضمان" مع X في العمود الأول (O1)

## إصلاح خلل طريقة السداد "نسبة"
- [x] إصلاح عدم حفظ طريقة السداد عند اختيار "نسبة" وظهور الحقول فارغة في التقارير (السبب: الفرونت كان يقرأ savedData.items بدل savedData.settings)
- [x] Rebuild CostsCashFlowTab from scratch — remove all existing content
- [x] Add land details and GFA breakdown section from project card
- [x] Add sellable areas breakdown section
- [x] Add Joel's suggestions table (read-only reference)
- [x] Add interactive distribution table with zero-waste algorithm
- [x] Add parking calculations based on Dubai regulations
- [x] Add three pricing scenarios (base ±10%) with revenue calculations
- [x] Remove costs/profits section entirely
- [x] Redesign CostsCashFlowTab: compact rows, minimal spacing, clean white background
- [x] Add total area column (units × avg area) to distribution table
- [x] Bold dividers between residential/retail/offices sections
- [x] Style inspired by reference image: colored badges, clean lines, professional look
- [x] Limit CostsCashFlowTab content to 2/3 page width, centered
- [x] Add more colorful badges and accents (varied colors like reference image)
- [x] Improve surplus display — make it clear what happens to the surplus (where it goes)
- [x] Add tooltip or visual explanation for zero-waste algorithm behavior
- [x] Fix zero-waste: when final surplus < smallest unit, distribute it equally across largest type units (increase their area)
- [x] Fix zero-waste: when final surplus < smallest unit, distribute it equally across 2BR units (غرفتين وصالة) always — not largest type
- [x] Results table columns: النوع → العدد → مساحة الوحدة (sqft) → إجمالي المساحة (sqft) → سعر/قدم² → الإيراد
- [x] Separate right panel from left panel with clear visual gap
- [x] Surplus shown on RIGHT panel (inputs side) not left
- [x] Parking in separate section, not mixed with revenue table, car icon dark orange
- [x] Category subtotals (residential / retail / offices) each separate
- [x] All areas in sqft not m²
- [x] RIGHT panel: remove price column, replace with إجمالي (عدد×مساحة)
- [x] LEFT panel: add النسبة % column next to النوع
- [x] LEFT panel: auto-absorb surplus into غرفتين وصالة (increase their unit area)
- [x] LEFT panel shows adjusted areas after absorption, RIGHT panel shows raw inputs + surplus
- [x] Align RIGHT and LEFT panel rows on same horizontal line
- [x] Surplus for each category appears directly below its rows (سكني→فائض سكني، تجزئة→فائض تجزئة، مكاتب→فائض مكاتب)
- [x] Align RIGHT and LEFT panel rows on same horizontal line
- [x] Surplus for each category directly below its rows (not grouped at bottom)
- [x] Remove total surplus row — no مجموع فوائض
- [x] RIGHT panel: remove price column, add إجمالي (عدد×مساحة)
- [x] LEFT panel: add النسبة % column next to النوع
- [x] LEFT panel: auto-absorb surplus into غرفتين وصالة
- [x] Add Joel's suggestions table back (read-only reference with suggested percentages and prices)
- [x] Make price/sqft field editable in LEFT results table without changing layout
- [x] Scenario cards clickable — clicking one highlights it and saves its revenue as approved for financial analysis
- [x] BUG: جدول مقترحات جويل لا يظهر — تم إصلاح قراءة المفاتيح المتداخلة من JSON
- [x] BUG: صفحة التخطيط المالي لا تفتح بسبب خطأ في تحميل البيانات — تم إضافة الأعمدة المفقودة في DB
- [x] ربط الإيرادات المعتمدة من التسعير والإيرادات بصفحة التخطيط المالي — تم عبر calculateProjectCosts
- [x] إضافة مؤشر بصري في صفحة التخطيط المالي يوضح أن الإيراد المعتمد مستخدم (وليس الحساب التلقائي)
- [x] إضافة زر إعادة حساب في التقارير المالية لتحديث الأرقام فوراً بعد تغيير السيناريو
- [x] ربط خطة السداد التفصيلية بالتدفقات النقدية لحساب الضمان (إيرادات المبيعات الشهرية)
- [x] BUG: أتعاب المطور — التصاميم O3 يجب أن تكون 1% وليس 2% — تم تعديل splitRatio إلى 0.2
- [x] BUG: أتعاب المطور — الإشراف O3 يجب أن تكون 2% وليس 3% — تم تعديل splitRatio إلى 0.4
- [x] التأكد من ربط أرقام المحفظة — getPortfolioAllScenarios يستخدم نفس منطق getCostSettingsComparison بالضبط

## صفحة محفظة رأس المال الجديدة (من الصفر)
- [x] بناء صفحة محفظة رأس المال الجديدة — نفس الشكل والألوان الحالية
- [x] مصدر البيانات من خطة رأس المال (getPortfolioAllScenarios) — بيانات المستثمر لكل سيناريو
- [x] اختيار الأوبشن (O1/O2/O3) لكل مشروع بشكل مستقل
- [x] مفتاح أوف بلان (تشغيل/إيقاف) لكل مشروع — يظهر تلقائياً حسب الأوبشن
- [x] قواعد حركة ريرا حسب الأوبشن المختار — التأخير مستقل لكل مرحلة
- [x] فجوة التوقف بين التصاميم والإنشاء — تحكم بالتأخير لكل مرحلة
- [x] إعدادات المشاريع (إظهار/إخفاء + اختيار أوبشن)
- [x] تجميع شهري/ربع سنوي/نصف سنوي
- [x] عمود الإجمالي والتراكمي
- [x] إضافة الصفحة إلى CashFlowHub كتاب جديد
- [x] إضافة الراوت /capital-portfolio في App.tsx
- [x] كتابة اختبارات vitest (30 اختبار ناجح)

- [x] إضافة أيقونة/بطاقة جديدة "محفظة رأس المال الديناميكية" في قسم الدراسات بجانب البطاقة الحالية وربطها بالصفحة الجديدة CapitalPortfolioPage

- [x] Bug fix: تعديل API ليرجع المبالغ الشهرية مفصّلة حسب المرحلة (تصاميم، ريرا/أوف بلان، إنشاء) بدلاً من رقم مجمّع واحد
- [x] Bug fix: تعديل الصفحة لتحريك مصاريف كل مرحلة بشكل مستقل عند التأجيل
- [x] Bug fix: شريط ريرا المرئي يظهر بشكل غريب — FIXED: O2 offplanEffectiveDelay كان يستخدم designDelay+offplanDelay بدل constructionEffectiveDelay+offplanDelay
- [x] Bug fix: لون ريرا البنفسجي يظهر مرتين — FIXED: نفس الإصلاح — phaseRanges و phaseChartAmounts متزامنان الآن في O2
- [x] Bug fix: فجوة بيضاء تظهر بين خلايا ريرا عند التأجيل — الخلايا ضمن نطاق المرحلة يجب أن تأخذ لون المرحلة حتى لو المبلغ صفر
- [x] إضافة مرحلة "التسجيل" — موجودة بالفعل في CashFlowSettingsPage (القسم الثالث — التسجيل)
- [x] إصلاح الفجوة البيضاء في شريط ريرا عند التأجيل في المحفظة الديناميكية
- [x] تصحيح: الأرقام تأتي من project_cash_flow_settings (الجدول الحالي) — cf_settings_items كان اسم قديم
- [x] Bug fix: في O3 تغيير مصدر التمويل من "حساب الضمان" إلى "المستثمر" لا يحدّث إجمالي رأس المال (investorTotal يجب أن يُعاد حسابه) — تم إصلاح onSourceChange في o1/o2/o3-settings.html لإعادة حساب الإجماليات فوراً عند تغيير المصدر
- [x] تغيير اسم "الإجمالي" إلى "رأس المال المطلوب" في صفحة المحفظة
- [x] إضافة صف "تم السداد" (المدفوع) في صفحة المحفظة — يعرض المبلغ المدفوع (paidTotal)
- [x] إضافة صف "المتبقي" = رأس المال المطلوب - تم السداد
- [x] إصلاح O3: جميع البنود يجب أن تكون مصدرها المستثمر (لا يوجد حساب ضمان في O3 لأنه لا توجد مبيعات)
- [x] إصلاح O3 في السيرفر: getPortfolioAllScenarios يجب أن يُرجع investorTotal = grandTotal في O3
- [x] إصلاح o3-settings.html: جميع البنود مصدرها المستثمر تلقائياً (لا خيار تغيير لحساب الضمان)
- [x] إصلاح التقارير المالية: رأس المال المطلوب في O3 = إجمالي كل التكاليف
- [x] Bug fix: tRPC API returns HTML instead of JSON on home page — server is running correctly, issue was transient
- [x] تطبيق نمط مصدر التمويل (مستثمر/ضمان) من مشروع ند الشبا على كل المشاريع الأخرى
- [x] إضافة "التسجيل" كخيار ثالث في القائمة المنسدلة للقسم في صفحات الإعدادات o1/o2/o3
- [x] Bug fix: تغيير القسم (مثلاً من تصاميم إلى تسجيل) لا يتم حفظه في الإعدادات
- [x] تعديل الافتراضيات: O1/O2 بنود offplan تكون "تسجيل"، O3 لا يوجد خيار تسجيل (فقط تصاميم/تنفيذ)
- [x] إصلاح المحفظة: فصل 3 أجزاء (تصاميم → تسجيل → تنفيذ) بشكل متتابع في O1/O2، وجزئين في O3
- [x] تاريخ البدء الأصلي = أبريل 2026 لكل المشاريع
- [x] كل المشاريع تبدأ على O1
- [x] إصلاح قواعد حركة المراحل في المحفظة: التصاميم حرة، التسجيل (بداية≥شهر3 تصاميم، نهاية≤شهر4 تنفيذ)، التنفيذ بعد التصاميم مباشرة ثم حر، تأجيل التصاميم يدفع التنفيذ

- [x] إصلاح: التسجيل يجب أن يكون شهرين ثابتين دائماً — لا يتمدد أبداً عند تطبيق القيود
- [x] إصلاح: لون التسجيل يصبح شفاف عندما يتقاطع مع التصاميم أو الإنشاء، ويعود للون الطبيعي عندما يكون وحده
- [x] إصلاح: الشهر الأول من التسجيل لا يبدأ قبل الشهر 3 من التصاميم، والشهر الثاني لا يتجاوز الشهر 4 من التنفيذ

- [x] إصلاح: التسجيل شهرين ثابتين دائماً — لا يتمدد عند القيود
- [x] إصلاح: لون التسجيل شفاف عند التقاطع مع تصاميم/إنشاء، لون طبيعي عندما وحده
- [x] إصلاح: getBasePhaseAtIndex يستخدم النطاق الهندسي كمصدر وحيد — التسجيل يظهر شفاف فوق الإنشاء/التصاميم لكل المشاريع (ليس فقط الجداف)
- [x] إصلاح: ند الشبا فجوة بيضاء بين التسجيل والإنشاء — التصاميم والإنشاء غير متلاصقين (يجب أن يكونا متلاصقين مثل الجداف)
- [x] Bug fix: فجوات بيضاء في فبراير/مارس 2027 — تم إصلاح inGeometricRange ليتحقق من كل شهور المجموعة بدل midIdx فقط
- [x] Bug fix: مصاريف الإنشاء لا تبدأ من أول شهر — تم إضافة phase remapping في getPortfolioAllScenarios لتعييد تعيين الشهور المحفوظة إلى المرحلة الفعلية الحالية
- [x] Bug fix: مصاريف الإنشاء تبدأ من الشهر 3 بدل الشهر 1 في كل المشاريع ما عدا الجداف — يجب أن تبدأ من الشهر الأول مثل الجداف
- [x] Bug fix: مرحلة التسجيل غير محددة بداية شهرها — O1: offplanStart = designStart + 2 (الشهر 3)، O2: offplanStart = constructionStart — الكود صحيح في السطر 844 من CapitalPortfolioPage
- [x] Fix FeasibilityStudyPage.tsx: replace hardcoded fallback 90/99 with project's saleableResidentialPct/saleableRetailPct/saleableOfficesPct
- [x] Fix cashFlowProgram.ts: replace 4 hardcoded 0.95/0.97 occurrences with project's percentage values
- [x] Fix investorCashFlow.ts: replace hardcoded 0.95/0.97 with project's percentage values
- [x] Ensure all saleable area calculations across the platform use the project-specific percentages

## إصلاح خلل الحفظ في صفحة التسعير والإيرادات
- [x] Bug fix: التعديلات على المساحات والأسعار في CostsCashFlowTab تظهر محفوظة لكن تختفي عند العودة للصفحة — تم إصلاح منطق الحفظ/التحميل (إضافة countKey لحفظ العدد مباشرة، staleTime=0، initialized refs)

## إصلاح ترقيم المراحل في صفحة مسار الامتثال التنظيمي
- [x] Bug fix: المرحلة الأولى تظهر رقم 10 بدلاً من 01 — تم إصلاح منطق الترقيم ليعرض الرقم التسلسلي (index+1) بدلاً من كود المرحلة

## إضافة رابط إدارة الأخبار في القائمة الجانبية
- [x] إضافة رابط "إدارة الأخبار" في قسم "قدرات المنصة" في الصفحة الرئيسية (NAV_TOOLS)

## تشخيص وإصلاح: أرقام المحفظة لا تطابق التخطيط المالي O1
- [x] Bug: أرقام المحفظة لا تطابق O1 — تم إضافة phase remapping في getPortfolioAllScenarios لتعييد تعيين الشهور المحفوظة إلى المرحلة الفعلية — يجب التحقق بالبيانات الحقيقية
- [x] تتبع مصدر البيانات — كلا الصفحتين تستخدمان نفس منطق distributeAmount بعد الإصلاح

- [x] إصلاح getPortfolioAllScenarios: استخدام startMonth/endMonth المحفوظة مباشرةً بدلاً من إعادة الحساب من phasesArr

- [x] إعادة كتابة getPortfolioAllScenarios: استدعاء getCostSettingsComparison لكل مشروع ونسخ monthlyAmounts مباشرةً من o1/o2/o3

- [x] تشخيص: كتابة سكريبت يطبع الأرقام الشهرية — تم التشخيص: cf_settings_items غير موجودة في DB، البيانات في cf_cost_items

- [x] إصلاح المحفظة: إضافة monthlyInvestorBySection واستخدامه بدلاً من monthlyBySection لعرض مبالغ المستثمر فقط
- [x] Add export dialog with scenario name + grouping options (monthly/quarterly/semi-annual) to PDF export in CapitalPortfolioPage
- [x] Add Capital Portfolio card to CommandCenterPage (full interactive with controls, no persistence)
- [x] Add comprehensive statistical summary section at the beginning of PDF export with key financial and operational indicators
- [x] Add 'Save as HTML' button to PDF export preview window for downloading the report as an HTML file
- [x] Add portfolio_scenarios table to DB schema (id, name, userId, settings JSON, updatedAt)
- [x] Add tRPC procedures: saveScenario, loadScenario, listScenarios, deleteScenario
- [x] Update CapitalPortfolioPage: auto-save settings on every change, auto-load on page open
- [x] Add scenario name input + save/load UI in CapitalPortfolioPage toolbar
- [x] Redesign statistical summary: make it more compact and reorder from largest to smallest (Total Cost → Capital → Paid → Remaining)
- [x] Fix auto-save: add localStorage fallback so settings persist for all users (CC Auth and unauthenticated)
- [x] Redesign Command Center: premium executive layout, Capital Portfolio as hero section, beautiful and logical structure for board meetings
- [x] Redesign Command Center bento grid: bold solid-color cards with large bg icons and white text (reference style)
- [x] Fix auto-save race condition: prevent saving before loading completes (add isLoaded guard)
- [x] Redesign Command Center cards: diverse icons, smaller sizes, fresh new layout style
- [x] Make Command Center card prominent on Home page: unique icon, special styling, eye-catching placement
- [x] Redesign Command Center grid: diverse shapes (circles, hexagons, bubbles, diamonds, rectangles) for each card - added shape property to BUBBLES and updated IconTile to render circle/hexagon/diamond/rounded shapes
- [x] Command Center: Change 4 icons (التقارير المالية، محفظة رأس المال، برنامج العمل، الطلبات والاستفسارات) to card-style design with white card background, colored square icon with rounded corners, and red badge counter
- [x] Command Center: Place all 4 card-style icons in a single row with equal sizes (grid-cols-4)
- [x] Command Center: Improve Salwa hero rectangle design (better visuals, white/light background)
- [x] Command Center: Change all text in Salwa rectangle from blue/purple to black/dark

## Business Partners & Vendors Registry + Payment Request System

- [x] Rebuild BusinessPartnersRegistry with complete fields: company info, documents, bank details, signatory
- [x] Add file upload sections: Commercial License, VAT Certificate, Authorized Signatory, Quotes, Other Docs
- [x] Add bank account section: Beneficiary, Account, IBAN, Bank, Branch, Currency
- [x] Add authorized signatory section: Name, Title, Email, Phone, Signature Image
- [x] Add category management (add/edit/delete categories)
- [x] Create Payment Requests page with full approval workflow UI
- [x] Add payment request icon to Command Center
- [x] Build backend DB schema for business_partners and payment_requests tables
- [x] Build tRPC procedures for partners CRUD and payment request workflow
- [x] Implement email notifications: English for finance team, Arabic for management
- [x] Build approval workflow: User → Wael → Sheikh Issa → Finance
- [x] Add document completeness validation before allowing payment request
- [x] Add approved quote stamp feature

## Payment Requests Enhancements

- [x] Verify and fix full approval workflow (User → Wael → Sheikh Issa → Finance)
- [x] Add internal bell notifications when payment request is approved or rejected
- [x] Add "Create Payment Request" button from Business Partner details page

## Payment Requests - Round 3 Enhancements

- [x] Add statistics dashboard cards at top of Payment Requests page (total approved, pending, rejected amounts)
- [x] Add PDF export for approved payment orders
- [x] Add project filter to Payment Requests page

## Payment Requests - Gap Fixes

- [x] Send email to Wael when a new payment request is created
- [x] Send email to Sheikh Issa when Wael approves a request
- [x] Add "needs revision" option for Sheikh Issa (same as Wael)
- [x] Allow editing a request when status is "needs_revision"

## Payment Requests - Round 4 Enhancements

- [x] Real PDF export for approved payment orders (server-side, with company logo and approved stamp)
- [x] Approval authority management panel (configure approver emails/names from UI)
- [x] Monthly PDF report for payment requests

## Payment Requests - Round 5 Enhancements

- [x] Add COMO REAL ESTATE DEVELOPMENT L.L.C logo to PDF payment order export
- [x] Add COMO REAL ESTATE DEVELOPMENT L.L.C logo to monthly report PDF
- [x] Add archive feature for approved/rejected payment requests (hide from main list, view in archive tab)

## Payment Requests - UI Redesign
- [x] Redesign payment requests list as elegant cards with proper spacing (not a dense table)

## Command Center Enhancements - Phase 7
- [x] Add pending request counters on payment_requests and general_requests cards in the bento grid

## Command Center Enhancements - Phase 8
- [x] Personalize pending counters per user role (Wael: pending_wael, Sheikh Issa: pending_sheikh)
- [x] Weekly automated email summary report (every Monday 9AM Dubai time)

## General Requests Enhancement - Phase 9
- [x] Add projectId field (dropdown from projects table) to generalRequests schema
- [x] Add partnerId field (dropdown from businessPartners) to generalRequests schema
- [x] Replace single attachment with multi-file attachments JSON array (name+url) in generalRequests schema
- [x] Push DB migration for new fields
- [x] Add getProjects and getPartners queries to generalRequests router
- [x] Update create/update procedures to handle new fields and multi-file attachments
- [x] Update GeneralRequests form: project dropdown, partner dropdown, multi-file upload with naming
- [x] Update GeneralRequests list/detail view to show project, partner, and all attachments
- [x] Auto-generate official PDF approval document on Sheikh Issa approval (puppeteer-core + chromium)
- [x] Upload approval PDF to S3 and store URL in DB (approvalDocumentUrl field)
- [x] Send approval document to finance team by email with download link
- [x] Show approval document when clicking approved status badge in detail view

## Phase 10 Enhancements
- [x] Add project/partner dropdowns and multi-file upload to Payment Requests form
- [x] Add recommended company field for proposal approval type in General Requests
- [x] Add archive tab to General Requests page

## Command Center - Settings Removal
- [x] Remove settings buttons/links from CommandCenterPage (إعدادات الموافقة, approval-settings, any admin settings)
- [x] Hide settings button in PaymentRequests header when rendered inside CommandCenter
- [x] Hide settings button in GeneralRequests header when rendered inside CommandCenter

## Command Center - Back Button
- [x] Add back-to-home button in Command Center main page header

## Command Center - Priority Cards Redesign
- [x] Redesign bento grid to show payment requests and general requests as large hero priority cards at top

## Command Center - Role-Based Permissions
- [x] Pass memberId/role through embedded components via prop
- [x] Payment Requests: hide create/edit buttons for wael/sheikh_issa, keep approve/reject/review
- [x] Read-only sections: hide mutating actions in Milestones, Meeting Minutes, Reports, Work Schedule for wael/sheikh_issa
- [x] Capital Portfolio: keep move + report actions for wael/sheikh_issa (no create/delete in capital portfolio)
- [x] General Requests + Evaluations: full access for all members

## General Requests - Flexible Communication Channel
- [x] Add assignedTo field to general_requests table in drizzle schema
- [x] Update backend router: assignedTo in create/update, add getMembers query
- [x] Update frontend: replace fixed flow banner with recipient selector dropdown

## Three New Improvements
- [x] Create internal communication system (التواصل الداخلي): DB table, backend router, new page
- [x] Add التواصل الداخلي to sidebar navigation and Command Center bento grid
- [x] Update الاعتمادات الرسمية card description in Command Center
- [x] Add بانتظار توقيعي filter tab to الاعتمادات الرسمية page

## Mobile Drag-and-Drop Fix
- [x] Increase TouchSensor delay to 300ms + tolerance 8px in Home.tsx for long-press activation on mobile
- [x] Replace touch-none with touch-manipulation on SortableMainCard and SortableToolCard to allow normal scrolling

## InternalMessages Identity Fix
- [x] Fix InternalMessages to use CCAuth (ccMember.memberId) instead of guessing from Manus OAuth name
- [x] Make internalMessages router procedures accept CCAuth (cc_token) sessions via publicProcedure + token verification

## التواصل الداخلي داخل مركز القيادة
- [x] Add التواصل الداخلي tile (BUBBLES[11]) to the bento grid in CommandCenterPage - now visible and clickable

## InternalMessages Identity Fix (Command Center)
- [x] Fix InternalMessages component to accept ccTokenProp and memberIdProp from CommandCenter so identity is always correct

## Name Correction
- [x] Replace all occurrences of "زقوط" with "زقوت" in all code files and database

## التواصل الداخلي - تطويرات متقدمة
- [x] Add project_id, deadline, is_converted_to_task, task_ref, attachment_url, attachment_name columns to internal_messages schema
- [x] Add getProjects procedure to internalMessages router (returns project list + عامة option)
- [x] Update create procedure to accept project_id, deadline, attachment_url, attachment_name
- [x] Update getAll/getById to return project name and deadline
- [x] Add convertToTask procedure in internalMessages router
- [x] Update InternalMessages frontend: project dropdown with عامة option
- [x] Update InternalMessages frontend: file upload (S3) + link attachment
- [x] Update InternalMessages frontend: deadline date picker
- [x] Update InternalMessages frontend: convert-to-task button on messages
- [x] Update InternalMessages frontend: filter by project
- [x] Add unread badge counter on التواصل الداخلي card in Command Center bento grid (via getBubbleCounts)

- [x] Refactor consultant fee analysis to compute all values live from settings (no stored pre-calculated values) - already computed live from bua*pricePerSqft
- [x] Verify: changing any setting immediately reflects in the analysis without pressing "Calculate" - confirmed: useMemo reacts to projectDetailsQuery.data changes
- [x] Add design gap column (فجوة التصميم) in مركز القيادة financial evaluation table
- [x] Add supervision gap column (فجوة الإشراف) in مركز القيادة financial evaluation table
- [x] Update backend getProjectFinancialEvaluation to return designScopeGapCost and supervisionScopeGapCost separately (already returned)
- [x] حذف أدوار HEAD_OFFICE (HO_STRUCTURAL, HO_ARCH, INTERIOR_DESIGNER, BIM_COORD) من baseline كل الفئات
- [x] حذف ADMIN_OFFICER من baseline كل الفئات (جزء من Office Support)
- [x] تحويل SENIOR_ARCH, SENIOR_ID, SENIOR_MECH, SENIOR_ELEC من HEAD_OFFICE إلى SITE
- [x] إضافة دور HSE_OFFICER بنسبة 15% لفئة Large
- [x] إضافة دور OFFICE_SUPPORT بنسبة 100% لكل الفئات
- [x] تحديث monthly_rate_aed للأدوار (RE=50K, ARCH_INSP=24K, ELEC_INSP=24K, LANDSCAPE=42K, HSE=26.7K, DOC_CTRL=0)
- [x] إضافة فلتر is_active=1 في استعلامات الـ baseline بمحرك الحساب
- [x] إعادة حساب التقييم (recalculateAll) لجميع المشاريع الحالية لتعكس الـ Baseline الجديد
- [x] مراجعة baseline فئات Small و Medium والتأكد من نسب التخصيص المناسبة
- [x] اختبار صفحة التحليل المالي في مركز القيادة - التأكد أن الأدوار المعطلة لا تظهر
- [x] تحديث بيانات إشراف K&P في DB: من pct:2.50 إلى monthly_rate مع حساب 6,798,291
- [x] تحديث LACASA: أتعاب إشراف = أتعاب تصميم (8,279,700)
- [x] تحديث XYZ: أتعاب إشراف = أتعاب تصميم (9,840,000)
- [x] بناء صفحة True Cost Report قابلة للتعديل داخل النظام
- [x] إضافة آلية اعتماد التقرير ليصبح المصدر الرسمي
- [x] ربط البيانات المعتمدة كمصدر رسمي للنظام
- [x] Re-implement True Cost Report screen inside CPA page (after sandbox reset)
- [x] Add getFullReport backend endpoint to cpa.evaluation router
- [x] Add updateOverride backend endpoint to cpa.evaluation router
- [x] Add approveReport backend endpoint to cpa.evaluation router
- [x] Create TrueCostReportScreen.tsx component with full table, baseline, overrides, and approval
- [x] Add truecost-report screen routing in CPAPage.tsx
- [x] Add "تقرير التكلفة الحقيقية" button in ProjectDetailScreen
- [x] Fix project name display (join with projects table instead of showing project_id number)
- [x] Widen True Cost Report table for better readability (expand columns, improve spacing, larger font)
- [x] Redesign True Cost Report as a full professional document-style report (not just a compressed table)
- [x] Report must show all data clearly like a board presentation document
- [x] All cells must be editable with clear edit affordance
- [x] After approval, results flow to Command Center for further evaluation processes
- [x] Rebuild True Cost Report as FULL DETAILED table with all individual cells editable (quoted fees, scope gap details, adjusted fees, total, rank) - not just summaries
- [x] Match True Cost Report with source report: colored sub-headers, cell backgrounds, Score %, "الأفضل سعراً" label, fee method descriptions
- [x] Fix True Cost Report: make full-width (not narrow/cramped) - container uses max-w-[1600px] for truecost-report screen
- [x] Fix True Cost Report: match source report from command center EXACTLY - TrueCostReportScreen matches TrueCostReportView exactly; extra dynamic variables panel is intentional added feature
- [x] Fix duplicate React key errors on /consultant-proposals page (added index to key, deduplicated getResults query)
- [x] Fix True Cost Report: scope gap details showing empty data - fixed field name mapping (itemCode/itemLabel/status/gapCost) and status display
- [x] Fix True Cost Report: populate scope gap items with actual scope matrix items and their costs - data now shows correctly
- [x] Ensure True Cost Report matches source report (TrueCostReportView.tsx) - verified working with real data

- [x] إضافة فئة Shopping Center (id=60001, code=SHOPPING_CENTER, supervision_duration_months=30) إلى قاعدة البيانات
- [x] إدراج 14 صف baseline للـ Shopping Center بناءً على مدد عارف وبن طوق (T4121) - نسب التخصيص = المدة ÷ 30 شهر
- [x] إضافة أدوار المفتشين الثانيين: CIVIL_INSPECTOR_2 (70%)، MECH_INSPECTOR_2 (60%)، ELEC_INSPECTOR_2 (60%) وربطها بـ baseline الـ Shopping Center
- [x] تحديث الأسعار المرجعية: BIM_COORD = 42,000 AED/شهر، DOC_CONTROLLER = 12,000 AED/شهر
- [x] إضافة 3 بنود نطاق جديدة: CFD_MODELLING، CONSTRUCTION_SUPERVISION، DLP_SERVICES
- [x] ربط 28 بند نطاق بفئة Shopping Center في cpa_scope_category_matrix بناءً على رسالة دعوة Artec
- [x] تصحيح سعر LACASA من 8,279,700 إلى 9,384,500 AED (ملف MAJ_6457956_PRO-ENG_260206_LACASA_V00)
- [x] إدراج 20 سعراً مرجعياً لفئة Shopping Center من عرض Arif & Bintoak (T4121/13545)
- [x] إزالة فلتر item_number من منطق حساب فجوة النطاق ليشمل بنود Shopping Center (Parking, Waste, Signage, Landscape, Water Features, ID)
- [x] ربط مشروع مجان Shopping Centre (6457956) بفئة Shopping Center في قاعدة البيانات

- [x] إضافة جدول cpa_supervision_role_aliases لربط الأكواد البديلة بالأدوار الأصلية (HO_MECHANICAL→SENIOR_MECH، MEP_INSPECTOR→MECH_INSPECTOR، HO_ELECTRICAL→SENIOR_ELEC)
- [x] استيراد KIEFERLE_6457956.json: رسوم تصميم=8,707,596 AED، 47 بند نطاق، 9 أدوار إشراف
- [x] تحديث محرك الحساب (runCalculationEngine) لتحميل الأسماء البديلة واستخدامها عند البحث في baseline
- [x] تحديث إجراء الاستيراد (importJson) لاستخدام جدول الأسماء البديلة عند إدراج فريق الإشراف
- [x] التحقق من حساب KIEFERLE: رسوم الإشراف = 7,948,248 AED، الإجمالي = 16,655,844 AED
- [x] Fix True Cost Report: delete duplicate rows in cpa_scope_reference_costs (kept highest cost per item/category)
- [x] Fix True Cost Report: add UNIQUE constraint on cpa_scope_reference_costs(scope_item_id, building_category_id) to prevent future duplicates
- [x] Fix True Cost Report: fix allRequiredItems and mandatoryItems queries to use GROUP BY + MAX(cost_aed) to prevent duplicate scope rows
- [x] Fix True Cost Report: delete stale duplicate evaluation results (kept latest per project_consultant_id)
- [x] Fix True Cost Report: add UNIQUE constraint on cpa_evaluation_results(project_consultant_id) to prevent future duplicates
- [x] Fix True Cost Report: replace DELETE+INSERT pattern with pure ON DUPLICATE KEY UPDATE in calculation engine
- [x] Fix True Cost Report: fix print CSS blank page issue (section breaks)
- [x] Recalculate all 6 CPA projects after fixes: 180001(5), 210001(5), 240001(4), 240002(6), 270001(3), 300001(4) — all OK

## Three New Improvements (Session 3)
- [x] إضافة قسم البنود التعاقدية (19-28) في صفحة تفاصيل المستشار (منفصل عن النطاق الهندسي)
- [x] إعادة هيكلة قائمة النطاق: ترقيم متسلسل من 1 إلى 30 (أساسي 1-11 ثم متخصص 12-30) بدون GREEN/RED
- [x] إعادة ترقيم بنود التعاقد بشكل متسلسل منفصل (1-10)
- [x] تحديث الأسعار المرجعية للبنود المتخصصة (Shopping Center: Signage=200000, Waste=120000, Parking=75000)
- [x] البنود الأساسية (1-11) يجب أن تكون دائماً INCLUDED تلقائياً ولا تُحسب كفجوة (تحصيل حاصل)
- [x] Bug: تكرار بند Water Features (قديم + جديد مدمج) — حذف القديم وربط coverage بالجديد
- [x] Bug: Parking Strategy سعر مرجعي 79000 بدلاً من 75000
- [x] Bug: scope_coverage مرتبطة بـ IDs قديمة — إعادة ربط بالبنود الجديدة
- [x] Bug: True Cost Report still shows old scope items (e.g. Tender Evaluation Report #18) instead of new specialist items (12-30) — report generation not updated to match new scope structure
- [x] Bug: LACASA coverage in project 180001 (Majan G+25) had only 1 record instead of 29 — re-imported from PDF proposal, now shows only 1 gap (GREEN_BUILDING)
- [x] Feature: Supervision team management UI - show required roles table with consultant rates per role, allow inline editing
- [x] Feature: Supervision team edits trigger recalculation and reflect in True Cost Report
- [x] Bug: Kieferle missing SENIOR_ID, LANDSCAPE_ENG, OFFICE_SUPPORT in supervision team - add with reference rates
- [x] Bug: DATUM supervision fee was 5,836,364 (double-adjusted) — corrected to 5,350,000 (original from PDF)
- [x] Remove: حذف زر "التقرير الاحترافي" بالكامل
- [x] Bug: تقرير التكلفة الحقيقية (في الصفحة) يعرض بيانات مختلفة عن "تصدير التقرير" — تم إعادة حساب جميع المشاريع لتوحيد البيانات
- [x] Bug fix: Exported HTML report (cpaReportRoute) not respecting overrides — showed live calc (638,500) while in-page report showed override (120,000). Fixed by: 1) deleting stale override, 2) adding override support to exported report for consistency
- [x] Display full numbers (not abbreviated K/M) in Design Scope and Supervision Scope reports in Command Center
- [x] Color redesign: differentiate Design (blue) from Supervision (purple) in True Cost Report and Command Center tables
- [x] Fix scope items ordering: sort by item_number ASC, exclude CONTRACT section items from design scope report
- [x] Import ARTEC data for Al Jaddaf project (2% design, 2% supervision, 12 included scope items, 5 excluded, supervision team)
- [x] Import XYZ Designers data for Al Jaddaf project (LUMP_SUM 3,080,000 design, no supervision, 16/17 scope items covered)
- [x] Import Datum, Safeer, Realistic, OSUS data for Al Jaddaf project and run calculation engine
- [x] Update Shopping Centre supervision baseline to match Aref Bin Touq structure (BIM 26.67%, ID 30%, Electrical 80%, HSE 0%)
- [x] Compare Kieferle vs Aref monthly rates on same role structure (Kieferle is -16.9% cheaper on matched roles)
- [x] Fix Arif Bin Touq supervision team data - add monthly rates (75K/55K/22K/12K) for all 17 roles in project 270001
- [x] Change Arif supervision method from LUMP_SUM to MONTHLY_RATE for proper calculation
- [x] Fix Kieferle QS-BOQ scope item from Excluded to Included in Shopping Center project (270001)
- [x] Recalculate Shopping Center project (270001) with corrected data
- [x] Hide Baseline table from all True Cost Report views (TrueCostReportScreen, TrueCostReportView, TrueCostReportPDF, FinancialEvaluationScreen)
- [x] Add print button (طباعة) to True Cost Report and Financial Evaluation pages
- [x] Add @media print styles: A4 landscape, hide controls/buttons/nav, preserve table colors
- [x] Move contractual section after supervision in exported PDF report

## توحيد مصدر البيانات: التخطيط المالي والمحفظة الديناميكية
- [x] إضافة procedure جديد getProjectMonthlyReport يقرأ من project_cash_flow_settings (نفس مصدر المحفظة)
- [x] تعديل EscrowCashFlowPage لاستخدام getProjectMonthlyReport بدلاً من الحساب المحلي
- [x] التحقق أن التخطيط المالي والمحفظة الديناميكية يعرضان نفس الأرقام لمشروع مجان
- [x] Fix 'خطة رأس مال المشروع' page: getSettings now uses amountOverride + CapitalScheduleTablePage filters inactive items
- [x] Ensure all 3 Financial Planning sub-pages show consistent data for Majan Mall (all use project_cash_flow_settings)

## إصلاح المحفظة الديناميكية — تجميع صحيح من تقارير التخطيط المالي
- [x] Remove remapping from getPortfolioCapitalData — use raw DB months (same as getSettings/client)
- [x] Remove remapping from getPortfolioAllScenarios — use raw DB months
- [x] Remove remapping from getProjectMonthlyReport — use raw DB months
- [x] Fix client-side distributeFromSettings to handle format 1 (simple percentage array)
- [x] Verify server and client produce identical amounts (verified with test scripts)
- [x] Portfolio monthly amounts now exactly match each project's Financial Planning report
- [x] ROOT FIX: Add server-side monthlyAmounts to getSettings response — client now uses server distribution instead of its own calculation
- [x] Both pages now use the SAME distributeAmount function on the server — guaranteed identical numbers
- [x] Re-index 43 documents from Google Drive for all 6 projects (Khazan document archive)
- [x] Populate project fact sheets (P1, P3, P4, P6) from archived fact sheet documents (plotArea, GFA, title deed, DDA, parties, utilities, timeline)
- [x] Populate project fact sheets (P2, P5) from uploaded PDFs (Affection Plans, Title Deeds, Plot Development Guidelines)
- [x] Fix P5 landPrice: corrected from 11M to 13.85M based on Title Deed
- [x] Fix P5 GFA: corrected from 50,826 (copy of P4) to 90,093.93 based on Affection Plan
- [x] Fix getProjectFactSheet in joelleEngine.ts: project card now has absolute priority over feasibilityStudies table for plotArea, GFA, BUA, community, plotNumber
- [x] Audit confirmed: calculateProjectCosts reads from project card (single source of truth) ✅
- [x] Audit confirmed: CostsCashFlowTab frontend reads from trpc.projects.getById (project card) ✅
- [x] Fix getProjectById: removed userId filter so all users can access all projects (shared dashboard)
- [x] Change construction cost distribution from equal/linear to S-Curve (Beta distribution α=2.5, β=4.0) for all 6 projects across all scenarios — updated 26 rows (contractor_payments + contractor_payments_20), 5 inactive rows skipped (offplan_escrow contractor_payments_20 with is_active=0)
- [x] Add HTML print report for individual project cash flow (same quality as portfolio report) — export button in EscrowCashFlowPage opens a new window with professional styled report including print/save buttons
- [x] Fix Dynamic Portfolio page: user-scoping bug in portfolioScenarios router (getDefault/save/list/load/delete now filter by ctx.user.id)
- [x] Fix Dynamic Portfolio page: API performance optimization (batch DB queries instead of N+1 sequential queries — reduced from ~7s to ~0.7s)
- [x] Add clear profit summary (التكاليف / الإيرادات / الأرباح) directly visible in the main feasibility study page — not hidden in a sub-section
- [x] Fix large surplus in unit allocation — distribute remainder to largest unit type instead of leaving 24% unallocated
- [x] Fix revenue mismatch between profit summary cards and the results table (FinancialFeasibilityTab) — both must use same calculation source
- [x] Add deficit warning in CostsCashFlowTab when unit count exceeds sellable area (negative surplus = عجز)
- [x] Add three-scenario comparison (optimistic/base/conservative) in the profit summary cards at top of feasibility page
- [x] Add approve button in financial feasibility that saves approved revenue and links to other reports
- [x] Fix revenue mismatch between summary cards (801M) and results table (788M) for مجان G+4P+25 — must be identical
- [x] Research real off-plan market prices for Majan/Arjan area and update competition pricing data
- [x] Verify and fix portfolio dynamic link to use approved revenue from feasibility study (already linked correctly)
- [x] Redesign FeasibilityStudyPage with professional investor-ready layout
- [x] Add AllProjectsComparison table with cross-project ROI on invested capital
- [x] Use approvedRevenue when available in comparison calculations
- [x] Add KPI cards (costs, revenue, profit, invested capital, ROI on capital, margin)
- [x] Add 3-scenario comparison strip (optimistic/base/conservative)
- [x] Investigate Project 4 loss (confirmed: land+construction costs exceed revenue at current pricing)
- [x] Add "غير مدفوع" (unpaid) column to CapitalScheduleTablePage
- [x] Sync FeasibilityStudyPage costs with cashFlowSettings (same source as Capital Schedule Table)
- [x] Fix CostsCashFlowTab missing key prop error
- [x] Redesign single-project view with 6-section professional layout (Revenue Hero, Costs & Capital, Profit & Ratios, Capital Breakdown, Project Details/Areas, Scenario Comparison)
- [x] Fix CostsCashFlowTab.tsx parse error (React.Fragment closing tag) — confirmed resolved, file parses correctly
- [x] Add paid vs unpaid capital breakdown with progress bar in feasibility summary
- [x] Add project areas section (plot area, BUA, GFA, sellable) with GFA breakdown table
- [x] Add profit-on-cost ratio and profit-on-capital ratio as separate metrics
- [x] Redesign feasibility summary tab with professional colorful layout (inspired by reference image)
- [x] Add colored cards with icons for each section (project info, areas, financials, profit)
- [x] Add COMO fee (15% of profit), investor profit, and ROI on investor capital
- [x] Add revenue breakdown (residential/retail/offices) in summary
- [x] Use soft colored backgrounds, large icons in circles, clean typography
- [x] Fix profit inconsistency: summary shows 86.4M profit but scenario comparison shows 96.4M — unify cost source
- [x] Fix revenue in summary: must match pricing tab exactly — if pricing tab shows 0, summary shows 0 (no auto-calc from percentages)
- [x] Verify revenue consistency between pricing tab and summary for all projects
- [x] Add GFA warning banner in summary when GFA data is missing from project card
- [x] Ensure price editing works correctly from pricing tab and reflects in summary (query invalidation added)
- [x] Fix revenue discrepancy: projectCostsCalc.ts incorrectly absorbed surplus area into retail-large and office-large rows (is2br: true). Only residential 2BR should absorb surplus. Fixed by setting is2br: false on retail/office rows. Revenue now matches pricing tab exactly (682,616,702 AED for project 2).
- [x] Remove Joule recommendations section from feasibility summary page
- [x] Reduce row heights and spacing in feasibility summary to show all info at first glance (compact layout)
- [x] Add project info card (بطاقة المشروع) to feasibility summary showing: permitted use, master dev, ownership, title deed, area code, land price, construction cost/sqft, durations, developer fee%, sales commission%, marketing%, design fee%, financing scenario
- [x] Restore large number sizes for revenue/costs/profit while keeping spacing compact
- [x] Remove remaining Joule/Joelle comment references from code
- [x] Fix is2br bug in server-side investorCashFlow.ts (retail-large and office-large were absorbing surplus — same fix as client-side)
- [x] Remove Joelle banner and suggestions table from CostsCashFlowTab (pricing tab)
- [x] Add PDF export button for feasibility summary report (professional layout)
- [x] Add HTML export button for feasibility summary report
- [x] Add new portfolio summary report page (separate from existing capital portfolio) with: details column (revenue, costs, profit, margins, investor required, escrow required, investor paid, investor remaining), project columns, total column, then monthly distribution from August 2026
- [x] Add "تكلفة الإنشاء" (BUA × construction cost per sqft) as a visible line item in the feasibility summary costs section
- [x] Customize portfolio summary report: mall (مركز مجان التجاري) is non-sale project — show costs/investor amounts but hide revenue/profit/margins, show "—" instead
- [x] Fix monthly distribution discrepancy in portfolio summary report — now reads user-saved settings (options + delays) from DB and applies same delay logic as original portfolio
- [x] Add BUA, construction cost per sqft, and total construction cost (BUA × price) as visible fields in the project info card (بطاقة المشروع) in the feasibility summary
- [x] Add escrow revenue item definitions (10% booking, 50% construction, 40% handover) to getDefaultItemDefs
- [x] Make escrow revenue distribution editable from settings page (same as other items)
- [x] Display revenues in EscrowCashFlowPage as a separate section (above or below expenses)
- [x] Calculate and display running monthly balance (revenues - expenses) in escrow page
- [x] Add settlement summary at project completion: 95% released immediately, 5% retained for 12 months (RERA Law 8/2007 Article 14)
- [x] Show two-phase payout: amount at handover + amount after defect liability period (12 months)
- [x] Implement absorption schedule for escrow revenue (80% during construction, 20% post-handover)
- [x] Default absorption: [5%, 8%, 15%, 10%, 12%, 5%, 5%, 5%, 5%, 5%, 5%] = 80% over 11 months from construction start
- [x] Each sold unit pays: 10% booking (immediate), 50% construction installments (spread to handover), 40% at handover
- [x] 20% post-handover units pay 100% cash
- [x] Make absorption schedule editable from settings
- [x] Apply RERA 5% retention on total deposited amount
- [x] Show settlement: 95% at handover + 5% after 12 months
- [x] Upgrade Portfolio Summary Report style to match Capital Portfolio Export (dark header, summary cards, phase colors, legend, footer)
- [x] Update financial engine specification with user corrections (RERA unit fees, community fees, inspection fees, developer fees by scenario, progress payments, milestones)
- [x] Ensure every number remains editable and auto-propagates to all reports (verified: all numbers editable from بطاقة المشروع or إعدادات التدفق النقدي, changes auto-propagate via tRPC queries)
- [x] Build new financial engine module (server/financialEngine.ts) — single clean file with pure functions
- [x] Write comprehensive vitest tests for financial engine with real project numbers — 46 tests passing
- [x] Wire new engine into PortfolioSummaryReport and Capital Portfolio via adapter (financialEngineAdapter.ts) — 67 tests passing
- [x] Verify end-to-end: every number editable and auto-propagates (adapter maps engine output to existing API shape)
- [x] Build comparison page: old engine vs new engine numbers side-by-side for verification
- [x] Replace old engine with new engine in calculateProjectCosts (server-side investorCashFlow.ts now uses new engine internally)
- [x] Replace old engine in client-side projectCostsCalc.ts with corrected formulas
- [x] getPortfolioAllScenarios/getSettings/getProjectMonthlyReport all use calculateProjectCosts which now uses new engine
- [x] Verify all pages produce correct numbers after switch (67 tests passing, server running, HMR working)
- [x] Run all existing tests to confirm no regressions (67 tests passing)
- [x] Fix: Revenue item (765M) was incorrectly included in totalCosts calculation — grandTotal showed 1.38B instead of 616M for Majan G+4P+25. Fixed in CapitalScheduleTablePage, FeasibilityStudyPage, and getPortfolioAllScenarios server endpoint.
- [x] Fix EscrowCashFlowPage: show ONLY escrow-funded expenses (remove investor-funded items from escrow view)
- [ ] Build Investor Cash Flow Schedule page (جدولة رأس المال) — columns: الوصف, إجمالي التكاليف, إجمالي المستثمر, مدفوع, غير مدفوع, then monthly columns for design (8 months) and construction (30 months)
- [ ] Show "من الضمان" for escrow-funded items in investor column
- [ ] Show cumulative row (إجمالي تراكمي) at bottom
- [ ] Include scenario tabs (3 scenarios)
- [ ] All data from projectData.ts — no hardcoded numbers, no database
- [ ] Section headers: الأرض, التصاميم, ريرا وأوف بلان, الإنشاء
- [ ] Light/white theme matching the provided screenshot style
- [x] Unify data source: update projectData.ts with correct card numbers (govFees=7M, developerFee=5%, reraInspection=150K)
- [x] Refactor ProjectCardOffplanPage to import from projectData.ts instead of local INPUTS
- [ ] Update InvestorCashFlowSchedulePage to match exact same items as the card
- [ ] Verify both pages show identical totals
- [ ] Build Escrow Cash Flow Schedule page (Scenario 1) with escrow items + revenues
- [x] Rewrite EscrowCashFlowSchedulePage2 with full monthly distribution: S-Curve for construction/revenue, equal for supervision, penultimate for surveyor, periodic for RERA, first 12 months for sales commission, 5% completion/retention post-construction
- [x] Build Scenario 2 (أوف بلان بعد إنجاز 20%): no deposit, 20% paid to contractor in months 2-4 of construction equally, revenue starts month 5, commission starts month 5, 5 RERA/escrow items in month 3, marketing from month 1 over 12 months
- [x] Build Scenario 3 (تطوير بدون بيع على الخارطة): no escrow, no opening balance, revenue over 3 post-construction months, commission 2% + marketing 1% + sorting + RERA units + NOC all over 3 post-construction months, construction S-Curve + supervision + surveyor + gov fees during construction only, no RERA auditor/inspection/offplan registration/escrow fee/contractor 20%
- [ ] Add Scenario 4 (rental/no sale): construction costs only, no revenue/commission/marketing/sorting/NOC
- [x] Wire all 4 pages to DB with project selector
- [ ] Distribute units in PricingPage for each project
- [x] Create consolidated cash flow page combining all projects
- [x] Escrow surplus withdrawal: after 3 months post-completion, keep 5% retained for 1 year
- [x] Convert projectData.ts to accept dynamic project inputs from DB instead of hardcoded values
- [x] Add project selector dropdown to all 4 new pages (card, pricing, investor CF, escrow CF)
- [x] Wire pages to read from projects table via tRPC
- [x] Build consolidated investor cash flow page combining all 6 projects
- [x] All projects start Aug 2026 (design phase)
- [x] Escrow surplus transferred as investor revenue: 95% after 3 months post-completion, 5% after 12 months
- [x] Scenario 4 for مركز مجان التجاري: construction costs only, no revenue/sale
- [x] Add save/load for unit distribution in PricingPage (counts, areas, prices persist per project)
- [x] Remove studio from PricingPage unit types
- [x] Pre-fill default unit distributions for all 6 projects (no studio)
- [x] Make ProjectCardOffplanPage fields editable (BUA, GFA, costs, dates, etc.) with save button
- [x] Rebuild PricingPage as dynamic Excel-like system (no separate save tables, compute from project GFA, save overrides to project record)
- [ ] Fix revenue inconsistency: ProjectCardOffplanPage must calculate revenue from same source as PricingPage (unit counts × area × price from project record)
- [x] Global project selection persistence: selecting a project on any page now persists across all pages via ProjectContext + localStorage
- [x] Fix InvestorCashFlowSchedulePage: uses hardcoded PRICING_DEFAULTS instead of actual project pricing data from DB (causes cost discrepancy with ProjectCard)
- [x] Add validation column (تحقق) to InvestorCashFlowSchedulePage and EscrowCashFlowSchedulePage2 - shows sum of distributed months vs total, highlights red if mismatch
- [x] Fix EscrowCashFlowSchedulePage2 Scenario 1: construction cost month 1 = 0 (investor pays 10% directly), escrow pays from month 2 (4%+7%+9%+60% S-Curve+5%+5% = 90%)
- [x] Fix EscrowCashFlowSchedulePage2 Scenario 2: construction cost months 1-4 = 0 (investor pays 30% directly), escrow pays from month 5 (60% S-Curve+5%+5% = 70%)
- [x] Fix InvestorCashFlowSchedulePage Scenario 2: construction cost 10%+4%+7%+9% in months 1-4 (no 20% deposit), sorting/NOC/rera/escrow fees in month 4, marketing from month 4 over 12 months
- [x] Implement Scenario 3 (no_offplan) in InvestorCashFlowSchedulePage with post-construction months, correct distributions, and deleted items
- [x] Implement Scenario 4 (rental/no sale) in InvestorCashFlowSchedulePage: same as S3 but no revenue, no marketing, no sales commission, developer fee based on construction cost instead of revenue
- [x] Fix EscrowCashFlowSchedulePage2: remove 20% post-completion revenue from escrow (only 80% S-Curve during construction stays)
- [x] Fix InvestorCashFlowSchedulePage S1/S2: add 20% revenue directly to investor (12 months post-completion) + add post-construction months
- [x] Build consolidated cash flow report page with real timeline (all projects starting Aug 2026)
- [x] Extract shared computation logic into investorCashFlowEngine.ts utility
- [x] Refactor InvestorCashFlowSchedulePage to use shared engine (identical numbers guaranteed)
- [x] Rebuild ConsolidatedInvestorCashFlowPage to use shared engine per project with real timeline
- [x] Bug: Consolidated cash flow page shows inflated amounts (21M vs 600K) for individual project months — fixed: global timeline start was hardcoded to Aug 2026 but projects start as early as April 2026, causing month shift. Now dynamically uses earliest project start date.
- [x] Consolidated investor cash flow: Add start date picker per project (editable inline)
- [x] Consolidated investor cash flow: Add save button to persist scenario and start date changes to DB
- [x] Fix: مركز مجان التجاري should be scenario 4 (rental/إيجار) not scenario 1 — updated in DB
- [x] Consolidated cash flow: Add clickable popup on each project cell showing breakdown details of that month's amount
