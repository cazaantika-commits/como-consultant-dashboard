import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/ConsultantPortalPage.tsx", "utf8");
const commandCenterSource = readFileSync("client/src/pages/CommandCenterPage.tsx", "utf8");
const committeeSource = readFileSync("client/src/pages/ConsultantCommitteePage.tsx", "utf8");

describe("consultant workflow map", () => {
  it("orders the existing consultant workspaces from RFP brief through deliverables", () => {
    expect(source).toContain('title: "جهّز طلب العروض"');
    expect(source).toContain('href: "/consultant-appointment-pack"');
    expect(source).toContain('href: "/consultant-proposals"');
    expect(source).toContain('href: "/consultant-evaluation"');
    expect(source).toContain('href: "/command-center"');
    expect(source).toContain('href: "/contract-deliverables"');
  });

  it("states that the workflow map only guides existing pages and does not create a decision automatically", () => {
    expect(source).toContain("هذه الخريطة ترتب الصفحات الحالية فقط");
    expect(source).toContain("لا تنشئ عرضًا أو قرارًا أو عقدًا تلقائيًا");
    expect(source).not.toContain("useMutation");
  });

  it("keeps the sovereign decision in Command Center while retaining the legacy committee page as analysis only", () => {
    expect(commandCenterSource).toContain("بوابة القرار الرسمية");
    expect(commandCenterSource).toContain("القرار السيادي يُسجّل ويُؤكد من مركز القيادة فقط");
    expect(committeeSource).toContain("القرار الرسمي في مركز القيادة");
    expect(committeeSource).toContain("فتح القرار الرسمي في مركز القيادة");
    expect(committeeSource).toContain("محاكاة تحليلية للقرار");
    expect(committeeSource).not.toContain("committee.upsert.useMutation");
    expect(committeeSource).not.toContain("saveMutation.mutate");
  });

  it("keeps the legacy committee reference page within the mobile RTL viewport", () => {
    expect(committeeSource).toContain('w-full max-w-full overflow-x-hidden bg-stone-50');
    expect(committeeSource).toContain('mx-auto w-full min-w-0 max-w-5xl px-4 py-8 sm:px-6');
    expect(committeeSource).toContain('SelectTrigger className="w-full max-w-md"');
  });
});
