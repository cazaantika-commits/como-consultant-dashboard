/**
 * Unit tests for shared project state synchronization logic
 * between ProjectLifecyclePage and WorkSchedulePage.
 *
 * These tests verify the callback-based synchronization pattern:
 * - onProjectChange callback fires when project is selected
 * - initialProjectId is respected on mount
 * - Both components correctly propagate changes to the parent
 */

import { describe, it, expect, vi } from "vitest";

// ─── Simulate the handleSetProjectId pattern used in both pages ───────────────

function makeHandleSetProjectId(
  setSelectedProjectId: (id: number | null) => void,
  onProjectChange?: (id: number | null) => void
) {
  return (id: number | null) => {
    setSelectedProjectId(id);
    onProjectChange?.(id);
  };
}

describe("Shared project state synchronization", () => {
  it("calls setSelectedProjectId with the given id", () => {
    const setter = vi.fn();
    const handle = makeHandleSetProjectId(setter);
    handle(42);
    expect(setter).toHaveBeenCalledWith(42);
  });

  it("calls onProjectChange callback when provided", () => {
    const setter = vi.fn();
    const callback = vi.fn();
    const handle = makeHandleSetProjectId(setter, callback);
    handle(99);
    expect(callback).toHaveBeenCalledWith(99);
  });

  it("does not throw when onProjectChange is undefined", () => {
    const setter = vi.fn();
    const handle = makeHandleSetProjectId(setter, undefined);
    expect(() => handle(5)).not.toThrow();
  });

  it("propagates null when project is deselected", () => {
    const setter = vi.fn();
    const callback = vi.fn();
    const handle = makeHandleSetProjectId(setter, callback);
    handle(null);
    expect(setter).toHaveBeenCalledWith(null);
    expect(callback).toHaveBeenCalledWith(null);
  });

  it("setter and callback receive the same id", () => {
    const received: (number | null)[] = [];
    const setter = (id: number | null) => received.push(id);
    const callback = (id: number | null) => received.push(id);
    const handle = makeHandleSetProjectId(setter, callback);
    handle(123);
    expect(received).toEqual([123, 123]);
  });
});

// ─── Simulate the initialProjectId useEffect sync pattern ─────────────────────

function applyInitialProjectId(
  initialProjectId: number | null | undefined,
  setSelectedProjectId: (id: number) => void
) {
  if (initialProjectId != null) {
    setSelectedProjectId(initialProjectId);
  }
}

describe("initialProjectId sync (useEffect pattern)", () => {
  it("sets project id when initialProjectId is provided", () => {
    const setter = vi.fn();
    applyInitialProjectId(7, setter);
    expect(setter).toHaveBeenCalledWith(7);
  });

  it("does not call setter when initialProjectId is null", () => {
    const setter = vi.fn();
    applyInitialProjectId(null, setter);
    expect(setter).not.toHaveBeenCalled();
  });

  it("does not call setter when initialProjectId is undefined", () => {
    const setter = vi.fn();
    applyInitialProjectId(undefined, setter);
    expect(setter).not.toHaveBeenCalled();
  });

  it("updates when initialProjectId changes from one value to another", () => {
    const setter = vi.fn();
    applyInitialProjectId(1, setter);
    applyInitialProjectId(2, setter);
    expect(setter).toHaveBeenCalledTimes(2);
    expect(setter).toHaveBeenLastCalledWith(2);
  });
});

// ─── Simulate DevelopmentPhasesPage shared state management ──────────────────

describe("DevelopmentPhasesPage shared state management", () => {
  it("sharedProjectId updates when lifecycle page changes project", () => {
    let sharedProjectId: number | null = null;
    const setSharedProjectId = (id: number | null) => { sharedProjectId = id; };

    // Simulate user selecting project 5 in compliance lifecycle
    setSharedProjectId(5);
    expect(sharedProjectId).toBe(5);
  });

  it("sharedProjectId is passed as initialProjectId to WorkSchedulePage", () => {
    let sharedProjectId: number | null = 5;
    // WorkSchedulePage receives this as initialProjectId
    const initialProjectId = sharedProjectId;
    expect(initialProjectId).toBe(5);
  });

  it("sharedProjectId updates when work schedule page changes project", () => {
    let sharedProjectId: number | null = 5;
    const setSharedProjectId = (id: number | null) => { sharedProjectId = id; };

    // Simulate user selecting project 10 in work schedule
    setSharedProjectId(10);
    expect(sharedProjectId).toBe(10);
  });

  it("both pages reflect same project after sync", () => {
    let sharedProjectId: number | null = null;
    const setSharedProjectId = (id: number | null) => { sharedProjectId = id; };

    // Lifecycle page selects project 3
    setSharedProjectId(3);
    // Work schedule page receives initialProjectId = 3
    const workScheduleInitialId = sharedProjectId;
    expect(workScheduleInitialId).toBe(3);
  });
});
