import { describe, expect, it } from "vitest";
import { buildPaymentCalendar, buyerDueCalendar, calendarEntriesFromPlan, expandPaymentCalendarEntries, normalizePaymentCalendarEntries } from "./paymentPlanCalendar";
import { DEFAULT_FLEXIBLE_PAYMENT_PLAN } from "./flexiblePaymentPlan";

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

  it("never places the legacy zero-percent construction trigger before booking and contract", () => {
    const entries = calendarEntriesFromPlan(DEFAULT_FLEXIBLE_PAYMENT_PLAN);
    const rows = buildPaymentCalendar(entries, context);

    expect(rows.map((row) => row.month)).toEqual([7, 8, 11, 27]);
    expect(buyerDueCalendar(rows, 7).filter((row) => row.month === 7).reduce((sum, row) => sum + row.percentage, 0)).toBe(10);
  });

  it("migrates an already saved 0%-progress construction calendar row after the contract", () => {
    const entries = normalizePaymentCalendarEntries([
      { id: "booking", sequence: 1, label: "الحجز", percentage: 10, recipient: "escrow", timingRule: "booking" },
      { id: "contract", sequence: 2, label: "العقد", percentage: 10, recipient: "escrow", timingRule: "after_previous", offsetMonths: 1 },
      { id: "construction", sequence: 3, label: "الإنشاء", percentage: 40, recipient: "escrow", timingRule: "construction_progress", progressPct: 0 },
      { id: "handover", sequence: 4, label: "التسليم", percentage: 40, recipient: "escrow", timingRule: "handover" },
    ]);
    const rows = buildPaymentCalendar(entries, context);

    expect(entries[2]).toMatchObject({ timingRule: "after_previous", offsetMonths: 3 });
    expect(rows.map((row) => row.month)).toEqual([7, 8, 11, 27]);
  });

  it("shows every construction installment as a separate numbered payment before handover", () => {
    const projectContext = { ...context, constructionEndMonth: 23 };
    const entries = expandPaymentCalendarEntries([
      { id: "booking", sequence: 1, label: "الحجز", percentage: 10, recipient: "escrow", timingRule: "booking" },
      { id: "contract", sequence: 2, label: "العقد", percentage: 10, recipient: "escrow", timingRule: "after_previous", offsetMonths: 1 },
      { id: "construction", sequence: 3, label: "دفعات أثناء الإنشاء", percentage: 40, recipient: "escrow", timingRule: "construction_progress", progressPct: 0 },
      { id: "handover", sequence: 4, label: "التسليم", percentage: 40, recipient: "escrow", timingRule: "handover" },
    ], projectContext);
    const rows = buildPaymentCalendar(entries, projectContext);

    expect(entries.map((entry) => entry.label)).toEqual(["الحجز", "العقد", "قسط الإنشاء 1", "قسط الإنشاء 2", "قسط الإنشاء 3", "قسط الإنشاء 4", "التسليم"]);
    expect(rows.map((row) => row.month)).toEqual([7, 8, 11, 14, 17, 20, 23]);
    expect(rows.slice(2, 6).map((row) => row.percentage)).toEqual([10, 10, 10, 10]);
  });
});
