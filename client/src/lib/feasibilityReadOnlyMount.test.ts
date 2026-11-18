import { beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, effects: [] as (() => void)[],
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  readOnly: false, queryError: false,
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState<T>(initial: T) {
      const index = mocks.cursor++;
      if (!(index in mocks.states)) mocks.states[index] = initial;
      return [mocks.states[index] as T, (value: T | ((previous: T) => T)) => {
        const previous = mocks.states[index] as T;
        mocks.states[index] = typeof value === "function" ? (value as (previous: T) => T)(previous) : value;
      }];
    },
    useEffect(effect: () => void) { mocks.effects.push(effect); },
    useMemo<T>(calculate: () => T) { return calculate(); },
    useCallback<T>(callback: T) { return callback; },
  };
});
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1 }, isAuthenticated: true, loading: false, isReadOnly: mocks.readOnly }) }));
vi.mock("@/contexts/ProjectContext", () => ({ useProjectContext: () => ({ selectedProjectId: 2, setSelectedProjectId: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/feasibility", vi.fn()] }));
vi.mock("@/components/feasibility/CostsCashFlowTab", () => ({ default: () => null }));
vi.mock("@/pages/CashFlowSettingsPage", () => ({ default: () => null }));
vi.mock("@/pages/CapitalScheduleTablePage", () => ({ default: () => null }));
vi.mock("@/lib/feasibilityReportExport", () => ({ exportFeasibilityReport: vi.fn() }));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ data, isLoading: false, isError: mocks.queryError, refetch: vi.fn() });
  const mutation = (mutate: typeof mocks.create) => ({ mutate, isPending: false });
  return { trpc: {
    projects: { list: { useQuery: () => query([{ id: 2, name: "Fixture", landPrice: "0", manualBuaSqft: "0", estimatedConstructionPricePerSqft: "0" }]) } },
    feasibility: {
      listByProject: { useQuery: () => query([]) }, getById: { useQuery: () => query(null) },
      create: { useMutation: () => mutation(mocks.create) }, update: { useMutation: () => mutation(mocks.update) }, delete: { useMutation: () => mutation(mocks.delete) },
    },
    costsCashFlow: { getSyncStatus: { useQuery: () => query(null) } },
    marketOverview: { getByProject: { useQuery: () => query(null) } },
    competitionPricing: { getByProject: { useQuery: () => query(null) } },
    cashFlowProgram: { getProjectScenarios: { useQuery: () => query({ 2: "build_for_rent" }) } },
    cashFlowSettings: { getSettings: { useQuery: () => query(null) } },
  } };
});
import { isValidElement } from "react";
import FeasibilityStudyPage from "../pages/FeasibilityStudyPage";

function elements(node: ReactNode): { text: string; click?: () => void }[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (typeof node === "string") return [{ text: node }];
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return [];
  const children = elements(node.props.children);
  return [...children, { text: children.map(item => item.text).join(" "), click: node.props.onClick }];
}
function render() {
  mocks.cursor = 0;
  const tree = FeasibilityStudyPage({ embedded: true, initialProjectId: 2 });
  const effects = mocks.effects.splice(0);
  effects.forEach(effect => effect());
  return elements(tree);
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.states.length = 0; mocks.effects.length = 0; mocks.readOnly = false; mocks.queryError = false;
  vi.stubGlobal("React", React);
});
describe("feasibility read mount with mocked hooks and RPC", () => {
  it("mounts and repeats read effects without creating or saving a study", () => {
    render(); const tree = render();
    expect(tree.some(element => element.text.includes("النموذج الفارغ للقراءة فقط"))).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.delete).not.toHaveBeenCalled();
  });
  it("allows explicit creation only by clicking and preserves intentional zero inputs", () => {
    const button = render().find(element => element.click && element.text.includes("إنشاء دراسة تقديرية"));
    expect(button?.click).toBeTypeOf("function"); button?.click?.();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: 2, landPrice: 0, estimatedBua: 0, constructionCostPerSqft: 0 }));
  });
  it("keeps the empty study read-only for a read-only session", () => {
    mocks.readOnly = true;
    const tree = render();
    expect(tree.some(element => element.click && element.text.includes("إنشاء دراسة تقديرية"))).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not confuse a failed source with an empty study or expose creation", () => {
    mocks.queryError = true;
    const tree = render();
    expect(tree.some(element => element.text.includes("فشل المصدر"))).toBe(true);
    expect(tree.some(element => element.click && element.text.includes("إنشاء دراسة تقديرية"))).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
