import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildConsultantAppointmentPack } from "./routers/consultantAppointmentPack";

const source = readFileSync("server/routers/consultantAppointmentPack.ts", "utf8");
const pageSource = readFileSync("client/src/pages/ConsultantAppointmentPackPage.tsx", "utf8");

describe("Consultant appointment pack", () => {
  it("assembles existing facts into a read-only preview without changing them", () => {
    const pack = buildConsultantAppointmentPack({
      project: { id: 7, name: "مشروع اختبار", plotNumber: "6185392", permittedUse: "Residential", gfaSqft: "50000", driveFolderId: "drive-7" },
      marketProfile: { transactionPurpose: "sale", productForm: "apartment", primaryCommunity: "ند الشبا جاردينز", developmentStatus: "offplan" },
      verifiedEvidenceCount: 2,
		approvedDecision: { id: 44, decidedAt: "2026-08-23", notes: "قرار سوق معتمد", isValid: true, status: "current_valid", reason: "مطابق للمصدر الحالي" },
      activeLifecycleStages: 4,
      plannedServices: 5,
      buildingCategory: { label: "متوسط", description: "فئة مشروع متوسطة" },
      scopeSections: [{ label: "التصاميم", items: [{ label: "تصميم معماري", status: "INCLUDED" }] }],
    });
    expect(pack.readOnly).toBe(true);
    expect(pack.project.name).toBe("مشروع اختبار");
    expect(pack.sections.market.search).toContain("شقق");
    expect(pack.sections.scope.itemCount).toBe(1);
		expect(pack.readiness.marketReady).toBe(true);
  });

	it("blocks the pack market gate when the historical approval needs reapproval", () => {
		const pack = buildConsultantAppointmentPack({
			project: { id: 7, name: "مشروع اختبار", gfaSqft: "50000" },
			marketProfile: { transactionPurpose: "sale", productForm: "apartment", primaryCommunity: "مجان", developmentStatus: "offplan" },
			verifiedEvidenceCount: 2,
			approvedDecision: { id: 44, decidedAt: "2026-08-23", notes: null, isValid: false, status: "needs_reapproval", reason: "تغيرت الفلترة" },
			activeLifecycleStages: 4,
			plannedServices: 5,
			scopeSections: [{ label: "التصاميم", items: [{ label: "تصميم معماري", status: "REQUIRED" }] }],
		});
		expect(pack.readiness.marketReady).toBe(false);
		expect(pack.sections.market.status).toBe("needs_reapproval");
	});

  it("contains only a read query and no write path to any source", () => {
    expect(source).toContain(".query(async");
    expect(source).not.toContain(".mutation(");
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });

  it("labels the pack as an internal preview and exposes the source trail", () => {
    expect(pageSource).toContain("معاينة داخلية من مصادر معتمدة");
    expect(pageSource).toContain("المصدر:");
    expect(pageSource).toContain("ما الذي لا تفعله هذه المعاينة؟");
    expect(pageSource).toContain("لا ترسل الحزمة إلى أي مكتب");
  });
});
