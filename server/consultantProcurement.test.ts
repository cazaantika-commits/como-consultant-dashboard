import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deriveAppointmentReview } from "./routers/consultantProcurement";

const routerSource = readFileSync("server/routers/consultantProcurement.ts", "utf8");
const packPage = readFileSync("client/src/pages/ConsultantAppointmentPackPage.tsx", "utf8");

describe("Consultant procurement workflow", () => {
  it("requires every appointment source before enabling an RFP draft", () => {
    const incomplete = deriveAppointmentReview({ projectExists: true, factsReady: true, marketProfileReady: true, verifiedEvidenceCount: 1, approvedDecision: false, plannedServices: 3, scopeReady: true });
    const complete = deriveAppointmentReview({ projectExists: true, factsReady: true, marketProfileReady: true, verifiedEvidenceCount: 1, approvedDecision: true, plannedServices: 3, scopeReady: true });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.items.find((item) => item.key === "market")?.complete).toBe(false);
    expect(complete.complete).toBe(true);
  });

  it("writes only to the new RFP and deliverable records, not existing source records", () => {
    expect(routerSource).toContain("db.insert(consultantRfpDrafts)");
    expect(routerSource).toContain("db.insert(contractDeliverables)");
    expect(routerSource).not.toContain("db.update(projectContracts)");
    expect(routerSource).not.toMatch(/db\.update\(projects\)|db\.update\(projectMarket|db\.update\(projectServiceInstances\)/);
  });

  it("keeps the RFP as an explicit internal draft and does not expose an external send action", () => {
    expect(routerSource).toContain('status: "draft"');
    expect(routerSource).not.toContain("sendEmail");
    expect(packPage).toContain("إنشاء مسودة طلب عروض داخلية");
    expect(packPage).toContain("لن يُرسل أي طلب أو دعوة تلقائيًا");
  });
});
