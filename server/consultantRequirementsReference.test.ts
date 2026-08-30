import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "/home/ubuntu/como-consultant-dashboard";
const migration = readFileSync(`${root}/drizzle/0065_consultant_requirement_reference.sql`, "utf8");
const projectMigration = readFileSync(`${root}/drizzle/0066_project_consultant_requirement_sets.sql`, "utf8");
const readingMigration = readFileSync(`${root}/drizzle/0067_consultant_offer_readings.sql`, "utf8");
const router = readFileSync(`${root}/server/routers/consultantRequirements.ts`, "utf8");
const offerRouter = readFileSync(`${root}/server/routers/offerReader.ts`, "utf8");
const comparisonRouter = readFileSync(`${root}/server/routers/financialOfferComparison.ts`, "utf8");
const gapMigration = readFileSync(`${root}/drizzle/0068_consultant_offer_gap_overrides.sql`, "utf8");
const component = readFileSync(`${root}/client/src/components/consultant/ConsultantRequirementsReference.tsx`, "utf8");
const offerReviewScreen = readFileSync(`${root}/client/src/pages/OfferReaderScreen.tsx`, "utf8");
const commandCenterScreen = readFileSync(`${root}/client/src/pages/CommandCenterPage.tsx`, "utf8");

describe("consultant requirements reference safeguards", () => {
  it("creates an independent reference seeded from legacy records without deleting them", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS consultant_requirement_reference_items");
    expect(migration).toContain("FROM cpa_scope_items si");
    expect(migration).toContain("FROM cpa_supervision_roles sr");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+cpa_/i);
    expect(migration).not.toMatch(/UPDATE\s+cpa_/i);
  });

  it("keeps the comprehensive reference visible but prevents expanding or editing it from the UI", () => {
    expect(router).toContain("defaultEnabled");
    expect(router).toContain("defaultGapValueAed");
    expect(router).toContain("pricingBasis");
    expect(component).toContain("المكتبة الشاملة لنطاق التصميم والإشراف");
    expect(component).toContain("دون إضافة أو تغيير");
    expect(component).not.toContain("reference.create");
    expect(component).not.toContain("reference.update");
  });

  it("creates project copies and revisions without writing over the approved comparison basis", () => {
    expect(projectMigration).toContain("project_consultant_requirement_sets");
    expect(projectMigration).toContain("project_consultant_requirements");
    expect(router).toContain("createFromReference");
    expect(router).toContain("createRevision");
    expect(router).toContain("لا يمكن تعديل معيار معتمد");
    expect(projectMigration).not.toMatch(/DELETE\s+FROM\s+cpa_/i);
  });

  it("stores an assistant-review request separately and never writes into legacy CPA evaluation results", () => {
    expect(readingMigration).toContain("consultant_offer_readings");
    expect(offerRouter).toContain("requestAssistantReview");
    expect(offerRouter).toContain("اعتمد متطلبات المشروع أولًا");
    expect(offerRouter).toContain("status = 'SUPERSEDED'");
    expect(offerRouter).not.toMatch(/INSERT\s+INTO\s+cpa_evaluation_results/i);
    expect(offerRouter).not.toMatch(/UPDATE\s+cpa_evaluation_results/i);
  });

  it("does not invoke an automated model to interpret consultant offers", () => {
    expect(offerRouter).toContain("requestAssistantReview");
    expect(offerRouter).toContain("saveAssistantReview");
    expect(offerRouter).not.toContain("invokeLLM");
    expect(offerRouter).not.toContain("runDraft");
    expect(offerReviewScreen).toContain("بدء إدخال مراجعة المساعد");
    expect(offerReviewScreen).toContain("النظام لا يفسر العرض");
    expect(offerRouter).toContain("saveOwnerCorrection");
    expect(offerRouter).toContain("OWNER_CORRECTION");
  });

  it("calculates a reviewed offer comparison separately and preserves editable gap values outside CPA results", () => {
    expect(gapMigration).toContain("consultant_offer_gap_overrides");
    expect(comparisonRouter).toContain("status = 'REVIEWED'");
    expect(comparisonRouter).toContain("setGapOverride");
    expect(comparisonRouter).not.toMatch(/INSERT\s+INTO\s+cpa_evaluation_results/i);
    expect(comparisonRouter).not.toMatch(/UPDATE\s+cpa_evaluation_results/i);
    expect(comparisonRouter).toContain("getSupervisionReport");
    expect(comparisonRouter).toContain("workstream = 'SUPERVISION'");
  });

  it("exposes the financial comparison as read-only evidence without changing the technical evaluation methodology", () => {
    expect(comparisonRouter).toContain("getEvidenceStatus");
    expect(comparisonRouter).not.toMatch(/UPDATE\s+consultant_technical_evaluations/i);
    expect(commandCenterScreen).toContain("مرجع التقرير المالي المعتمد");
    expect(commandCenterScreen).toContain("لا يختار التقرير مكتبًا");
  });
});
