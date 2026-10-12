import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { directiveRequestsCommunicationDraft } from "./services/comoNextExecutiveDirectives";

const service = readFileSync("server/services/comoNextStagedDirectives.ts", "utf8");
const dispatch = readFileSync("server/services/comoManusDispatch.ts", "utf8");
const schema = readFileSync("drizzle/schema.ts", "utf8");
const migration = readFileSync("drizzle/0096_como_next_staged_directives.sql", "utf8");
const saraRouter = readFileSync("server/routers/saraRealtime.ts", "utf8");
const comoRouter = readFileSync("server/routers/comoNext.ts", "utf8");
const kitchenUi = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const saraInstructions = readFileSync("server/services/saraRealtime.ts", "utf8");

describe("COMO Next staged directives", () => {
  it("uses an additive review table with provenance, file scope, and a unique user stage key", () => {
    expect(schema).toContain('mysqlTable("como_next_staged_directives"');
    expect(schema).toContain('mysqlEnum("source", ["sara", "manual"])');
    expect(schema).toContain('mysqlEnum("status", ["pending", "submitting", "submitted", "cancelled", "failed"])');
    expect(migration).toContain("CREATE TABLE como_next_staged_directives");
    expect(migration).toContain("UNIQUE INDEX como_next_staged_directive_user_key_uq");
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE|ALTER)\b/im);
  });

  it("stages Sara text without execution or a mailbox draft", () => {
    expect(saraRouter).toContain("stageExecutiveDirectiveCommand");
    expect(saraRouter).toContain('source: "sara"');
    expect(saraRouter).toContain("executionStarted: false");
    expect(saraRouter).not.toContain("executeExecutiveDirectiveCommand");
    expect(saraInstructions).toContain("احكي لمانوس");
    expect(saraInstructions).toContain("اخبري مانوس");
    expect(saraInstructions).toContain("خلي ما نرسل");
  });

  it("protects cross-user/project references and permits edits or cancellation only before submit", () => {
    expect(service).toContain("requireProjectAccess");
    expect(service).toContain("assertScopedReferences");
    expect(service).toContain('eq(comoNextActions.workFileId, input.workFileId)');
    expect(service).toContain('eq(comoNextDecisions.workFileId, input.workFileId)');
    expect(service).toContain('["pending", "failed"]');
    expect(service).toContain("لا يمكن تعديل نص تم تسليمه إلى Manus");
    expect(service).toContain("لا يمكن إلغاء توجيه تم تسليمه إلى Manus");
  });

  it("requires the authenticated app owner and atomically claims exactly one idempotent submission", () => {
    expect(comoRouter).toContain("assertAuthenticatedAppOwner");
    expect(comoRouter).toContain("submitStagedDirective:");
    expect(dispatch).toContain("status='submitting'");
    expect(dispatch).toContain("['pending','failed','submitting']");
    expect(service).toContain("CONFLICT");
    expect(dispatch).toContain("idempotencyKey:`staged-directive:${input.directiveId}`");
    expect(service).toContain("recoverDispatchFromAppliedReceipt");
    expect(service).not.toContain("executeExecutiveDirectiveCommand(");
    expect(service).toContain("deliverQueuedManusDispatch");
  });

  it("keeps the exact dossier context editable before delivery and collapses delivery receipts", () => {
    expect(kitchenUi).toContain("listStagedDirectives.useQuery");
    expect(kitchenUi).toContain("5_000 : false");
    expect(kitchenUi).toContain("StagedDirectiveCard");
    expect(kitchenUi).toContain("سلّم التوجيه إلى Manus");
    expect(kitchenUi).toContain('if (text !== directive.directiveText)');
    expect(kitchenUi).toContain('onSubmit(directive, text)');
    expect(kitchenUi).toContain("StagedDirectiveCard");
    expect(service).toContain('const activeStatuses: DirectiveStatus[] = ["pending", "submitting", "failed"]');
    expect(service).toContain('eq(comoNextStagedDirectives.status, "submitted")');
    expect(service).toContain("const directives = [...active, ...delivered]");
    expect(kitchenUi).toContain("como-next:directive-staged");
    expect(kitchenUi).toContain("لا يُعد العمل واصلًا إلا عند تأكيد التسليم");
  });

  it("presents Sara as the capture channel for the owner's request and delivers the text visible after editing", () => {
    expect(kitchenUi).toContain("طلبك عبر سارة");
    expect(kitchenUi).toContain("طلبك إلى Manus");
    expect(kitchenUi).toContain("زر التسليم يحفظ أي تعديل ظاهر ثم يضعه في قناة Manus");
    expect(kitchenUi).toContain("سلّم النص الظاهر إلى Manus");
    expect(kitchenUi).not.toContain('directive.source === "sara" ? "من سارة"');
  });

  it("treats literal no-send negatives as overriding an otherwise mail-like instruction", () => {
    expect(directiveRequestsCommunicationDraft("ذكّري وائل، خلي ما نرسل البريد")).toBe(false);
    expect(directiveRequestsCommunicationDraft("لا تبعتي رسالة ل وائل")).toBe(false);
    expect(directiveRequestsCommunicationDraft("ذكّري وائل أن يرد على العرض")).toBe(true);
  });
});
