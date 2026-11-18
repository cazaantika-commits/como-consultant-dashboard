import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  communicationPresentationLabel, dashboardDestinations, filterKitchenProjectRecords,
  isPendingCommunication, isSavedUnsentCommunication, sentEmailDestination,
} from "../shared/comoPresentation";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), access: vi.fn(), foundation: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./services/comoNextCommands", () => ({ requireProjectAccess: mocks.access }));
vi.mock("./services/comoNextProjectFoundation", () => ({ loadProjectFoundation: mocks.foundation }));
vi.mock("@/lib/trpc", () => ({ trpc: new Proxy({}, { get() { throw new Error("Live query/mutation is forbidden in static rendering"); } }) }));
vi.mock("@/components/ComoNextSpecialistDesks", () => ({ ComoNextSpecialistDesks: () => null }));
import { getProjectExecutiveFile } from "./services/comoNextProjectDossier";
import { RecentReadWindow } from "../client/src/pages/ComoNextProjectPage";

const dialect = new MySqlDialect();
type File = { id: number; projectId: number; importBatchId: string | null; status: string; batchStatus?: string };
type RecordFixture = { id: number; projectId: number; workFileId: number; communicationStatus?: string; meetingStatus?: string };
const files: File[] = [
  { id: 10, projectId: 11, importBatchId: null, status: "open" },
  { id: 20, projectId: 11, importBatchId: "promoted", batchStatus: "promoted", status: "closed" },
  { id: 30, projectId: 11, importBatchId: "staged", batchStatus: "reviewed", status: "open" },
  { id: 40, projectId: 99, importBatchId: null, status: "open" },
];
const visible = (records: RecordFixture[], projectId: number) => records.filter(record => {
  const file = files.find(file => file.id === record.workFileId && file.projectId === record.projectId);
  return record.projectId === projectId && file && (file.importBatchId === null || file.batchStatus === "promoted");
});
const communications: RecordFixture[] = [
  ...Array.from({ length: 25 }, (_, i) => ({ id: i + 1, projectId: 11, workFileId: 10, communicationStatus: "received" })),
  { id: 26, projectId: 11, workFileId: 20, communicationStatus: "archived" },
  { id: 27, projectId: 11, workFileId: 30 },
  { id: 28, projectId: 11, workFileId: 40 },
  { id: 29, projectId: 99, workFileId: 40 },
];
const meetings: RecordFixture[] = Array.from({ length: 18 }, (_, i) => ({ id: i + 1, projectId: 11, workFileId: 10, meetingStatus: "completed" }));
function fixtureDatabase(communicationRows = communications, meetingRows = meetings) {
  const execute = vi.fn(async (expression: SQL) => {
    const { sql, params } = dialect.sqlToQuery(expression);
    if (!/^\s*SELECT\b/i.test(sql) || /\bFOR UPDATE\b/i.test(sql)) throw new Error("Only unlocked SELECT is permitted");
    const projectId = Number(params[0]);
    if (sql.includes("AS communicationTotal")) {
      expect(sql).not.toMatch(/\bLIMIT\b/i);
      expect(sql).toContain("wf.project_id = c.project_id");
      expect(sql).toContain("wf.project_id = m.project_id");
      expect(sql).toContain("b.batch_status = 'promoted'");
      expect(params).toEqual([11, 11]);
      return [[{ communicationTotal: String(visible(communicationRows, projectId).length), meetingTotal: String(visible(meetingRows, projectId).length) }], []];
    }
    if (/FROM projects WHERE id/.test(sql)) return [[{ id: projectId, name: "Fixture" }], []];
    if (/^\s*SELECT c\.id/.test(sql)) {
      expect(sql).toContain("b.batch_status = 'promoted'");
      expect(sql).toContain("wf.project_id = c.project_id");
      expect(sql).toMatch(/LIMIT 12/);
      return [visible(communicationRows, projectId).sort((a, b) => b.id - a.id).slice(0, 12), []];
    }
    if (/^\s*SELECT m\.id/.test(sql)) {
      expect(sql).toContain("b.batch_status = 'promoted'");
      expect(sql).toMatch(/LIMIT 12/);
      return [visible(meetingRows, projectId).sort((a, b) => b.id - a.id).slice(0, 12), []];
    }
    return [[], []];
  });
  const forbidden = () => { throw new Error("Write/transaction/mailbox is forbidden"); };
  return { execute, insert: forbidden, update: forbidden, delete: forbidden, transaction: forbidden };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue(fixtureDatabase());
  mocks.access.mockImplementation(async (_db: unknown, projectId: number, userId: number, required: string) => {
    if (projectId !== 11 || userId !== 1) throw new TRPCError({ code: "FORBIDDEN" });
    expect(required).toBe("read");
    return { project: { id: 11 }, role: "viewer" };
  });
  mocks.foundation.mockResolvedValue({ completeGateCount: 0, totalGateCount: 0, gates: [] });
});

describe("executive dossier read window", () => {
  it("counts the full visible aggregate while returning only the recent 12", async () => {
    const result = await getProjectExecutiveFile({ userId: 1, projectId: 11 });
    expect(result.summary.communications).toBe(26);
    expect(result.summary.meetings).toBe(18);
    expect(result.communications).toHaveLength(12);
    expect(result.meetings).toHaveLength(12);
    expect(result.communications[0].id).toBe(26);
    expect(result.recentWindow).toEqual({ limit: 12, communications: { returned: 12, total: 26, hasMore: true }, meetings: { returned: 12, total: 18, hasMore: true } });
    expect(result.accessRole).toBe("viewer");
  });
  it.each([0, 1, 12])("returns correct total and hasMore at edge count %i", async count => {
    mocks.getDb.mockResolvedValue(fixtureDatabase(communications.slice(0, count), meetings.slice(0, count)));
    const result = await getProjectExecutiveFile({ userId: 1, projectId: 11 });
    expect(result.summary.communications).toBe(count);
    expect(result.recentWindow.communications).toEqual({ returned: count, total: count, hasMore: false });
  });
  it.each([0, -1, NaN, Infinity, 1.5])("rejects invalid user %s before touching DB", async userId => {
    await expect(getProjectExecutiveFile({ userId, projectId: 11 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each([0, -1, NaN, Infinity, 1.5])("rejects invalid project %s before touching DB", async projectId => {
    await expect(getProjectExecutiveFile({ userId: 1, projectId })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each([{ userId: 2, projectId: 11 }, { userId: 1, projectId: 99 }])("rejects a forbidden/unknown scope before dossier SELECTs", async input => {
    const db = fixtureDatabase(); mocks.getDb.mockResolvedValue(db);
    await expect(getProjectExecutiveFile(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.execute).not.toHaveBeenCalled();
    expect(mocks.foundation).not.toHaveBeenCalled();
  });
  it("reports unavailable DB without attempting foundation reads", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(getProjectExecutiveFile({ userId: 1, projectId: 11 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.foundation).not.toHaveBeenCalled();
  });
});

describe("presentation contracts", () => {
  it("redirects Sent to the existing sent filter, not drafts, preserving only official project context", () => {
    expect(sentEmailDestination("?projectId=11&workFileId=44&mailFilter=attention")).toBe("/como-next?section=email&mailFilter=sent&projectId=11");
    expect(sentEmailDestination("?projectId=bad")).toBe("/como-next?section=email&mailFilter=sent");
    expect(dashboardDestinations).toEqual([{ label: "المطبخ التنفيذي", path: "/como-next" }, { label: "إدارة المشروعات", path: "/project-management" }]);
  });
  it("renders actual recent-window component without mounting live effects", () => {
    const html = renderToStaticMarkup(React.createElement(RecentReadWindow, { label: "المراسلات", returned: 12, total: 220, limit: 12 }));
    expect(html).toContain("role=\"status\"");
    expect(html).toContain("<bdi>220</bdi>");
    expect(html).toContain("حد العرض");
    expect(html).toContain("السجل الكامل داخل ملفات الموضوع الأصلية");
  });
  it("filters a selected project without cross-project records, unknown scope or input mutation", () => {
    const input = [{ projectId: 11 }, { projectId: 99 }, {}];
    expect(filterKitchenProjectRecords(input, 11)).toEqual([{ projectId: 11 }]);
    expect(filterKitchenProjectRecords(input, 77)).toEqual([]);
    expect(filterKitchenProjectRecords(input, NaN)).toEqual([]);
    expect(filterKitchenProjectRecords(input, null)).toEqual(input);
    expect(filterKitchenProjectRecords(input, null)).not.toBe(input);
    expect(input).toHaveLength(3);
  });
  it("keeps archived + uniquely server-verified draft_saved as saved, NOT Sent or Cancelled", () => {
    const item = { communicationStatus: "archived", channel: "email", direction: "outbound", mailboxDraftState: "draft_saved" };
    expect(isSavedUnsentCommunication(item)).toBe(true);
    expect(isPendingCommunication(item)).toBe(true);
    expect(communicationPresentationLabel(item)).toBe("محفوظة في Drafts — لم تُرسل");
  });
  it.each(["cancelled", "sent", "received", "unknown"])("does not resurrect %s despite a draft_saved claim", communicationStatus => {
    expect(isSavedUnsentCommunication({ communicationStatus, channel: "email", direction: "outbound", mailboxDraftState: "draft_saved" })).toBe(false);
  });
  it.each([undefined, "duplicate", "append_started", "human_review", "sent_confirmed"])("fails closed on missing/duplicate/unverified ledger %s", mailboxDraftState => {
    const item = { communicationStatus: "archived", channel: "email", direction: "outbound", mailboxDraftState };
    expect(isPendingCommunication(item)).toBe(false);
    expect(communicationPresentationLabel(item)).toBeNull();
  });
  it("does not unlock approved communications or classify them as sent", () => {
    const item = { communicationStatus: "approved_for_send" };
    expect(isPendingCommunication(item)).toBe(true);
    expect(isSavedUnsentCommunication(item)).toBe(false);
    expect(communicationPresentationLabel(item)).toBeNull();
  });
});
