import { describe, expect, it } from "vitest";
import { buildSaraRecentDocumentaryEvidence, documentScore } from "./services/saraWorkFileReader";

const olderTemplate = {
  documentId: 930001, memoryId: 12, memoryType: "work_product", memoryTitle: "Consultant appointment letter: review of unsigned draft",
  memoryBody: "مسودة خطاب تعيين قديمة غير موقع عليها، تحتاج توقيع وائل", isCurrent: 1,
  title: "Consultant_appointment_letter_POA.docx", fileName: "Consultant_appointment_letter_POA.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const newerSource = {
  documentId: 960001, memoryId: 15, memoryType: "material", memoryTitle: "Re: Appointment of a consultant, Plot 6180578",
  memoryBody: "Please see the attached signed consultant appointment letter for your reference.", isCurrent: 1,
  title: "Consultant_appointment_letter_POA.pdf", fileName: "Consultant_appointment_letter_POA.pdf", mimeType: "application/pdf",
};

const question = "هل وصل خطاب التعيين الموقع أم أن العقد وقع؟";

describe("Sara work-file evidence selection", () => {
  it("ranks a current signed appointment-letter source above an older unsigned work product", () => {
    expect(documentScore(newerSource as any, question, "analysis")).toBeGreaterThan(documentScore(olderTemplate as any, question, "analysis"));
    expect(documentScore(newerSource as any, question, "full")).toBeGreaterThan(documentScore(olderTemplate as any, question, "full"));
  });

  it("does not interpret an agreement sent for signature as an already signed document", () => {
    const agreementForSignature = {
      ...olderTemplate, documentId: 930003, memoryType: "material", memoryTitle: "بريد صادر: عقد Artec للتوقيع",
      memoryBody: "أرفق لك نسخة العقد للاطلاع وترتيب التوقيع.",
      title: "Consultancy Agreement 20261001 Villa Plot.docx", fileName: "Consultancy Agreement 20261001 Villa Plot.docx",
    };
    const combinedQuestion = "هل خطاب التعيين موقع وهل عقد Artec موقع؟";
    expect(documentScore(newerSource as any, combinedQuestion, "full")).toBeGreaterThan(documentScore(agreementForSignature as any, combinedQuestion, "full"));
  });

  it("presents the newest source email with its attached document ahead of historical analysis", () => {
    const evidence = buildSaraRecentDocumentaryEvidence([
      { id: 15, memoryType: "material", isCurrent: true, title: "Mia: appointment letter", body: newerSource.memoryBody, occurredAt: "2026-10-05 06:00:00" },
      { id: 12, memoryType: "work_product", isCurrent: true, title: "earlier review", body: olderTemplate.memoryBody, occurredAt: "2026-10-01 06:00:00" },
    ], [newerSource, olderTemplate] as any);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].documents).toEqual([{ documentId: 960001, fileName: newerSource.fileName, title: newerSource.title }]);
    expect(evidence[0].excerpt).toContain("signed consultant appointment letter");
  });
});
