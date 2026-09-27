import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");

function between(start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("COMO Next focus mode", () => {
  it("shows only action titles in the executive task list", () => {
    const block = between("function TodayActionCard", "function TodayDecisionCard");
    expect(block).toContain("{item.title}");
    expect(block).toContain("onOpen(item.workFileId, item.id)");
    expect(block).not.toContain("item.projectName");
    expect(block).not.toContain("item.workFileTitle");
    expect(block).not.toContain("item.attentionAt");
    expect(block).not.toContain("PriorityBadge");
    expect(block).not.toContain("OwnerChip");
  });

  it("shows only work-file titles before opening a file", () => {
    const block = between("function WorkFileCard", "function FocusedActionView");
    expect(block).toContain("{file.title}");
    expect(block).not.toContain("file.nextActionTitle");
    expect(block).not.toContain("file.openActionCount");
    expect(block).not.toContain("file.projectName");
  });

  it("opens one action alone and hides every competing action until back", () => {
    expect(source).toContain("const [selectedActionId, setSelectedActionId]");
    expect(source).toContain('url.searchParams.set("actionId", String(actionId))');
    expect(source).toContain("{focusedAction ? <FocusedActionView");
    expect(source).toContain("العودة إلى عناوين الإجراءات");
    expect(source).toContain("onClick={() => onActionChange(action.id)}");
    expect(source).toContain('className="w-screen max-w-none overflow-y-auto');
  });
});
