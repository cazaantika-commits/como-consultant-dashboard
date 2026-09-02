import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const portalSource = readFileSync("client/src/pages/ConsultantPortalPage.tsx", "utf8");
const cpaSource = readFileSync("client/src/pages/CPAPage.tsx", "utf8");
const routesSource = readFileSync("client/src/App.tsx", "utf8");
const committeeSource = readFileSync("client/src/pages/CommitteeDecisionPage.tsx", "utf8");
const appointmentPackSource = readFileSync("client/src/pages/ConsultantAppointmentPackPage.tsx", "utf8");

describe("consultant workflow map", () => {
  it("defines one ordered project workflow from design scope to contract deliverables", () => {
    [
      "اختر المشروع واعتمد نطاق التصميم",
      "حدّد المكاتب وجهّز طلب العرض",
      "ارفع العرض الأصلي وراجعه",
      "قارن التكلفة والفجوات ثم قيّم",
      "وثّق قرار اللجنة والتفاوض",
      "سجّل العقد وتابع التسليمات",
    ].forEach((title) => expect(portalSource).toContain(title));
    expect(portalSource).toContain('href="/consultant-proposals"');
    expect(portalSource).toContain("القرار يبقى بيد اللجنة دائمًا");
    expect(portalSource).toContain("لا ينشئ النظام عرضًا أو قرارًا أو عقدًا تلقائيًا");
  });

  it("keeps the directory, design library, and guide as support references rather than parallel evaluation routes", () => {
    expect(portalSource).toContain("مراجع مساندة");
    expect(portalSource).toContain('href: "/consultant-know"');
    expect(portalSource).toContain('href: "/consultant-proposals?settings=1"');
    expect(portalSource).toContain('href: "/consultant-guide"');
    expect(portalSource).not.toContain('href: "/consultant-evaluation"');
    expect(portalSource).not.toContain('href: "/consultant-committee"');
    expect(portalSource).not.toContain('href: "/contract-deliverables"');
    expect(portalSource).not.toContain("useMutation");
  });

  it("forces the project workflow to approve design scope before adding offices, reading offers, or calculating results", () => {
    expect(cpaSource).toContain('const isDesignScopeApproved = project?.scope_status === "APPROVED"');
    expect(cpaSource).toContain('disabled={!isDesignScopeApproved}');
    expect(cpaSource).toContain("اعتماد نطاق التصميم أولًا");
    expect(cpaSource).toContain("لا تُسجّل الأتعاب أو الفجوات قبل ذلك");
    expect(cpaSource).toContain("متابعة قرار اللجنة");
  });

  it("redirects old duplicate entry routes to the unified flow while preserving their data files", () => {
    expect(routesSource).toContain('<Redirect to="/consultant-portal" />');
    expect(routesSource).toContain('<Redirect to="/consultant-know" />');
    expect(routesSource).toContain('<Redirect to="/consultant-proposals" />');
  });

  it("carries the selected official project from comparison to decision and then to contract deliverables", () => {
    expect(cpaSource).toContain("/committee-decision?projectId=${systemProjectId}&returnTo=${returnTo}");
    expect(committeeSource).toContain("requestedProjectId");
    expect(committeeSource).toContain("/contract-deliverables?projectId=${selectedProjectId}&returnTo=${returnTo}");
    expect(appointmentPackSource).toContain("العودة إلى قائمة نطاقات المشاريع والعروض");
    expect(appointmentPackSource).toContain('navigate("/consultant-proposals")');
    expect(appointmentPackSource).not.toContain('navigate("/contract-deliverables")');
  });
});
