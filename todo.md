# CPA System TODO

- [x] Fix team gap analysis to apply to ALL fee methods (LUMP_SUM, PERCENTAGE, MONTHLY_RATE)
- [x] Verify calculation matches worked example in Final Spec
- [x] Fix importJson bug: added textarea for direct JSON paste, import now works correctly
- [x] Fix unrankable consultants display: show scope gap + true design fee (LACASA, XYZ)
- [x] Build True Cost Report generation endpoint (HTML/PDF matching TrueCost_6457879 format)
- [x] Add Export Report button to CPA results page
- [x] Capital scheduling: page wired to /capital-scheduling route in App.tsx
- [ ] Import corrected KIEFERLE JSON and recalculate
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
- [ ] Import corrected KIEFERLE JSON and recalculate (pending)
- [x] Update capital scheduling phase colors to match provided color palette (green, orange, pink, cyan, yellow)
- [ ] Bug: Design and offplan phases not showing for مجان متعدد الاستخدامات in capital scheduling
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
- [ ] Bug fix: Gantt bars not appearing on timeline when dates are entered/saved
- [ ] Bug fix: Completion % should be auto-calculated from service statuses (not manual input)
- [ ] Stage completion = count of completed services / total services in stage
- [x] Bug fix: cycleStatus wipes dates when cycling status (doesn't include existing dates in mutation)
- [x] Bug fix: saveEditing should be more robust with DOM fallback for date values
- [x] Bug fix: server-side upsertServiceInstance overwrites dates with NULL when only status is sent
- [x] Unit tests for upsertServiceInstance data builder (5 tests passing)
- [ ] Improve: Auto-calculate progress % based on requirements completion and status
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
- [ ] Bug: تبويب "البيانات" في صفحة تفاصيل الخدمة يظهر العدد (0/3) لكن لا يعرض البيانات عند الضغط عليه
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
- [ ] Bug: عمود المهمة في الجدول مقتطع جداً - يحتاج عرض أكبر
- [ ] Bug: عمود البدء/الانتهاء ضيق فيظهر الرقم فقط بدون الشهر
- [ ] Bug: زر "تضييق" لا يوسع عمود المهمة بشكل كافٍ
- [ ] Add برنامج العمل (read-only) to مركز القيادة as a new bubble/icon
- [ ] Add جدولة رأس المال (editable) to مركز القيادة as a new bubble/icon
- [ ] Add دراسة جدوى المشروع (read-only) to مركز القيادة with project selector and 3 sub-sections: دراسة الجدوى المالية، رأس المال المطلوب، حساب الضمان
- [ ] Fix دراسة جدوى المشروع in مركز القيادة - show only 3 sections (دراسة الجدوى المالية, رأس المال المطلوب, حساب الضمان) with project selector, not full FeasibilityHubPage
- [ ] Cost rules: Update DB schema to support payment installments (month + percentage per installment) and project-level overrides table
- [ ] Cost rules: Seed all 26 items with full payment schedules (default installments per phase month)
- [ ] Cost rules: Rebuild UI page with two levels - default template (editable) + per-project override (editable)
- [ ] Cost rules: Each item shows: name, amount type (fixed/%), default value, source (investor/escrow), phase, installment schedule
- [ ] Cost rules: Installment schedule editor - add/remove rows with month number + percentage
- [ ] Cost rules: Project override tab - select project, see all 26 items with ability to override value and schedule
- [ ] Redesign FactSheetPage: 3 sections — (1) AI-extracted, (2) manual inputs with visible formulas, (3) auto-calculated from revenues
- [ ] FactSheet: link phase durations to compliance track (mسار الامتثال), not manual input
- [ ] FactSheet: add broker sales commission field (% of revenue)
- [ ] FactSheet: show formula labels next to each calculated field (e.g. "40 AED × GFA م²")
- [ ] FactSheet: style like the Excel-sheet draft (clear sections, formula hints, grouped by phase)

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
- [ ] إضافة شارة السيناريو بجانب اسم كل مشروع في الجدول الشامل
- [ ] تطبيق السيناريو الثالث (بدون أوف بلان) على مشروع المول في قاعدة البيانات
- [ ] التحقق من الربط التلقائي بين الـ Fact Sheet والجدول الشامل

## صفحة جدول التدفق المالي (الجديدة)
- [ ] إضافة جدول project_cash_flow_settings في قاعدة البيانات
- [ ] إضافة tRPC procedures: getCashFlowSettings و saveCashFlowSettings
- [ ] بناء CashFlowDistributionPage — جدول الإعدادات (سيناريو + توزيع زمني)
- [ ] بناء CashFlowDistributionPage — جدول الانعكاس (أفقي شهري)
- [ ] تسجيل المسار في App.tsx وإضافة الأيقونة في FeasibilityHubPage
- [ ] تحديث ExcelCashFlowPage ليسحب من الإعدادات بدل الكود الثابت

- [x] Create project_cash_flow_settings database table with full schema (itemKey, distributionMethod, lumpSumMonth, startMonth, endMonth, customJson, fundingSource, etc.)
- [x] Build cashFlowSettings tRPC router: getSettings, saveSettings, resetSettings, getReflectionData procedures
- [x] Build CashFlowSettingsPage (جدول الإعدادات): scenario selector, per-item distribution config, amount overrides, funding source, notes
- [x] Build CashFlowReflectionPage (جدول الانعكاس): horizontal Excel-like monthly matrix, phase-colored columns, category subtotals, grand totals, CSV export
- [x] Integrate both pages as tabs in FeasibilityStudyPage (⚙️ إعدادات التدفق + 📊 جدول الانعكاس)
- [x] Add standalone routes /cashflow-settings and /cashflow-reflection in App.tsx
- [x] Write 15 unit tests for distribution logic (lump_sum, equal_spread, custom, zero amount, total integrity) — all passing
- [ ] إعادة بناء جدول الانعكاس: مصدره البطاقة التعريفية + الإيرادات من دراسة الجدوى (للبنود الثلاث: أتعاب المطور، التسويق، عمولة الوكيل) + توزيع الأشهر من إعدادات التدفق
- [x] إعادة تصميم صفحة إعدادات التدفق: إزالة حقول تعديل المبالغ (عرض فقط)، إضافة حقول المدد الزمنية للمراحل، تحديد المرحلة لكل بند (تلقائي قابل للتغيير)، طريقة الدفع (دفعة واحدة + رقم الشهر، أو موزع)، كل هذا لكل سيناريو منفصل
- [ ] إصلاح إعدادات التدفق: البنود الموزعة تعرض عدد أشهر المرحلة الفعلية (من حقول المدد في الأعلى) وليس رقماً ثابتاً
- [ ] إصلاح إعدادات التدفق (3 تحسينات): (1) البنود الموزعة تعرض عدد أشهر المرحلة الفعلية من حقول المدد، (2) إضافة خيار توزيع بنسب مخصصة لكل شهر، (3) الأرض وعمولة الوسيط ورسوم التسجيل مقفلة كـ"مدفوع مسبقاً" بدون خيارات مرحلة أو توزيع
- [ ] إعادة تصميم صفحة إعدادات التدفق لتكون نفس هيكل جدول الانعكاس بالضبط: 4 أقسام، نفس البنود، نفس الأرقام، مع أدوات التوزيع لكل بند
- [x] إعادة تصميم صفحة إعدادات التدفق: نفس هيكل جدول الانعكاس (4 أقسام)، مبالغ عرض فقط، توزيع ثلاثي (دفعة واحدة + نسب مخصصة + موزع بالتساوي)، الأرض مدفوع مسبقاً ثابت
- [ ] إصلاح إعدادات التدفق: نقل "إيداع حساب الضمان" من القسم الرابع إلى القسم الثالث
- [ ] إصلاح إعدادات التدفق: تقسيم أتعاب المطور إلى بندين (2% في القسم الثاني، 3% في القسم الرابع)
- [ ] إصلاح إعدادات التدفق: تقسيم عمولة المبيعات إلى بندين (0.5% في القسم الثاني، 1.5% في القسم الرابع)
- [x] إصلاح إعدادات التدفق: نقل إيداع حساب الضمان إلى القسم الثالث، تقسيم أتعاب المطور إلى 3 بنود، تقسيم التسويق إلى بندين، حقل section يأتي من السيرفر
- [ ] ربط جدول الانعكاس بإعدادات التدفق (المدد الزمنية + طريقة التوزيع لكل بند)
- [ ] إضافة معاينة التوزيع في إعدادات التدفق (صف صغير يُظهر الأشهر)
- [ ] مراجعة السيناريو الثاني (أوف بلان بعد 20% إنشاء) وإصلاح البنود
- [x] Rename: محرك جويل → الدراسات والأبحاث
- [x] Rename: بيانات جويل → البيانات والمصادر
- [x] Rename: الميزانية والتسعير → التسعير والإيرادات
- [x] Rename: دراسة الجدوى المالية → ملخص الجدوى المالية
- [x] Rename: مشاريع كومو _ جدولة راس المال → محفظة رأس المال للمشاريع
- [x] Rename: رأس المال المطلوب → خطة رأس مال المشروع
- [x] Rename: حساب الضمان → التدفقات النقدية وحساب الضمان
- [x] Rename: جدول الانعكاس → التكاليف الكلية للمشروع والجدول الزمني

- [ ] Restructure project-management into 4 main sections with icons
- [ ] Section 1: بطاقة المشروع (standalone, no sub-tabs)
- [ ] Section 2: المعرفة والتحليل (project selector + 5 tabs: الدراسات والأبحاث, تقارير السوق, البيانات والمصادر, لوحة المخاطر, التسعير والإيرادات)
- [ ] Section 3: التخطيط المالي (project selector + 5 tabs: إعدادات التدفق, ملخص الجدوى المالية, التكاليف الكلية للمشروع والجدول الزمني, خطة رأس مال المشروع, التدفقات النقدية وحساب الضمان)
- [ ] Section 4: محفظة رأس المال للمشاريع (no project selector, shows all projects)
- [x] Restructure project-management page into 4 main sections: بطاقة المشروع, المعرفة والتحليل (5 tabs), التخطيط المالي (5 tabs), محفظة رأس المال للمشاريع
- [x] Create KnowledgeHubPage.tsx with 5 tabs: الدراسات والأبحاث, تقارير السوق, البيانات والمصادر, لوحة المخاطر, التسعير والإيرادات
- [x] Create FinancialPlanningHubPage.tsx with 5 tabs: إعدادات التدفق, ملخص الجدوى المالية, التكاليف الكلية, خطة رأس المال, التدفقات النقدية
- [ ] Add SVG icons for 4 main sections in ProjectManagementPage (replace emoji)
- [ ] Remember last opened project in KnowledgeHubPage and FinancialPlanningHubPage (localStorage)
- [ ] Fix amount duplication in capital schedule table (computedAmount vs monthly sum mismatch)
- [ ] Bug: capital schedule table does not reflect updated settings (fundingSource, developer fee %, marketing %) after saving in settings page
- [ ] Remove revenue items from CashFlowSettingsPage and router defaults
- [ ] Add total project cost and required capital summary rows at bottom of CapitalScheduleTablePage

- [x] BUG: Changing fundingSource in cash flow settings does not reflect on capital schedule table (root cause: race condition in scenario loading)
- [x] FIX: CashFlowSettingsPage race condition — settingsQuery fires with default scenario before DB scenario loads
- [x] FIX: CapitalScheduleTablePage scenario selector should be local state (not update DB on click) — both pages must support switching between 3 scenarios independently
- [x] FIX: Both pages must wait for DB scenario to load before fetching settings data
- [x] FIX: When embedded (no scenario selector visible), use DB scenario as default but allow parent to override
- [x] BUG: Column 1 (إجمالي التكاليف) missing escrow-funded items — must show ALL costs (investor + escrow). Column 2 (خطة رأس مال) should show investor-only amounts. Fixed: added missing items (government_fees_escrow, contractor_payments, community_fee_escrow) to computeItemAmountByKey splitMap.
- [ ] Audit: Ensure cash flow settings for Scenario 1 (offplan_escrow) has complete item list matching reference HTML (capital-schedule.html)
- [ ] Ensure all cost items in cash flow settings Scenario 1 are correctly computed from sources (fact sheet + pricing/revenue)

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
- [ ] إضافة ملفات الإعدادات الثلاثة (o1, o2, o3) داخل تاب إعدادات التدفقات بجانب cost-settings

## ربط التخطيط المالي بقاعدة البيانات
- [ ] إضافة ملفات الإعدادات الثلاثة (o1, o2, o3) داخل تاب إعدادات التدفقات
- [ ] تحويل ملفات الإعدادات من HTML ثابت إلى صفحات React مربوطة بقاعدة البيانات
- [ ] تحويل التقارير المالية الثلاثة من HTML ثابت إلى صفحات React مربوطة بقاعدة البيانات
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
- [ ] ربط جدول مقارنة السيناريوهات الثلاثة ببيانات المشروع الحقيقية من DB

## تعديل حقل رسوم الفرز في البطاقة التعريفية
- [x] تحويل رسوم الفرز إلى حقل يدوي (درهم/م²) مع عرض GFA بالقدم المربع والنتيجة المحسوبة

## تعديل أسماء بنود التكاليف
- [x] تغيير "أتعاب التصميم (2%)" إلى "أتعاب الاستشاري — التصاميم" في كل الملفات
- [x] تغيير "أتعاب الإشراف (2%)" إلى "أتعاب الاستشاري — الإشراف" في كل الملفات

## إعادة بناء مقارنة السيناريوهات الثلاثة
- [ ] إعادة كتابة getCostSettingsComparison ليسحب من getReflectionData بدلاً من حسابات مباشرة
- [ ] مدة التصاميم والتنفيذ تأتي من البطاقة التعريفية (projects table)
- [ ] دفعة واحدة: منتقي شهر من 1 إلى عدد أشهر المرحلة الفعلي
- [ ] مبالغ متساوية: تقسم على عدد أشهر المرحلة الفعلي
- [ ] نسبة مئوية: حقول بعدد أشهر المرحلة الفعلي للتعبئة اليدوية
- [ ] تحديث cost-settings.html لعرض البيانات الجديدة

## خطأ: المدة ثابتة 16 شهر في إعدادات التدفق بدلاً من القيمة الفعلية من البطاقة
- [ ] إصلاح: المدة تظهر 16 شهر ثابتة بينما البطاقة تقول 20 شهر — يجب قراءة constructionMonths و preConMonths من projects table
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
- [ ] التأكد من ربط أرقام المحفظة في خطة رأس مال المشروع — كل مشروع مطابق لنفس خطة رأس المال

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
- [ ] Bug fix: شريط ريرا المرئي يظهر بشكل غريب عند تطبيق تأجيل الإنشاء + تأجيل ريرا معاً — يجب إصلاح حساب موقع الشريط
- [ ] Bug fix: لون ريرا البنفسجي يظهر مرتين (في المكان الأصلي + المؤجل) — يجب أن يظهر فقط حيث توجد المبالغ الفعلية
- [x] Bug fix: فجوة بيضاء تظهر بين خلايا ريرا عند التأجيل — الخلايا ضمن نطاق المرحلة يجب أن تأخذ لون المرحلة حتى لو المبلغ صفر
- [ ] إضافة مرحلة "التسجيل" (شهرين) في إعدادات التدفقات لـ O1 و O2 وربط بنود ريرا بها
- [x] إصلاح الفجوة البيضاء في شريط ريرا عند التأجيل في المحفظة الديناميكية
- [ ] تصحيح: الأرقام غير صحيحة — يجب أن تأتي من إعدادات التدفق (cf_settings_items) كمصدر وحيد
- [x] Bug fix: في O3 تغيير مصدر التمويل من "حساب الضمان" إلى "المستثمر" لا يحدّث إجمالي رأس المال (investorTotal يجب أن يُعاد حسابه) — تم إصلاح onSourceChange في o1/o2/o3-settings.html لإعادة حساب الإجماليات فوراً عند تغيير المصدر
- [x] تغيير اسم "الإجمالي" إلى "رأس المال المطلوب" في صفحة المحفظة
- [x] إضافة صف "تم السداد" (المدفوع) في صفحة المحفظة — يعرض المبلغ المدفوع (paidTotal)
- [x] إضافة صف "المتبقي" = رأس المال المطلوب - تم السداد
- [x] إصلاح O3: جميع البنود يجب أن تكون مصدرها المستثمر (لا يوجد حساب ضمان في O3 لأنه لا توجد مبيعات)
- [x] إصلاح O3 في السيرفر: getPortfolioAllScenarios يجب أن يُرجع investorTotal = grandTotal في O3
- [x] إصلاح o3-settings.html: جميع البنود مصدرها المستثمر تلقائياً (لا خيار تغيير لحساب الضمان)
- [x] إصلاح التقارير المالية: رأس المال المطلوب في O3 = إجمالي كل التكاليف
- [ ] Bug fix: tRPC API returns HTML instead of JSON on home page — 'Unexpected token <' error
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
- [ ] Bug fix: فجوات بيضاء في فبراير/مارس 2027 — بعض الأعمدة فارغة بيضاء بينما يجب أن تكون ملونة بلون المرحلة (الإصلاح السابق لم يشمل كل الحالات)
- [ ] Bug fix: مصاريف الإنشاء لا تبدأ من أول شهر في المرحلة — الجداف صحيح لكن باقي المشاريع عندها شهور فارغة ملونة بدون أرقام في بداية مرحلة الإنشاء (الأرقام لا تتحرك مع تأجيل الإنشاء)
- [x] Bug fix: مصاريف الإنشاء تبدأ من الشهر 3 بدل الشهر 1 في كل المشاريع ما عدا الجداف — يجب أن تبدأ من الشهر الأول مثل الجداف
- [ ] Bug fix: مرحلة التسجيل غير محددة بداية شهرها بشكل صحيح — O1: التسجيل يبدأ من الشهر 3 (بعد شهرين من بداية التصاميم)، O2: التسجيل يبدأ من الشهر الأول من الإنشاء — هذا السبب الجذري لعدم صحة التقارير
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
- [ ] Bug: أرقام المحفظة الديناميكية لا تطابق أرقام التخطيط المالي O1 — مثال: ند الشبا قطعة 2، الشهر الأول من الإنشاء = 7,585,854 في O1 لكن 10.55M في المحفظة
- [ ] تتبع مصدر البيانات في كلا الصفحتين وتوحيدهما

- [x] إصلاح getPortfolioAllScenarios: استخدام startMonth/endMonth المحفوظة مباشرةً بدلاً من إعادة الحساب من phasesArr

- [x] إعادة كتابة getPortfolioAllScenarios: استدعاء getCostSettingsComparison لكل مشروع ونسخ monthlyAmounts مباشرةً من o1/o2/o3

- [ ] تشخيص: كتابة سكريبت يطبع الأرقام الشهرية من getCostSettingsComparison وgetPortfolioAllScenarios لمشروع ند الشبا قطعة 2 ومقارنتها بند ببند

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
