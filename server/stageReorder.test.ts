/**
 * Unit tests for stage position-based reordering logic.
 * Tests the moveToPosition function that allows moving a stage
 * to any 1-based position with automatic sequential renumbering.
 */

import { describe, it, expect } from "vitest";

interface Stage {
  id: number;
  nameAr: string;
  sortOrder: number;
}

/**
 * Mirrors the moveToPosition logic in StageSettingsView.
 * Returns the new ordered list with updated sortOrder values,
 * or null if the position is out of range.
 */
function moveToPosition(
  sortedStages: Stage[],
  stageId: number,
  newPos: number
): { id: number; sortOrder: number }[] | null {
  const total = sortedStages.length;
  if (newPos < 1 || newPos > total) return null;

  const currentIndex = sortedStages.findIndex((s) => s.id === stageId);
  if (currentIndex === -1 || currentIndex === newPos - 1) {
    // No change needed
    return sortedStages.map((s, i) => ({ id: s.id, sortOrder: (i + 1) * 10 }));
  }

  const reordered = [...sortedStages];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(newPos - 1, 0, moved);

  return reordered.map((s, i) => ({ id: s.id, sortOrder: (i + 1) * 10 }));
}

const stages: Stage[] = [
  { id: 1, nameAr: "مرحلة أ", sortOrder: 10 },
  { id: 2, nameAr: "مرحلة ب", sortOrder: 20 },
  { id: 3, nameAr: "مرحلة ج", sortOrder: 30 },
  { id: 4, nameAr: "مرحلة د", sortOrder: 40 },
  { id: 5, nameAr: "مرحلة هـ", sortOrder: 50 },
];

describe("moveToPosition - stage reordering", () => {
  it("moves stage from position 1 to position 3", () => {
    const result = moveToPosition(stages, 1, 3);
    expect(result).not.toBeNull();
    const ordered = result!.sort((a, b) => a.sortOrder - b.sortOrder);
    expect(ordered.map((r) => r.id)).toEqual([2, 3, 1, 4, 5]);
  });

  it("moves stage from position 3 to position 5 (last)", () => {
    const result = moveToPosition(stages, 3, 5);
    expect(result).not.toBeNull();
    const ordered = result!.sort((a, b) => a.sortOrder - b.sortOrder);
    expect(ordered.map((r) => r.id)).toEqual([1, 2, 4, 5, 3]);
  });

  it("moves stage from position 5 to position 1 (first)", () => {
    const result = moveToPosition(stages, 5, 1);
    expect(result).not.toBeNull();
    const ordered = result!.sort((a, b) => a.sortOrder - b.sortOrder);
    expect(ordered.map((r) => r.id)).toEqual([5, 1, 2, 3, 4]);
  });

  it("assigns sequential sortOrder values (10, 20, 30, ...)", () => {
    const result = moveToPosition(stages, 1, 3);
    expect(result).not.toBeNull();
    const sortOrders = result!.sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.sortOrder);
    expect(sortOrders).toEqual([10, 20, 30, 40, 50]);
  });

  it("returns null for position 0 (out of range)", () => {
    expect(moveToPosition(stages, 1, 0)).toBeNull();
  });

  it("returns null for position > total (out of range)", () => {
    expect(moveToPosition(stages, 1, 6)).toBeNull();
  });

  it("no-op when moving to same position", () => {
    const result = moveToPosition(stages, 3, 3);
    expect(result).not.toBeNull();
    const ordered = result!.sort((a, b) => a.sortOrder - b.sortOrder);
    expect(ordered.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("all stages get unique sortOrder values after reorder", () => {
    const result = moveToPosition(stages, 2, 4);
    expect(result).not.toBeNull();
    const sortOrders = result!.map((r) => r.sortOrder);
    const unique = new Set(sortOrders);
    expect(unique.size).toBe(sortOrders.length);
  });

  it("moves stage from position 3 to position 1", () => {
    const result = moveToPosition(stages, 3, 1);
    expect(result).not.toBeNull();
    const ordered = result!.sort((a, b) => a.sortOrder - b.sortOrder);
    expect(ordered.map((r) => r.id)).toEqual([3, 1, 2, 4, 5]);
  });
});
