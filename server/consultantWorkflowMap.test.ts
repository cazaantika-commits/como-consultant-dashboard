import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/ConsultantPortalPage.tsx", "utf8");

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
});
