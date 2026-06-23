import { describe, it, expect } from "vitest";
import { DEFAULT_STAGES, SECTION_AGENT_MAP } from "./stages";

// Inline helper functions for testing (mirrors frontend logic)
function parseDueDate(d: Date | string | null): Date | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? null : date;
}

function getDueDateStatus(dueDate: Date | null, status: string): "overdue" | "due_soon" | "on_track" | "none" {
  if (!dueDate || status === "completed") return "none";
  const now = new Date();
  if (dueDate < now) return "overdue";
  const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);
  if (dueDate <= threeDaysFromNow) return "due_soon";
  return "on_track";
}

describe("Development Stages - DEFAULT_STAGES data", () => {
  it("should have exactly 5 phases (2-6)", () => {
    const phaseNumbers = Object.keys(DEFAULT_STAGES).map(Number);
    expect(phaseNumbers).toEqual([2, 3, 4, 5, 6]);
    expect(phaseNumbers.length).toBe(5);
  });

  it("should have 18 sections total", () => {
    let sectionCount = 0;
    for (const phase of Object.values(DEFAULT_STAGES)) {
      sectionCount += Object.keys(phase.sections).length;
    }
    expect(sectionCount).toBe(18);
  });

  it("should have 97 tasks total", () => {
    let taskCount = 0;
    for (const phase of Object.values(DEFAULT_STAGES)) {
      for (const section of Object.values(phase.sections)) {
        taskCount += section.items.length;
      }
    }
    expect(taskCount).toBe(97);
  });

  it("Phase 2 (Legal Setup) should have 4 sections and 24 tasks", () => {
    const phase = DEFAULT_STAGES[2];
    expect(Object.keys(phase.sections).length).toBe(4);
    let taskCount = 0;
    for (const section of Object.values(phase.sections)) {
      taskCount += section.items.length;
    }
    expect(taskCount).toBe(24);
  });

  it("Phase 3 (Design & Permits) should have 4 sections and 23 tasks", () => {
    const phase = DEFAULT_STAGES[3];
    expect(Object.keys(phase.sections).length).toBe(4);
    let taskCount = 0;
    for (const section of Object.values(phase.sections)) {
      taskCount += section.items.length;
    }
    expect(taskCount).toBe(23);
  });

  it("Phase 4 (Financing & Marketing) should have 3 sections and 15 tasks", () => {
    const phase = DEFAULT_STAGES[4];
    expect(Object.keys(phase.sections).length).toBe(3);
    let taskCount = 0;
    for (const section of Object.values(phase.sections)) {
      taskCount += section.items.length;
    }
    expect(taskCount).toBe(15);
  });

  it("Phase 5 (Construction) should have 4 sections and 21 tasks", () => {
    const phase = DEFAULT_STAGES[5];
    expect(Object.keys(phase.sections).length).toBe(4);
    let taskCount = 0;
    for (const section of Object.values(phase.sections)) {
      taskCount += section.items.length;
    }
    expect(taskCount).toBe(21);
  });

  it("Phase 6 (Handover & After-sales) should have 3 sections and 14 tasks", () => {
    const phase = DEFAULT_STAGES[6];
    expect(Object.keys(phase.sections).length).toBe(3);
    let taskCount = 0;
    for (const section of Object.values(phase.sections)) {
      taskCount += section.items.length;
    }
    expect(taskCount).toBe(14);
  });

  it("all section keys should match their phase number", () => {
    for (const [phaseNum, phase] of Object.entries(DEFAULT_STAGES)) {
      for (const sectionKey of Object.keys(phase.sections)) {
        expect(sectionKey.startsWith(phaseNum + ".")).toBe(true);
      }
    }
  });

  it("all phases should have both Arabic and English titles", () => {
    for (const phase of Object.values(DEFAULT_STAGES)) {
      expect(phase.title).toBeTruthy();
      expect(phase.titleEn).toBeTruthy();
      for (const section of Object.values(phase.sections)) {
        expect(section.title).toBeTruthy();
        expect(section.titleEn).toBeTruthy();
      }
    }
  });

  it("all task titles should be non-empty strings", () => {
    for (const phase of Object.values(DEFAULT_STAGES)) {
      for (const section of Object.values(phase.sections)) {
        for (const item of section.items) {
          expect(typeof item).toBe("string");
          expect(item.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("section keys should be sequential within each phase", () => {
    for (const [phaseNum, phase] of Object.entries(DEFAULT_STAGES)) {
      const sectionKeys = Object.keys(phase.sections);
      sectionKeys.forEach((key, idx) => {
        expect(key).toBe(`${phaseNum}.${idx + 1}`);
      });
    }
  });
});

describe("Development Stages - Agent Integration", () => {
  it("SECTION_AGENT_MAP should cover all 18 sections", () => {
    const allSectionKeys: string[] = [];
    for (const phase of Object.values(DEFAULT_STAGES)) {
      for (const sectionKey of Object.keys(phase.sections)) {
        allSectionKeys.push(sectionKey);
      }
    }
    expect(allSectionKeys.length).toBe(18);
    for (const key of allSectionKeys) {
      expect(SECTION_AGENT_MAP[key]).toBeDefined();
      expect(SECTION_AGENT_MAP[key].primary).toBeTruthy();
    }
  });

  it("every agent mapping should have a primary agent", () => {
    for (const [key, mapping] of Object.entries(SECTION_AGENT_MAP)) {
      expect(mapping.primary).toBeTruthy();
      expect(typeof mapping.primary).toBe("string");
      if (mapping.secondary) {
        expect(typeof mapping.secondary).toBe("string");
      }
    }
  });

  it("every agent mapping should have a category", () => {
    for (const [key, mapping] of Object.entries(SECTION_AGENT_MAP)) {
      expect(mapping.category).toBeTruthy();
      expect(typeof mapping.category).toBe("string");
    }
  });

  it("Phase 2 sections should be assigned to فاروق (legal)", () => {
    expect(SECTION_AGENT_MAP["2.1"].primary).toBe("فاروق");
    expect(SECTION_AGENT_MAP["2.2"].primary).toBe("فاروق");
    expect(SECTION_AGENT_MAP["2.3"].primary).toBe("فاروق");
    expect(SECTION_AGENT_MAP["2.4"].primary).toBe("فاروق");
  });

  it("Phase 5 sections should be assigned to براق (construction)", () => {
    expect(SECTION_AGENT_MAP["5.1"].primary).toBe("براق");
    expect(SECTION_AGENT_MAP["5.2"].primary).toBe("براق");
    expect(SECTION_AGENT_MAP["5.3"].primary).toBe("براق");
  });

  it("Phase 6.3 (after-sales) should be assigned to سلوى", () => {
    expect(SECTION_AGENT_MAP["6.3"].primary).toBe("سلوى");
  });

  it("some sections should have secondary agents", () => {
    // 2.4: Insurance should have خالد as secondary
    expect(SECTION_AGENT_MAP["2.4"].secondary).toBe("خالد");
    // 4.1: Financing should have جويل as secondary
    expect(SECTION_AGENT_MAP["4.1"].secondary).toBe("جويل");
    // 5.2: Structural should have خالد as secondary
    expect(SECTION_AGENT_MAP["5.2"].secondary).toBe("خالد");
  });

  it("no section key in SECTION_AGENT_MAP should be outside DEFAULT_STAGES", () => {
    const allSectionKeys = new Set<string>();
    for (const phase of Object.values(DEFAULT_STAGES)) {
      for (const sectionKey of Object.keys(phase.sections)) {
        allSectionKeys.add(sectionKey);
      }
    }
    for (const key of Object.keys(SECTION_AGENT_MAP)) {
      expect(allSectionKeys.has(key)).toBe(true);
    }
  });
});

describe("Development Stages - Due Date Helpers", () => {
  it("getDueDateStatus returns 'overdue' for past dates on non-completed items", () => {
    const pastDate = new Date(Date.now() - 86400000); // yesterday
    expect(getDueDateStatus(pastDate, "in_progress")).toBe("overdue");
    expect(getDueDateStatus(pastDate, "not_started")).toBe("overdue");
  });

  it("getDueDateStatus returns 'none' for completed items regardless of date", () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(getDueDateStatus(pastDate, "completed")).toBe("none");
  });

  it("getDueDateStatus returns 'none' when no due date", () => {
    expect(getDueDateStatus(null, "in_progress")).toBe("none");
    expect(getDueDateStatus(null, "not_started")).toBe("none");
  });

  it("getDueDateStatus returns 'on_track' for future dates beyond 3 days", () => {
    const futureDate = new Date(Date.now() + 10 * 86400000); // 10 days from now
    expect(getDueDateStatus(futureDate, "in_progress")).toBe("on_track");
  });

  it("getDueDateStatus returns 'due_soon' for dates within 3 days", () => {
    const soonDate = new Date(Date.now() + 2 * 86400000); // 2 days from now
    expect(getDueDateStatus(soonDate, "in_progress")).toBe("due_soon");
  });

  it("parseDueDate handles null correctly", () => {
    expect(parseDueDate(null)).toBeNull();
  });

  it("parseDueDate handles valid ISO string", () => {
    const isoStr = "2026-06-15T00:00:00.000Z";
    const result = parseDueDate(isoStr);
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe(isoStr);
  });

  it("parseDueDate handles Date objects", () => {
    const date = new Date("2026-06-15");
    const result = parseDueDate(date);
    expect(result).toBeInstanceOf(Date);
  });

  it("parseDueDate returns null for invalid strings", () => {
    expect(parseDueDate("not-a-date")).toBeNull();
  });
});
