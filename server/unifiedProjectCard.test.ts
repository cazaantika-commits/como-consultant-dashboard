import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Unified Financial Studies project card", () => {
  const unified = read("client/src/pages/UnifiedProjectCardPage.tsx");
  const financialStudies = read("client/src/pages/BateekhaPage.tsx");
  const factSheet = read("client/src/pages/FactSheetPage.tsx");
  const generalInputs = read("client/src/pages/GeneralInputsPage.tsx");

  it("keeps manual financial inputs first and document-derived facts separate below", () => {
    expect(unified).toContain("المطلوب إدخاله واعتماده");
    expect(unified).toContain("بيانات المشروع من الوثائق");
    expect(unified.indexOf("المطلوب إدخاله واعتماده")).toBeLessThan(unified.indexOf("بيانات المشروع من الوثائق"));
    expect(unified).toContain("<GeneralInputsPage embedded hideDocumentFields hideProjectSelector />");
    expect(unified).toContain("<FactSheetPage embedded documentOnly />");
  });

  it("retains the current project fields and calculation pages instead of remapping or deleting data", () => {
    expect(unified).not.toContain("trpc.projects.update");
    expect(financialStudies).toContain('const UnifiedProjectCardPage = lazy(() => import("./UnifiedProjectCardPage"))');
    expect(financialStudies).toContain('return <UnifiedProjectCardPage />;');
    expect(financialStudies).toContain('return <PricingPage embedded />;');
    expect(financialStudies).toContain('return <V2WaelSales embedded />;');
  });

  it("preserves the Khazen-backed fact sheet while hiding unrelated manual and calculated blocks in document-only mode", () => {
    expect(factSheet).toContain("documentOnly = false");
    expect(factSheet).toContain('documentOnly ? "hidden" : ""');
    expect(factSheet).toContain("بيانات المشروع من الوثائق");
    expect(factSheet).toContain("تعبئة من خازن");
    expect(factSheet).toContain("!initialProjectId && !embedded");
  });

  it("does not repeat Khazen-derived land and GFA values as manual inputs", () => {
    expect(generalInputs).toContain("DOCUMENT_DERIVED_FIELD_KEYS");
    expect(generalInputs).toContain("hideDocumentFields = false");
    expect(generalInputs).toContain("!hideDocumentFields || !DOCUMENT_DERIVED_FIELD_KEYS.has(field.key)");
  });

  it("uses light colored surfaces with stronger separators for the two project-card sections", () => {
    expect(unified).toContain("border-t-4 border-t-teal-500");
    expect(unified).toContain("border-t-4 border-t-violet-500");
    expect(unified).toContain("border-b-2 border-teal-300");
    expect(unified).toContain("border-b-2 border-violet-300");
    expect(generalInputs).toContain("divide-x divide-slate-300");
    expect(generalInputs).toContain("border-b border-slate-300");
    expect(factSheet).toContain("border-b-2");
  });
});
