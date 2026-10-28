import { beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

// Execute the actual entry component with a deterministic hook scheduler. Queries
// and browser navigation are isolated: these tests cannot write project data.
const h = vi.hoisted(() => ({
  selected: 1 as number | null,
  path: "/bateekha",
  search: "projectId=1",
  index: 0,
  changed: false,
  slots: [] as any[],
  effects: [] as Array<() => void>,
  setProject: null as any,
  navigate: null as any,
  selector: null as any,
}));
const sameDeps = (a: any[] | undefined, b: any[] | undefined) =>
  Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    lazy: () => () => null,
    useState: (initial: any) => {
      const i = h.index++;
      if (!h.slots[i]) h.slots[i] = { value: typeof initial === "function" ? initial() : initial };
      return [h.slots[i].value, (next: any) => {
        const value = typeof next === "function" ? next(h.slots[i].value) : next;
        if (!Object.is(value, h.slots[i].value)) { h.slots[i].value = value; h.changed = true; }
      }];
    },
    useMemo: (fn: any, deps: any[]) => {
      const i = h.index++;
      if (!h.slots[i] || !sameDeps(h.slots[i].deps, deps)) h.slots[i] = { value: fn(), deps };
      return h.slots[i].value;
    },
    useEffect: (fn: any, deps: any[]) => {
      const i = h.index++;
      if (!h.slots[i] || !sameDeps(h.slots[i].deps, deps)) {
        h.slots[i] = { deps };
        h.effects.push(fn);
      }
    },
  };
});
vi.mock("wouter", () => ({ useLocation: () => [h.path, h.navigate], useSearch: () => h.search }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("@/contexts/ProjectContext", () => ({
  useProjectContext: () => ({ selectedProjectId: h.selected, setSelectedProjectId: h.setProject }),
}));
vi.mock("@/lib/trpc", () => ({ trpc: { projects: { getById: { useQuery: (id: number) => ({
  data: id ? { id, name: `project-${id}`, plotNumber: "6185392", financingScenario: "build_for_sale" } : undefined,
}) } } } }));
vi.mock("@/components/ProjectSelector", () => {
  h.selector = () => null;
  return { ProjectSelector: h.selector };
});
import BateekhaPage from "../client/src/pages/BateekhaPage";

function find(tree: any, predicate: (node: any) => boolean): any {
  if (!tree) return undefined;
  if (Array.isArray(tree)) return tree.map(n => find(n, predicate)).find(Boolean);
  if (predicate(tree)) return tree;
  return find(tree.props?.children, predicate);
}
function render(props: Parameters<typeof BateekhaPage>[0] = {}) {
  for (let n = 0; n < 30; n++) {
    h.index = 0; h.changed = false; h.effects = [];
    const tree = BateekhaPage(props);
    h.effects.forEach(fn => fn());
    if (!h.changed) return tree;
  }
  throw new Error("Project selection did not settle: conflicting state/URL effects");
}
function pick(tree: any, id: number) {
  const selector = find(tree, node => node.type === h.selector);
  expect(selector).toBeDefined();
  selector.props.onSelect(id);
  return render();
}

beforeEach(() => {
  h.selected = 1; h.path = "/bateekha"; h.search = "projectId=1";
  h.slots = []; h.effects = []; h.index = 0; h.changed = false;
  h.setProject = vi.fn((id: number | null) => {
    if (h.selected !== id) { h.selected = id; h.changed = true; }
  });
  h.navigate = vi.fn((target: string) => {
    const u = new URL(target, "https://como.example");
    h.path = u.pathname; h.search = u.search.slice(1); h.changed = true;
  });
  vi.stubGlobal("React", React);
  vi.stubGlobal("window", { location: {
    get search() { return `?${h.search}`; },
    get pathname() { return h.path; }, hash: "",
  }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe("Financial Studies project switch", () => {
  it("keeps a newly selected project instead of restoring the entry URL's old id", () => {
    const tree = pick(render(), 4);
    expect(h.selected).toBe(4);
    expect(new URLSearchParams(h.search).get("projectId")).toBe("4");
    expect(find(tree, n => n.type === h.selector).props.selectedId).toBe(4);
  });

  it("opens each card and returns to the newly selected project's board", () => {
    let tree = pick(render(), 4);
    const card = find(tree, n => n.type === "button" && n.props.children?.some?.((c: any) => c?.props?.children === "بطاقة المشروع"));
    expect(card).toBeDefined();
    card.props.onClick();
    tree = render();
    expect(new URLSearchParams(h.search).get("projectId")).toBe("4");
    expect(new URLSearchParams(h.search).get("tab")).toBe("general");
    const back = find(tree, n => n.type === "button" && n.props.children?.includes?.("العودة إلى الصفحة السابقة"));
    expect(back).toBeDefined();
    back.props.onClick();
    tree = render();
    expect(h.selected).toBe(4);
    expect(h.search).toBe("projectId=4");
    expect(find(tree, n => n.type === h.selector).props.selectedId).toBe(4);
  });

  it("responds to back/forward or a same-path link changing only projectId", () => {
    render();
    h.search = "projectId=5";
    const tree = render();
    expect(h.selected).toBe(5);
    expect(find(tree, n => n.type === h.selector).props.selectedId).toBe(5);
    h.search = "projectId=1";
    render();
    expect(h.selected).toBe(1);
  });

  it("preserves returnTo and unrelated query flags on a project choice", () => {
    h.search = "projectId=1&legacy=1&returnTo=%2Fproject-management";
    pick(render(), 6);
    const p = new URLSearchParams(h.search);
    expect(p.get("projectId")).toBe("6");
    expect(p.get("legacy")).toBe("1");
    expect(p.get("returnTo")).toBe("/project-management");
  });

  it("does not reassert a stale entry id on an unrelated context update", () => {
    render();
    h.selected = 4;
    render();
    expect(h.selected).toBe(4);
  });

  it("leaves the isolated test project route and its local id alone", () => {
    h.path = "/test-project"; h.search = "projectId=999&tab=general";
    render({ mode: "test", testProjectId: 999 });
    expect(h.selected).toBe(999);
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
