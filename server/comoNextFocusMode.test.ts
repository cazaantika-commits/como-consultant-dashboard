import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const projectSource = readFileSync("client/src/pages/ComoNextProjectPage.tsx", "utf8");
const proposalsSource = readFileSync("client/src/components/ComoNextIntakeProposals.tsx", "utf8");

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
    expect(source).toContain("const [selectedFocusKind, setSelectedFocusKind]");
    expect(source).toContain('url.searchParams.set("focusKind", focusKind)');
    expect(source).toContain('url.searchParams.set("focusId", String(focusId))');
    expect(source).toContain("{focusedAction ? <FocusedActionView");
    expect(source).toContain("العودة إلى عناوين الإجراءات");
    expect(source).toContain("onClick={() => onActionChange(action.id)}");
    expect(source).toContain("!w-screen !max-w-none overflow-x-hidden overflow-y-auto");
  });

  it("opens one executive category before any item and supports focused decisions, communications, and meetings", () => {
    expect(source).toContain("const [selectedSection, setSelectedSection]");
    expect(source).toContain("!selectedSection ? <section>");
    expect(source).toContain('selectedSection === "actions"');
    expect(source).toContain('selectedSection === "decisions"');
    expect(source).toContain('selectedSection === "communications"');
    expect(source).toContain('selectedSection === "meetings"');
    expect(source).toContain('<FocusedRecordView kind="decision"');
    expect(source).toContain('<FocusedRecordView kind="communication"');
    expect(source).toContain('<FocusedRecordView kind="meeting"');
  });

  it("opens the exact review proposal from the kitchen without exposing the unrelated proposal list", () => {
    expect(source).toContain('if (item.kind === "proposal") return openProposal(item.recordId)');
    expect(source).toContain('url.searchParams.set("focusKind", "proposal")');
    expect(source).toContain('selectedProposalId={selectedFocusKind === "proposal" ? selectedFocusId : null}');
    expect(proposalsSource).toContain("selectedProposalId?: number | null");
    expect(proposalsSource).toContain("proposals.find(proposal => proposal.id === selectedProposalId)");
    expect(proposalsSource).toContain("if (selected) return <ProposalDialog proposal={selected} open");
  });

  it("keeps the unified project file category-first and opens one memory or source at a time", () => {
    expect(projectSource).toContain("const [selectedProjectSection, setSelectedProjectSection]");
    expect(projectSource).toContain("const [selectedProjectItem, setSelectedProjectItem]");
    expect(projectSource).toContain("محتوى المشروع");
    expect(projectSource).toContain('selectedProjectSection === "memory"');
    expect(projectSource).toContain('setSelectedProjectItem(`memory:${entry.id}`)');
    expect(projectSource).toContain("عناوين الذاكرة");
    expect(projectSource).toContain('selectedProjectItem === "source:contracts"');
    expect(projectSource).toContain("عناوين المصادر");
  });
});
