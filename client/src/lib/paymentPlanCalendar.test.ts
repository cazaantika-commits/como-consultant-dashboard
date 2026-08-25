import { describe, expect, it } from "vitest";
import { buildPaymentCalendar, buyerDueCalendar } from "./paymentPlanCalendar";

describe("buyer payment calendar", () => {
  const context = {
    projectSalesStartMonth: 7,
    constructionStartMonth: 10,
    constructionEndMonth: 27,
    projectStartDate: "2026-08",
  };

  it("turns ordered rules into real project-month due dates", () => {
    const calendar = buildPaymentCalendar([
      { id: "booking", sequence: 1, label: "الحجز", percentage: 10, recipient: "escrow", timingRule: "booking" },
      { id: "contract", sequence: 2, label: "العقد", percentage: 10, recipient: "escrow", timingRule: "after_previous", offsetMonths: 1 },
      { id: "progress", sequence: 3, label: "إنجاز 50%", percentage: 20, recipient: "escrow", timingRule: "construction_progress", progressPct: 50 },
      { id: "handover", sequence: 4, label: "التسليم", percentage: 60, recipient: "escrow", timingRule: "handover" },
    ], context);

    expect(calendar.map((row) => row.month)).toEqual([7, 8, 18, 27]);
    expect(calendar.map((row) => row.sequence)).toEqual([1, 2, 3, 4]);
  });

  it("collects all past due installments in the late buyer's purchase month", () => {
    const rows = buildPaymentCalendar([
      { id: "booking", sequence: 1, label: "الحجز", percentage: 10, recipient: "escrow", timingRule: "booking" },
      { id: "contract", sequence: 2, label: "العقد", percentage: 10, recipient: "escrow", timingRule: "after_previous", offsetMonths: 1 },
      { id: "progress", sequence: 3, label: "إنجاز", percentage: 20, recipient: "escrow", timingRule: "construction_progress", progressPct: 50 },
      { id: "handover", sequence: 4, label: "التسليم", percentage: 60, recipient: "escrow", timingRule: "handover" },
    ], context);

    expect(buyerDueCalendar(rows, 12).map((row) => row.month)).toEqual([12, 12, 18, 27]);
  });

  it("keeps a manually selected calendar month for an individual installment", () => {
    const rows = buildPaymentCalendar([
      { id: "manual", sequence: 1, label: "تعديل وائل", percentage: 100, recipient: "escrow", timingRule: "manual_date", manualDate: "2027-02" },
    ], context);

    expect(rows[0]).toMatchObject({ month: 7, automatic: false });
  });
});
