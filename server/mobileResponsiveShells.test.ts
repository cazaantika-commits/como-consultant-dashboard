import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const today = read("client/src/pages/ComoNextTodayPage.tsx");
const sara = read("client/src/pages/SaraPage.tsx");
const saraRoom = read("client/src/components/SaraRealtimeRoom.tsx");
const project = read("client/src/pages/ComoNextProjectPage.tsx");
const management = read("client/src/pages/ProjectManagementPage.tsx");
const knowledge = read("client/src/pages/KnowledgeHubPage.tsx");
const lifecycle = read("client/src/pages/ProjectLifecyclePage.tsx");
const email = read("client/src/components/ComoNextEmailInbox.tsx");
const intake = read("client/src/components/ComoNextIntakeProposals.tsx");

describe("mobile responsive shells", () => {
  it("keeps primary page roots inside the phone viewport", () => {
    for (const source of [today, sara, project, management, knowledge, lifecycle]) {
      expect(source).toContain("overflow-x-hidden");
      expect(source).toContain("max-w-full");
    }
  });

  it("opens focused work records across the full mobile viewport", () => {
    expect(today).toContain("!left-0 !right-0 !h-[100dvh] !w-screen !max-w-none");
    expect(today).toContain("min-h-[100dvh] min-w-0 max-w-full overflow-x-hidden");
  });

  it("keeps Sara visible above the conversation on a phone", () => {
    expect(saraRoom).toContain("grid-rows-[42%_58%]");
    expect(saraRoom).toContain("h-[100dvh]");
    expect(saraRoom).not.toContain("relative hidden min-h-0");
    expect(sara).toContain("flex min-w-0 flex-col items-stretch gap-4");
  });

  it("uses true full-screen mobile dialogs for email and intake review", () => {
    for (const source of [email, intake]) {
      expect(source).toContain("!left-0 !top-0 !h-[100dvh] !w-screen !max-w-none");
      expect(source).toContain("overflow-x-hidden overflow-y-auto");
    }
  });

  it("stacks lifecycle approval controls and wraps the knowledge selector", () => {
    expect(lifecycle).toContain("flex min-w-0 flex-col items-stretch gap-4");
    expect(lifecycle).toContain("grid w-full min-w-0 grid-cols-2 gap-2");
    expect(knowledge).toContain("order-3 h-9 w-full min-w-0");
  });
});
