import { describe, it, expect } from "vitest";
import { DEFAULT_STAGES } from "./stages";

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
