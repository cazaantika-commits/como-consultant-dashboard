import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("client/src/pages/ComoNextTodayPage.tsx", "utf8");
const projectSource = readFileSync("client/src/pages/ComoNextProjectPage.tsx", "utf8");
const proposalsSource = readFileSync("client/src/components/ComoNextIntakeProposals.tsx", "utf8");
const projectDossierSource = readFileSync("server/services/comoNextProjectDossier.ts", "utf8");
const meetingSource = readFileSync("client/src/components/ComoNextMeetingWorkspace.tsx", "utf8");

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
    expect(proposalsSource).toContain("proposals.find(item => item.id === selectedProposalId)");
    expect(proposalsSource).toContain("if (selectedProposal) return <ProposalFocusScreen");
  });

  it("presents one work-file stage at a time instead of stacking every record type", () => {
    expect(source).toContain('type WorkFileStage = "now" | "evidence" | "outputs" | "decisions" | "execution" | "history"');
    expect(source).toContain('const [selectedStage, setSelectedStage] = useState<WorkFileStage>("now")');
    expect(source).toContain('selectedStage === "evidence"');
    expect(source).toContain('selectedStage === "outputs"');
    expect(source).toContain('selectedStage === "execution"');
    expect(source).toContain('selectedStage === "history"');
    expect(source).toContain("مصادر الموضوع");
    expect(source).toContain("التحليل والمخرجات");
    expect(source).toContain("السجل الزمني");
  });

  it("separates proposal evidence, Manus interpretation, and downstream effect before editing", () => {
    expect(proposalsSource).toContain("1. ما الذي وصل؟");
    expect(proposalsSource).toContain("2. قراءة Manus");
    expect(proposalsSource).toContain("3. ماذا سيحدث إذا اعتمدته؟");
    expect(proposalsSource).toContain("هذه قراءة مقترحة مفصولة عن الدليل");
    expect(proposalsSource).toContain("مناقشة أو تعديل المقترح");
    expect(proposalsSource).toContain("{editOpen ? <section");
    expect(proposalsSource.indexOf("1. ما الذي وصل؟")).toBeLessThan(proposalsSource.indexOf("<Label>العنوان</Label>"));
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

  it("derives a company dossier from the project party instead of showing a shallow card", () => {
    expect(projectSource).toContain("ملف طرف داخل المشروع");
    expect(projectSource).toContain("selectedParty.contacts?.length");
    expect(projectSource).toContain("selectedParty.workFiles?.length");
    expect(projectSource).toContain("selectedParty.communications?.length");
    expect(projectSource).toContain("selectedParty.meetings?.length");
    expect(projectSource).toContain("ملفات الموضوع المرتبطة");
    expect(projectDossierSource).toContain("FROM como_next_work_file_parties link");
    expect(projectDossierSource).toContain("FROM como_next_party_contacts contact");
    expect(projectDossierSource).toContain("relatedWorkFileIds.has(item.workFileId)");
  });

  it("keeps historical meeting JSON in the record without rendering it in the work surface", () => {
    expect(meetingSource).toContain("meetingSourcePreview(source.rawText)");
    expect(meetingSource).toContain("اللقطة التقنية الأصلية محفوظة في السجل ولا تُعرض داخل واجهة العمل");
    expect(meetingSource).not.toContain('>{source.rawText}</p>');
  });
});
