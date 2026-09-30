import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { directiveRequestsCommunicationDraft, normalizeDirectiveEmailBody } from "./services/comoNextExecutiveDirectives";

const service = readFileSync("server/services/comoNextExecutiveDirectives.ts", "utf8");
const router = readFileSync("server/routers/comoNext.ts", "utf8");
const kitchenUi = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");

describe("COMO Next executive directives", () => {
  it("accepts one free-form instruction and gives Manus the project context", () => {
    expect(router).toContain("executeExecutiveDirective:");
    expect(router).toContain("directiveText: z.string().trim().min(3)");
    expect(service).toContain("أنت Manus، المدير التنفيذي العامل داخل COMO");
    expect(service).toContain("ملفات المشروع المفتوحة المتاحة للربط");
    expect(service).toContain("أحدث المخرجات والمواد الحالية");
    expect(service).toContain("أحدث المراسلات");
  });

  it("executes available internal work instead of returning another form to the owner", () => {
    expect(service).toContain("أنجزه الآن داخل workProductBody");
    expect(service).toContain('memoryType: "work_product"');
    expect(service).toContain('ownerType: "manus"');
    expect(service).toContain("decisionRequiredAfterExecution");
    expect(service).toContain("externalSideEffect: false");
  });

  it("can coordinate related work files but only inside the same authorized project", () => {
    expect(service).toContain("allowedRelatedIds");
    expect(service).toContain("context.projectFiles.map");
    expect(service).toContain('workFileStatus: "waiting"');
    expect(service).toContain("work_file_joined_to_directive");
    expect(service).toContain("requireProjectAccess");
  });

  it("keeps external commitments outside automatic directive execution", () => {
    expect(service).toContain("لا ترسل بريدًا، ولا تقبل عرضًا، ولا تعيّن استشاريًا، ولا تنشئ التزامًا أو دفعًا");
    expect(service).not.toMatch(/sendMail\s*\(|sendApprovedComoReply\s*\(/);
  });

  it("turns a communication directive into a real mailbox draft and requires Draft UID evidence", () => {
    expect(directiveRequestsCommunicationDraft("قم بتذكير وائل بأن صرف الدفعة يسرع المرحلة التالية")).toBe(true);
    expect(directiveRequestsCommunicationDraft("حلل عرض كولييرز وقارن الأرقام")).toBe(false);
    expect(service).toContain("createCommunicationDraftCommand");
    expect(service).toContain("executive-directive-email-draft:");
    expect(service).toContain("if (!mailbox?.uid)");
    expect(service).toContain("if (!workProductId && !communicationDraftId && parsed.nextActionRequired");
    expect(service).toContain("ممنوع اعتبار نص داخلي يقول «أعددت مسودة» تنفيذًا");
  });

  it("removes unsupported attachment promises and normalizes the owner signature", () => {
    const body = normalizeDirectiveEmailBody("عزيزي وائل،\n\nسأعيد إرفاق نسخة الفاتورة.\n\nشكرًا،\nعبدالرحمن");
    expect(body).not.toContain("سأعيد إرفاق");
    expect(body).toContain("عبد الرحمن زقوت");
  });

  it("exposes the same write-or-voice directive channel inside the dossier and an open decision", () => {
    expect(kitchenUi).toContain("وجّه Manus");
    expect(kitchenUi).toContain("كتابة أو صوت");
    expect(kitchenUi).toContain("نفّذ يا Manus");
    expect(kitchenUi).toContain("currentDecisionId={item.id}");
    expect(kitchenUi).toContain("SpeechRecognition");
  });
});
