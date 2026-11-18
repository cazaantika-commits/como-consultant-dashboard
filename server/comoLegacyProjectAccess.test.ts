import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyColumn, SQL } from "drizzle-orm";
import type { AppOwnerBinding } from "./services/comoAppOwner";
import type { LegacyProjectActor } from "./services/comoLegacyProjectAccess";

type FixtureRow = Map<AnyColumn, unknown>;
type Predicate = (row: FixtureRow) => boolean;
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  mailboxDraft: vi.fn(() => { throw new Error("Mailbox must never be called"); }),
  predicates: new WeakMap<SQL, Predicate>(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./emailMonitor", () => ({ saveComoMailboxDraft: mocks.mailboxDraft }));
// Keep the real SQL expressions and schema. Attach an in-memory predicate to
// each expression so the fake SELECT executes the WHERE/JOIN behavior on rows.
vi.mock("drizzle-orm", async importOriginal => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  const evaluate = (condition: SQL | undefined, row: FixtureRow) => {
    if (!condition) return true;
    const predicate = mocks.predicates.get(condition);
    if (!predicate) throw new Error("Unsupported fixture condition");
    return predicate(row);
  };
  return {
    ...actual,
    eq: (column: AnyColumn, value: unknown) => {
      const expression = actual.eq(column, value);
      mocks.predicates.set(expression, row => {
        const other = row.has(value as AnyColumn) ? row.get(value as AnyColumn) : value;
        return row.get(column) === other;
      });
      return expression;
    },
    and: (...conditions: (SQL | undefined)[]) => {
      const expression = actual.and(...conditions);
      if (expression) mocks.predicates.set(expression, row => conditions.every(condition => evaluate(condition, row)));
      return expression;
    },
    or: (...conditions: (SQL | undefined)[]) => {
      const expression = actual.or(...conditions);
      if (expression) mocks.predicates.set(expression, row => conditions.some(condition => evaluate(condition, row)));
      return expression;
    },
    inArray: (column: AnyColumn, values: unknown[]) => {
      const expression = actual.inArray(column, values);
      mocks.predicates.set(expression, row => values.includes(row.get(column)));
      return expression;
    },
  };
});

import { comoAppOwnerIdentity, comoNextProjectAccess, projects } from "../drizzle/schema";
import { matchesAuthenticatedAppOwner } from "./services/comoAppOwner";
import { requireProjectAccess } from "./services/comoNextCommands";
import {
  deriveAuthorizedProjectIds,
  requireLegacyProjectOwner,
  requireLegacyProjectRead,
  requireLegacyProjectWrite,
} from "./services/comoLegacyProjectAccess";

type ProjectFixture = { id: number; userId: number; name: string; isTestProject: number };
type GrantFixture = { projectId: number; userId: number; role: string };
const owner = { id: 1, openId: "bound-owner", role: "admin" as const };
const contributor = { id: 2, openId: "contributor", role: "user" as const };
const viewer = { id: 3, openId: "viewer", role: "user" as const };
const manager = { id: 4, openId: "manager", role: "user" as const };
const outsider = { id: 8, openId: "other-admin", role: "admin" as const };
const defaultProjects: ProjectFixture[] = [
  { id: 10, userId: 1, name: "Owner project", isTestProject: 0 },
  { id: 20, userId: 9, name: "Other project", isTestProject: 0 },
  { id: 30, userId: 1, name: "Test project", isTestProject: 1 },
];
const defaultGrants: GrantFixture[] = [
  { projectId: 10, userId: 2, role: "contributor" },
  { projectId: 10, userId: 3, role: "viewer" },
  { projectId: 10, userId: 4, role: "manager" },
  { projectId: 20, userId: 7, role: "contributor" },
  { projectId: 30, userId: 2, role: "manager" },
];
const defaultBinding: AppOwnerBinding = { userId: 1, openId: owner.openId, isActive: 1 };

function fixtureDatabase(options: {
  projectRows?: ProjectFixture[];
  grants?: GrantFixture[];
  binding?: AppOwnerBinding | null;
} = {}) {
  const projectRows = options.projectRows ?? defaultProjects;
  const grants = options.grants ?? defaultGrants;
  const binding = options.binding === undefined ? defaultBinding : options.binding;
  const tableRows = (table: unknown): FixtureRow[] => {
    if (table === projects) return projectRows.map(project => new Map<AnyColumn, unknown>([
      [projects.id, project.id], [projects.userId, project.userId],
      [projects.name, project.name], [projects.isTestProject, project.isTestProject],
    ]));
    if (table === comoNextProjectAccess) return grants.map(grant => new Map<AnyColumn, unknown>([
      [comoNextProjectAccess.projectId, grant.projectId], [comoNextProjectAccess.userId, grant.userId],
      [comoNextProjectAccess.accessRole, grant.role],
    ]));
    if (table === comoAppOwnerIdentity) return binding ? [new Map<AnyColumn, unknown>([
      [comoAppOwnerIdentity.id, 1], [comoAppOwnerIdentity.userId, binding.userId],
      [comoAppOwnerIdentity.openId, binding.openId], [comoAppOwnerIdentity.isActive, binding.isActive],
    ])] : [];
    throw new Error("Unexpected fixture table");
  };
  const evaluate = (condition: SQL, row: FixtureRow) => {
    const predicate = mocks.predicates.get(condition);
    if (!predicate) throw new Error("Unknown WHERE/JOIN predicate");
    return predicate(row);
  };
  const select = vi.fn((selection: Record<string, AnyColumn>) => {
    let rows: FixtureRow[] = [];
    const results = () => rows.map(row => Object.fromEntries(
      Object.entries(selection).map(([key, column]) => [key, row.get(column)]),
    ));
    const query = {
      from(table: unknown) { rows = tableRows(table); return query; },
      leftJoin(table: unknown, condition: SQL) {
        rows = rows.flatMap(row => {
          const joined = tableRows(table).map(other => new Map<AnyColumn, unknown>([
            ...Array.from(row.entries()), ...Array.from(other.entries()),
          ]))
            .filter(candidate => evaluate(condition, candidate));
          return joined.length ? joined : [row];
        });
        return query;
      },
      where(condition: SQL) { rows = rows.filter(row => evaluate(condition, row)); return query; },
      async limit(count: number) { return results().slice(0, count); },
      then(resolve: (value: Record<string, unknown>[]) => unknown) { return Promise.resolve(results()).then(resolve); },
    };
    return query;
  });
  const forbiddenWrite = vi.fn(() => { throw new Error("Authorization must only SELECT"); });
  return {
    select, selectDistinct: select,
    insert: forbiddenWrite, update: forbiddenWrite, delete: forbiddenWrite,
    execute: forbiddenWrite, transaction: forbiddenWrite, forbiddenWrite,
  };
}

let database: ReturnType<typeof fixtureDatabase>;
beforeEach(() => {
  vi.clearAllMocks();
  database = fixtureDatabase();
  mocks.getDb.mockResolvedValue(database);
});

describe("legacy authentication and project scope", () => {
  it.each([null, undefined, { ...owner, id: 0 }, { ...owner, id: NaN },
    { ...owner, id: 1.5 }, { ...owner, openId: "" }, { ...owner, openId: "  " }])(
    "rejects missing or malformed session before any database access: %j", async actor => {
      for (const guard of [requireLegacyProjectRead, requireLegacyProjectWrite, requireLegacyProjectOwner]) {
        await expect(guard(actor, 10)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      }
      await expect(deriveAuthorizedProjectIds(actor)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(mocks.getDb).not.toHaveBeenCalled();
    },
  );
  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid project ID before any SQL: %s", async id => {
      for (const guard of [requireLegacyProjectRead, requireLegacyProjectWrite, requireLegacyProjectOwner]) {
        await expect(guard(owner, id)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      expect(mocks.getDb).not.toHaveBeenCalled();
    },
  );
  it("allows the project owner and the three existing grant roles to read", async () => {
    for (const [actor, role] of [[owner, "manager"], [contributor, "contributor"], [viewer, "viewer"], [manager, "manager"]] as const) {
      await expect(requireLegacyProjectRead(actor, 10)).resolves.toMatchObject({ project: { id: 10 }, role });
    }
    expect(database.forbiddenWrite).not.toHaveBeenCalled();
    expect(mocks.mailboxDraft).not.toHaveBeenCalled();
  });
  it("allows owner, contributor and manager writes but denies viewer", async () => {
    for (const actor of [owner, contributor, manager]) {
      await expect(requireLegacyProjectWrite(actor, 10)).resolves.toMatchObject({ project: { id: 10 } });
    }
    await expect(requireLegacyProjectWrite(viewer, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(database.forbiddenWrite).not.toHaveBeenCalled();
  });
  it("does not grant project access from admin status, another user's grant or a payload name", async () => {
    const payloadNamedActor = { ...outsider, name: "User1", evaluatorName: "عبد الرحمن", agentName: "سلوى" };
    for (const guard of [requireLegacyProjectRead, requireLegacyProjectWrite, requireLegacyProjectOwner]) {
      await expect(guard(payloadNamedActor, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(requireLegacyProjectRead(contributor, 20)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("treats unknown and test projects as forbidden without changing the original guard's NOT_FOUND contract", async () => {
    for (const id of [30, 999]) {
      for (const guard of [requireLegacyProjectRead, requireLegacyProjectWrite, requireLegacyProjectOwner]) {
        await expect(guard(owner, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    const db: Parameters<typeof requireProjectAccess>[0] = database as unknown as Parameters<typeof requireProjectAccess>[0];
    await expect(requireProjectAccess(db, 999, owner.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("fails closed on an unknown stored grant role", async () => {
    mocks.getDb.mockResolvedValue(fixtureDatabase({ grants: [{ projectId: 10, userId: 2, role: "future_role" }] }));
    await expect(requireLegacyProjectRead(contributor, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireLegacyProjectWrite(contributor, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deriveAuthorizedProjectIds(contributor)).resolves.toEqual([]);
  });
  it("does not swallow database verification failures", async () => {
    mocks.getDb.mockResolvedValue(null);
    for (const guard of [requireLegacyProjectRead, requireLegacyProjectWrite, requireLegacyProjectOwner]) {
      await expect(guard(owner, 10)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    }
    await expect(deriveAuthorizedProjectIds(owner)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    const error = new Error("isolated connection failure");
    mocks.getDb.mockRejectedValue(error);
    await expect(requireLegacyProjectRead(owner, 10)).rejects.toBe(error);
  });
});

describe("provisioned app owner plus project write scope", () => {
  it("accepts only exact id/openId/admin and isActive=1", async () => {
    await expect(requireLegacyProjectOwner(owner, 10)).resolves.toMatchObject({ role: "manager" });
    for (const actor of [{ ...owner, id: 2 }, { ...owner, openId: "forged" }, { ...owner, role: "user" as const }, manager]) {
      await expect(requireLegacyProjectOwner(actor, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(database.forbiddenWrite).not.toHaveBeenCalled();
  });
  it.each([0, 2, -1])("never bypasses a disabled/invalid owner binding: %s", async isActive => {
    mocks.getDb.mockResolvedValue(fixtureDatabase({ binding: { ...defaultBinding, isActive } }));
    await expect(requireLegacyProjectOwner(owner, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("requires provisioning even where the old identity utility permits an exact ENV fallback", async () => {
    expect(matchesAuthenticatedAppOwner(owner, null, owner.openId)).toBe(true);
    mocks.getDb.mockResolvedValue(fixtureDatabase({ binding: null }));
    await expect(requireLegacyProjectOwner(owner, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rechecks the binding on every call but leaves ordinary project reads independent", async () => {
    await requireLegacyProjectOwner(owner, 10);
    mocks.getDb.mockResolvedValue(fixtureDatabase({ binding: { ...defaultBinding, isActive: 0 } }));
    await expect(requireLegacyProjectOwner(owner, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireLegacyProjectRead(viewer, 10)).resolves.toMatchObject({ role: "viewer" });
  });
  it("owner identity alone cannot bypass another project or viewer write restriction", async () => {
    await expect(requireLegacyProjectOwner(owner, 20)).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.getDb.mockResolvedValue(fixtureDatabase({ grants: [{ projectId: 20, userId: 1, role: "viewer" }] }));
    await expect(requireLegacyProjectOwner(owner, 20)).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.getDb.mockResolvedValue(fixtureDatabase({ grants: [{ projectId: 20, userId: 1, role: "contributor" }] }));
    await expect(requireLegacyProjectOwner(owner, 20)).resolves.toMatchObject({ role: "contributor" });
  });
});

describe("aggregate REST scope uses only authorized official projects.id", () => {
  it.each([owner, contributor, viewer, manager])("returns the same read scope as individual checks: %j", async actor => {
    const expected: number[] = [];
    for (const project of defaultProjects) {
      try { await requireLegacyProjectRead(actor, project.id); expected.push(project.id); } catch { /* denied fixture */ }
    }
    await expect(deriveAuthorizedProjectIds(actor)).resolves.toEqual(expected);
    expect(database.forbiddenWrite).not.toHaveBeenCalled();
  });
  it("filters viewer from write scope, excludes test grants, other users' grants and admin fallback", async () => {
    await expect(deriveAuthorizedProjectIds(viewer, "write")).resolves.toEqual([]);
    await expect(deriveAuthorizedProjectIds(contributor, "write")).resolves.toEqual([10]);
    await expect(deriveAuthorizedProjectIds(manager, "write")).resolves.toEqual([10]);
    await expect(deriveAuthorizedProjectIds(outsider)).resolves.toEqual([]);
  });
  it("deduplicates join results and handles an empty scope without mutation or mailbox activity", async () => {
    mocks.getDb.mockResolvedValue(fixtureDatabase({ grants: [...defaultGrants, defaultGrants[0]!] }));
    await expect(deriveAuthorizedProjectIds(contributor)).resolves.toEqual([10]);
    mocks.getDb.mockResolvedValue(fixtureDatabase({ projectRows: [], grants: [] }));
    await expect(deriveAuthorizedProjectIds(owner)).resolves.toEqual([]);
    expect(mocks.mailboxDraft).not.toHaveBeenCalled();
  });
  it("rejects a malformed runtime requirement before accessing the database", async () => {
    const malformed = "owner" as unknown as Parameters<typeof deriveAuthorizedProjectIds>[1];
    await expect(deriveAuthorizedProjectIds(owner, malformed)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

// Compile-time compatibility: every full ctx.user satisfies this narrow actor
// contract. Neither request/response nor a fabricated payload identity is needed.
type ContextUser = import("./_core/context").TrpcContext["user"];
const actorContract = (user: ContextUser): LegacyProjectActor => user;
void actorContract;
