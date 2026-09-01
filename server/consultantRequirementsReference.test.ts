import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "/home/ubuntu/como-consultant-dashboard";
const referenceMigration = readFileSync(`${root}/drizzle/0065_consultant_requirement_reference.sql`, "utf8");
const projectMigration = readFileSync(`${root}/drizzle/0066_project_consultant_requirement_sets.sql`, "utf8");
const encyclopediaMigration = readFileSync(`${root}/drizzle/0072_final_design_scope_encyclopedia.sql`, "utf8");
const cleanScopeMigration = readFileSync(`${root}/drizzle/0073_design_only_project_scope_snapshots.sql`, "utf8");
const splitSecurityMigration = readFileSync(`${root}/drizzle/0074_split_cctv_and_sira_scope.sql`, "utf8");
const requirementsRouter = readFileSync(`${root}/server/routers/consultantRequirements.ts`, "utf8");
const offerRouter = readFileSync(`${root}/server/routers/offerReader.ts`, "utf8");
const comparisonRouter = readFileSync(`${root}/server/routers/financialOfferComparison.ts`, "utf8");
const cpaRouter = readFileSync(`${root}/server/routers/cpa.ts`, "utf8");
const component = readFileSync(`${root}/client/src/components/consultant/ConsultantRequirementsReference.tsx`, "utf8");
const projectScopeComponent = readFileSync(`${root}/client/src/components/consultant/ProjectConsultantRequirements.tsx`, "utf8");
const offerReviewScreen = readFileSync(`${root}/client/src/pages/OfferReaderScreen.tsx`, "utf8");
const cpaPage = readFileSync(`${root}/client/src/pages/CPAPage.tsx`, "utf8");

describe("clean consultant design-scope input safeguards", () => {
  it("preserves the original 42-item encyclopedia migration and applies the approved CCTV/SIRA split as item 43", () => {
    expect(referenceMigration).toContain("CREATE TABLE IF NOT EXISTS consultant_requirement_reference_items");
    expect(referenceMigration).not.toMatch(/DELETE\s+FROM\s+cpa_/i);
    const approvedRows = encyclopediaMigration.match(/^\s+\(\d+, '[A-Z0-9_]+',/gm) ?? [];
    const executableEncyclopediaSql = encyclopediaMigration.replace(/--.*$/gm, "");
    expect(approvedRows).toHaveLength(42);
    expect(encyclopediaMigration).toContain("Lead Consultant / Architect of Record");
    expect(encyclopediaMigration).toContain("Tenant''s Handbook — Structural and MEP Technical Guidelines");
    expect(splitSecurityMigration).toContain("CCTV_SECURITY_DESIGN");
    expect(splitSecurityMigration).toContain("SIRA_SUBMISSION");
    expect(splitSecurityMigration).toContain("لا يشمل البند رسوم الجهة الحكومية التي يتحملها المالك");
    expect(splitSecurityMigration).toContain("SET is_active = 0");
    expect(executableEncyclopediaSql).not.toMatch(/UPDATE\s+project_consultant_requirements/i);
  });

  it("shows a design-only encyclopedia with the approved columns and no legal or supervision section", () => {
    expect(component).toContain("الموسوعة الشاملة لنطاق التصميم");
    expect(component).toContain("43 بند تصميم");
    expect(component).toContain("الاسم الإنجليزي الرسمي");
    expect(component).toContain("الشرح العربي للمعنى");
    expect(component).toContain('item.workstream === "DESIGN"');
    expect(component).not.toContain("SupervisionReferenceTable");
    expect(component).not.toContain("نطاق التصميم والإشراف");
  });

  it("creates independent project snapshots from design rows only and approves only a complete 43-item source", () => {
    expect(projectMigration).toContain("project_consultant_requirement_sets");
    expect(requirementsRouter).toContain("createFromReference");
    expect(requirementsRouter).toContain("workstream = 'DESIGN'");
    expect(requirementsRouter).toContain('Number(counts[0].design_count) !== 43');
    expect(requirementsRouter).toContain('Number(counts[0].non_design_count) !== 0');
    expect(projectScopeComponent).toContain("مختار من {requirements.length}");
    expect(projectScopeComponent).toContain("لا توجد تصنيفات مشاريع");
    expect(projectScopeComponent).toContain("لا يؤثر");
    expect(projectScopeComponent).not.toContain("المدة (شهر)");
    expect(projectScopeComponent).not.toContain("نطاق الإشراف");
  });

  it("migrates each current project to a new draft without deleting history, supervision, offers, or financial results", () => {
    expect(cleanScopeMigration).toContain("DESIGN_SCOPE_ENCYCLOPEDIA_V1");
    expect(cleanScopeMigration).toContain("reference_item.workstream = 'DESIGN'");
    expect(cleanScopeMigration).toContain("current_set.status = 'REPLACED'");
    expect(cleanScopeMigration).not.toMatch(/DELETE\s+FROM\s+project_consultant_requirement/i);
    expect(cleanScopeMigration).not.toMatch(/UPDATE\s+cpa_project_consultants/i);
    expect(cleanScopeMigration).not.toMatch(/UPDATE\s+cpa_consultant_supervision_team/i);
    expect(cleanScopeMigration).not.toMatch(/UPDATE\s+cpa_evaluation_results/i);
    expect(cleanScopeMigration).not.toContain("FIDIC_CONTRACT");
    expect(cleanScopeMigration).not.toContain("PI_INSURANCE");
  });

  it("removes the external JSON workflow from the active project UI", () => {
    const projectDetail = cpaPage.slice(cpaPage.indexOf("function ProjectDetailScreen"), cpaPage.indexOf("function ImportJsonScreen"));
    const mainPage = cpaPage.slice(cpaPage.indexOf("export default function CPAPage"));
    expect(projectDetail).not.toContain("نسخ طلب Claude");
    expect(projectDetail).not.toContain("JSON السابق");
    expect(mainPage).not.toContain('setScreen("import-json")');
    expect(mainPage).not.toContain('screen === "import-json"');
    expect(projectDetail).toContain("قراءة العرض");
  });

  it("analyzes the original PDF internally with structured output and keeps owner approval as the gate", () => {
    expect(offerRouter).toContain('OFFER_READER_MODEL = "gemini-3.1-pro-preview"');
    expect(offerRouter).toContain("invokeLLM");
    expect(offerRouter).toContain('type: "file_url"');
    expect(offerRouter).toContain('response_format: { type: "json_schema"');
    expect(offerRouter).toContain("approveForEvaluation");
    expect(offerRouter).toContain("تجاهل البنود القانونية والتعاقدية والإشراف");
    expect(offerReviewScreen).toContain("رفع ملف العرض الأصلي");
    expect(offerReviewScreen).toContain("تحليل العرض");
    expect(offerReviewScreen).toContain("اعتماد وإرسال إلى التقييم");
    expect(offerReviewScreen).not.toContain("بدء إدخال مراجعة المساعد");
    expect(offerReviewScreen).not.toContain("JSON السابق");
    expect(offerReviewScreen).not.toContain("ملف JSON");
  });

  it("writes approved design inputs into the existing evaluation contract without changing its calculations or supervision", () => {
    expect(offerRouter).toContain("UPDATE cpa_project_consultants");
    expect(offerRouter).toContain("design_fee_method");
    expect(offerRouter).toContain("INSERT INTO cpa_consultant_scope_coverage");
    expect(offerRouter).not.toMatch(/supervision_fee_(amount|method|percentage)/);
    expect(offerRouter).not.toContain("cpa_consultant_supervision_team");
    expect(offerRouter).not.toMatch(/INSERT\s+INTO\s+cpa_evaluation_results/i);
    expect(offerRouter).not.toMatch(/UPDATE\s+cpa_evaluation_results/i);
    expect(cpaRouter).toContain("runCalculationEngine");
    expect(cpaRouter).toContain("cpa_consultant_scope_coverage");
    expect(comparisonRouter).toContain("getSupervisionReport");
  });
});
