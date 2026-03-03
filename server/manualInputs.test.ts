import { describe, expect, it } from "vitest";
import { z } from "zod";

// Test the manual input field definitions
const MANUAL_INPUT_FIELDS = [
  "manualBuaSqft",
  "soilTestFee",
  "topographicSurveyFee",
  "reraUnitRegFee",
  "developerNocFee",
  "escrowAccountFee",
  "bankFees",
  "communityFees",
  "surveyorFees",
  "reraAuditReportFee",
  "reraInspectionReportFee",
  "reraProjectRegFee",
  "officialBodiesFees",
] as const;

// Zod schema matching the backend factSheetFields for manual inputs
const manualInputSchema = z.object({
  manualBuaSqft: z.string().optional(),
  soilTestFee: z.string().optional(),
  topographicSurveyFee: z.string().optional(),
  reraUnitRegFee: z.string().optional(),
  developerNocFee: z.string().optional(),
  escrowAccountFee: z.string().optional(),
  bankFees: z.string().optional(),
  communityFees: z.string().optional(),
  surveyorFees: z.string().optional(),
  reraAuditReportFee: z.string().optional(),
  reraInspectionReportFee: z.string().optional(),
  reraProjectRegFee: z.string().optional(),
  officialBodiesFees: z.string().optional(),
});

// Field labels in Arabic for UI display
const FIELD_LABELS: Record<string, string> = {
  manualBuaSqft: "مساحة البناء BUA (قدم مربع)",
  soilTestFee: "رسوم تقرير فحص التربة",
  topographicSurveyFee: "أعمال الرفع المساحي الطبوغرافي",
  reraUnitRegFee: "رسوم تسجيل الوحدات — ريرا",
  developerNocFee: "رسوم عدم ممانعة للبيع — المطور",
  escrowAccountFee: "رسوم فتح حساب الضمان",
  bankFees: "الرسوم البنكية",
  communityFees: "رسوم المجتمع",
  surveyorFees: "أتعاب المسّاح (تأكيد المساحات)",
  reraAuditReportFee: "تقارير تدقيق ريرا الدورية",
  reraInspectionReportFee: "تقارير تفتيش ريرا الدورية",
  reraProjectRegFee: "رسوم تسجيل المشروع — ريرا",
  officialBodiesFees: "رسوم الجهات الرسمية",
};

describe("Manual Input Fields", () => {
  it("should have exactly 13 manual input fields", () => {
    expect(MANUAL_INPUT_FIELDS).toHaveLength(13);
  });

  it("should have Arabic labels for all fields", () => {
    for (const field of MANUAL_INPUT_FIELDS) {
      expect(FIELD_LABELS[field]).toBeDefined();
      expect(FIELD_LABELS[field].length).toBeGreaterThan(0);
    }
  });

  it("should validate valid manual input data", () => {
    const validData = {
      manualBuaSqft: "110000",
      soilTestFee: "25000",
      topographicSurveyFee: "15000",
      reraUnitRegFee: "50000",
      developerNocFee: "10000",
      escrowAccountFee: "5000",
      bankFees: "30000",
      communityFees: "20000",
      surveyorFees: "12000",
      reraAuditReportFee: "8000",
      reraInspectionReportFee: "7500",
      reraProjectRegFee: "35000",
      officialBodiesFees: "45000",
    };

    const result = manualInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should accept empty/optional fields", () => {
    const emptyData = {};
    const result = manualInputSchema.safeParse(emptyData);
    expect(result.success).toBe(true);
  });

  it("should accept partial data", () => {
    const partialData = {
      manualBuaSqft: "205000",
      soilTestFee: "30000",
    };
    const result = manualInputSchema.safeParse(partialData);
    expect(result.success).toBe(true);
  });

  it("should handle decimal values as strings", () => {
    const decimalData = {
      soilTestFee: "25000.50",
      bankFees: "30000.75",
    };
    const result = manualInputSchema.safeParse(decimalData);
    expect(result.success).toBe(true);
  });

  it("should have unique field names", () => {
    const uniqueFields = new Set(MANUAL_INPUT_FIELDS);
    expect(uniqueFields.size).toBe(MANUAL_INPUT_FIELDS.length);
  });

  it("should have manualBuaSqft as a sqft field (not AED)", () => {
    expect(FIELD_LABELS.manualBuaSqft).toContain("قدم");
  });

  it("should have fee fields with AED-related labels", () => {
    const feeFields = MANUAL_INPUT_FIELDS.filter(f => f !== "manualBuaSqft");
    for (const field of feeFields) {
      expect(FIELD_LABELS[field]).toBeDefined();
      // Fee fields should contain "رسوم" or "أتعاب" or "أعمال" or "تقارير"
      const label = FIELD_LABELS[field];
      const isFeeLabel = label.includes("رسوم") || label.includes("أتعاب") || label.includes("أعمال") || label.includes("تقارير");
      expect(isFeeLabel).toBe(true);
    }
  });
});
