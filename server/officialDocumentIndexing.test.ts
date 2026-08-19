import { describe, expect, it } from "vitest";
import {
  extractOfficialParkingFacts,
  officialDocumentProjectKey,
  parseOfficialProjectDocumentFilename,
  projectDocumentPrefix,
} from "./officialDocumentIndexing";

describe("official document project mapping", () => {
  it("maps a Majan official filename only to its exact plot", () => {
    expect(parseOfficialProjectDocumentFilename("MAJ_6457879_PDG_V1.0.pdf")).toEqual({
      areaPrefix: "MAJ",
      plotNumber: "6457879",
      documentType: "PDG",
    });
    expect(officialDocumentProjectKey("MAJ", "6457879")).not.toBe(officialDocumentProjectKey("MAJ", "6457956"));
  });

  it("derives the approved filename prefixes from stored project area codes", () => {
    expect(projectDocumentPrefix("Maj-M")).toBe("MAJ");
    expect(projectDocumentPrefix("Jadaf")).toBe("JAD");
    expect(projectDocumentPrefix("NASGNA19-022")).toBe("NAD");
  });

  it("rejects a proposal-style filename that cannot identify a project exactly", () => {
    expect(parseOfficialProjectDocumentFilename("LACASA Proposal.pdf")).toBeNull();
  });

  it("extracts the explicit official Majan parking rule with a traceable source", () => {
    const facts = extractOfficialParkingFacts(
      JSON.stringify({ content: "GENERAL NOTES\n- PARKING: FOR APARTMENT, ONE BAY FOR EACH UNIT LESS THAN OR EQUAL TO 150 SQ.M GFA AND TWO BAYS FOR EACH UNIT EXCEEDING 150 SQ.M GFA; FOR OFFICES, ONE BAY FOR EACH 50 SQ.M OF OFFICE NET AREA; FOR RETAIL, ONE BAY FOR EACH 70 SQ.M OF RETAIL NET AREA." }),
      "MAJ_6457879_AP_V1.0.pdf",
    );
    expect(facts?.sourceReference).toContain("MAJ_6457879_AP_V1.0.pdf");
    expect(facts?.rules.residential.thresholdSqft).toBeCloseTo(1614.59, 2);
    expect(facts?.rules.office.sqftPerSpace).toBeCloseTo(538.2, 1);
    expect(facts?.rules.retail.sqftPerSpace).toBeCloseTo(753.47, 1);
  });
});
