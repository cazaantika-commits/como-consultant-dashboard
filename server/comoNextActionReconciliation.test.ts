import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildEvidenceReconciliationPrompt, currentInboundEmailText, normalizeReconciliationPlan, resolutionHasCurrentEvidence } from "./services/comoNextActionReconciliation";

const service = readFileSync("server/services/comoNextActionReconciliation.ts", "utf8");

describe("COMO Next linked-evidence action reconciliation", () => {
  it("accepts only active action ids, removes duplicates, and defaults omitted actions to keep", () => {
    const plan = normalizeReconciliationPlan({
      evidenceOutcome: "وصل العرض المعدل بمرفقين.",
      actionResolutions: [
        { actionId: 10, resolution: "verified", confidence: 97, reason: "تحقق الانتظار", evidenceQuote: "updated the fee proposal" },
        { actionId: 10, resolution: "cancelled", confidence: 99, reason: "duplicate", evidenceQuote: "x" },
        { actionId: 999, resolution: "verified", confidence: 100, reason: "unknown", evidenceQuote: "x" },
      ],
      nextAction: {
        title: "تحليل العرضين المعدلين",
        description: "مقارنة المرفقين بطلب 24 سبتمبر.",
        acceptanceCriteria: "تقرير مقارنة وفجوات موثق.",
        ownerType: "manus",
        priority: "important",
        dueAt: null,
      },
    }, [10, 11]);
    expect(plan.actionResolutions).toEqual([
      expect.objectContaining({ actionId: 10, resolution: "verified", confidence: 97 }),
      expect.objectContaining({ actionId: 11, resolution: "keep", confidence: 0 }),
    ]);
    expect(plan.nextAction).toEqual(expect.objectContaining({ ownerType: "manus", title: "تحليل العرضين المعدلين" }));
  });

  it("rejects malformed next actions instead of inventing an operational record", () => {
    const plan = normalizeReconciliationPlan({ evidenceOutcome: "", actionResolutions: [], nextAction: { title: "x", ownerType: "manus" } }, [1]);
    expect(plan.nextAction).toBeNull();
    expect(plan.actionResolutions[0]).toEqual(expect.objectContaining({ actionId: 1, resolution: "keep" }));
  });

  it("tells the model to distinguish evidence from requests and put document analysis on Manus", () => {
    const prompt = buildEvidenceReconciliationPrompt({
      workFile: { title: "Design International", governingQuestion: "هل وصل العرض؟", desiredOutcome: "مقارنة العرض", status: "open" },
      triggerEmail: {
        id: 90004,
        folderName: "INBOX",
        subject: "Revised proposal",
        fromText: "Paolo",
        receivedAt: "2026-09-25 11:56:45",
        bodyText: "We updated the fee proposal. Please find attached two separate contracts.",
        attachmentCount: 2,
        attachmentNames: ["Architecture.pdf", "Interior Design.pdf"],
        analysisSummary: "وصل مرفقان",
        suggestedNextStep: "مراجعة العرض",
      },
      activeActions: [{ id: 60125, title: "انتظار العرض المعدل", acceptanceCriteria: "وصول العرض", actionStatus: "completed_pending_verification", ownerType: "team", createdAt: "2026-09-24 15:40:09" }],
      recentEmails: [],
      currentOutputs: [],
    });
    expect(prompt).toContain("Please find attached two separate contracts");
    expect(prompt).toContain("لا تُغلق إجراءً إلا باقتباس حرفي صريح من نص الرسالة الجديدة");
    expect(prompt).toContain("تحليل مستند أو عرض أو مرفق، واستخراج مقارنة أو تقرير، هو عمل Manus");
    expect(prompt).toContain("لا تطلب من عبد الرحمن مراجعة المادة الخام");
  });

  it("applies only high-confidence linked inbound evidence and never sends externally", () => {
    expect(service).toContain('triggerEmail.folderName !== "INBOX"');
    expect(service).toContain('item.resolution === "verified" ? item.confidence >= 90 : item.confidence >= 85');
    expect(service).toContain('resolutionHasCurrentEvidence(item, triggerEmail.bodyText');
    expect(service).toContain('item.resolution === "verified" && actionById.get(item.actionId)?.ownerType === "manus"');
    expect(service).toContain('sourceSystem: "evidence_reconciliation"');
    expect(service).toContain('externalSideEffect: false');
    expect(service).not.toMatch(/sendMail\s*\(|sendReply\s*\(|recordCommunicationSentCommand/);
  });

  it("does not cancel preparation for next week's meeting from an old meeting quoted in a new agreement email", () => {
    const email = 'Dear Abdalrahman\nKindly find attached the revised agreement.\nBest,\nTheodora\n\nFrom: Theodora\nSent: Wednesday, 30 September 2026\nFollowing the meeting today, I have drafted the agreement for your review and comments.';
    expect(currentInboundEmailText(email)).not.toContain('Following the meeting today');
    expect(resolutionHasCurrentEvidence({ actionId: 360004, resolution: 'cancelled', confidence: 95, reason: 'past meeting', evidenceQuote: 'Following the meeting today' }, email, ['Consultancy Agreement.pdf'])).toBe(false);
    expect(resolutionHasCurrentEvidence({ actionId: 480001, resolution: 'verified', confidence: 92, reason: 'received', evidenceQuote: 'Kindly find attached the revised agreement.' }, email, ['Consultancy Agreement.pdf'])).toBe(true);
  });
});
