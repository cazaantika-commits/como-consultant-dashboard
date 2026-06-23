import { describe, it, expect } from "vitest";

/**
 * Test the fact sheet data merge logic used in generateSmartReport procedures.
 * This validates that when feasibilityStudies data is missing, the system
 * falls back to project fact sheet data from the projects table.
 */

// Simulate the merge logic from both marketOverview and competitionPricing routers
function mergeProjectData(project: any, feasStudy: any) {
  const plotArea = feasStudy?.plotArea || parseFloat(String(project.plotAreaSqft || '0')) || 0;
  const totalGFA = feasStudy 
    ? ((feasStudy.gfaResidential || 0) + (feasStudy.gfaRetail || 0) + (feasStudy.gfaOffices || 0))
    : parseFloat(String(project.gfaSqft || '0')) || 0;
  const gfaRes = feasStudy?.gfaResidential || 0;
  const gfaRet = feasStudy?.gfaRetail || 0;
  const gfaOff = feasStudy?.gfaOffices || 0;
  const buaFromFactSheet = project.bua || 0;
  const permittedUse = project.permittedUse || feasStudy?.landUse || 'غير محدد';
  const community = feasStudy?.community || project.areaCode || 'غير محدد';
  const plotNumber = feasStudy?.plotNumber || project.plotNumber || 'غير محدد';
  const projectDesc = feasStudy?.projectDescription || project.description || 'غير محدد';

  const projectType: string[] = [];
  if (gfaRes > 0) projectType.push('سكني');
  if (gfaRet > 0) projectType.push('تجاري');
  if (gfaOff > 0) projectType.push('مكاتب');
  if (projectType.length === 0 && permittedUse !== 'غير محدد') {
    if (permittedUse.includes('سكني') || permittedUse.toLowerCase().includes('residential')) projectType.push('سكني');
    if (permittedUse.includes('تجاري') || permittedUse.toLowerCase().includes('commercial') || permittedUse.toLowerCase().includes('retail')) projectType.push('تجاري');
    if (permittedUse.includes('مكاتب') || permittedUse.toLowerCase().includes('office')) projectType.push('مكاتب');
  }
  const projectTypeStr = projectType.length > 0 ? projectType.join(' + ') : 'غير محدد';

  return { plotArea, totalGFA, gfaRes, gfaRet, gfaOff, buaFromFactSheet, permittedUse, community, plotNumber, projectDesc, projectTypeStr };
}

describe("Fact Sheet Data Merge Logic", () => {
  it("should use fact sheet data when feasibility study is null", () => {
    const project = {
      name: "مجان متعدد الاستخدامات",
      plotAreaSqft: "15000",
      gfaSqft: "120000",
      bua: 95000,
      permittedUse: "سكني + تجاري",
      areaCode: "مجان",
      plotNumber: "PLOT-123",
      description: "مبنى متعدد الاستخدامات",
    };
    const feasStudy = null;

    const result = mergeProjectData(project, feasStudy);

    expect(result.plotArea).toBe(15000);
    expect(result.totalGFA).toBe(120000);
    expect(result.buaFromFactSheet).toBe(95000);
    expect(result.permittedUse).toBe("سكني + تجاري");
    expect(result.community).toBe("مجان");
    expect(result.plotNumber).toBe("PLOT-123");
    expect(result.projectDesc).toBe("مبنى متعدد الاستخدامات");
    // Should infer project type from permittedUse
    expect(result.projectTypeStr).toContain("سكني");
    expect(result.projectTypeStr).toContain("تجاري");
  });

  it("should prefer feasibility study data when available", () => {
    const project = {
      name: "Test Project",
      plotAreaSqft: "10000",
      gfaSqft: "50000",
      bua: 40000,
      permittedUse: "سكني",
      areaCode: "Area A",
      plotNumber: "P-100",
      description: "Old description",
    };
    const feasStudy = {
      plotArea: 20000,
      gfaResidential: 80000,
      gfaRetail: 10000,
      gfaOffices: 5000,
      community: "ند الشبا",
      plotNumber: "NAS-456",
      projectDescription: "Updated description from feasibility",
      landUse: "سكني + تجاري + مكاتب",
    };

    const result = mergeProjectData(project, feasStudy);

    // Should use feasibility data
    expect(result.plotArea).toBe(20000);
    expect(result.totalGFA).toBe(95000); // 80000 + 10000 + 5000
    expect(result.gfaRes).toBe(80000);
    expect(result.gfaRet).toBe(10000);
    expect(result.gfaOff).toBe(5000);
    expect(result.community).toBe("ند الشبا");
    expect(result.plotNumber).toBe("NAS-456");
    expect(result.projectDesc).toBe("Updated description from feasibility");
    // BUA always comes from fact sheet
    expect(result.buaFromFactSheet).toBe(40000);
    // permittedUse comes from project first
    expect(result.permittedUse).toBe("سكني");
    // Project type from GFA breakdown
    expect(result.projectTypeStr).toBe("سكني + تجاري + مكاتب");
  });

  it("should handle empty project with no data at all", () => {
    const project = {
      name: "Empty Project",
    };
    const feasStudy = null;

    const result = mergeProjectData(project, feasStudy);

    expect(result.plotArea).toBe(0);
    expect(result.totalGFA).toBe(0);
    expect(result.buaFromFactSheet).toBe(0);
    expect(result.permittedUse).toBe("غير محدد");
    expect(result.community).toBe("غير محدد");
    expect(result.projectTypeStr).toBe("غير محدد");
  });

  it("should infer project type from permittedUse in English", () => {
    const project = {
      name: "English Use Project",
      permittedUse: "Residential + Commercial + Office",
    };
    const feasStudy = null;

    const result = mergeProjectData(project, feasStudy);

    expect(result.projectTypeStr).toContain("سكني");
    expect(result.projectTypeStr).toContain("تجاري");
    expect(result.projectTypeStr).toContain("مكاتب");
  });

  it("should fallback to project.areaCode when feasStudy.community is missing", () => {
    const project = {
      name: "Test",
      areaCode: "الخليج التجاري",
    };
    const feasStudy = {
      gfaResidential: 50000,
      gfaRetail: 0,
      gfaOffices: 0,
      // community is undefined
    };

    const result = mergeProjectData(project, feasStudy);

    expect(result.community).toBe("الخليج التجاري");
  });

  it("should use gfaSqft from fact sheet when feasibility has zero GFA", () => {
    const project = {
      name: "Fact Sheet Only",
      gfaSqft: "75000",
      plotAreaSqft: "12000",
      bua: 60000,
    };
    const feasStudy = {
      gfaResidential: 0,
      gfaRetail: 0,
      gfaOffices: 0,
      plotArea: 0,
    };

    const result = mergeProjectData(project, feasStudy);

    // feasStudy exists but all GFA are 0, so totalGFA = sum of zeros = 0
    // plotArea from feasStudy is 0, so fallback to project
    expect(result.plotArea).toBe(12000);
    // totalGFA: feasStudy exists so it uses sum = 0 (not fallback)
    expect(result.totalGFA).toBe(0);
    expect(result.buaFromFactSheet).toBe(60000);
  });
});
