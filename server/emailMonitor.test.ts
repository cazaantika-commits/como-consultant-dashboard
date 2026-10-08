import { describe, expect, it } from "vitest";
import { classifyReadonlyAutomationHeaders } from "./emailMonitor";

describe("classifyReadonlyAutomationHeaders", () => {
  it("classifies explicit human-delivery metadata as known_non_system", () => {
    expect(
      classifyReadonlyAutomationHeaders({
        "auto-submitted": "No",
        from: "Consultant <consultant@example.com>",
        "return-path": "<consultant@example.com>",
      })
    ).toBe("known_non_system");

    expect(
      classifyReadonlyAutomationHeaders({
        precedence: "personal",
      })
    ).toBe("known_non_system");
  });

  it("classifies explicit automation and mailing-list signals as known_system", () => {
    expect(
      classifyReadonlyAutomationHeaders({
        "auto-submitted": "auto-replied",
      })
    ).toBe("known_system");
    expect(
      classifyReadonlyAutomationHeaders({
        precedence: "bulk",
      })
    ).toBe("known_system");
    expect(
      classifyReadonlyAutomationHeaders({
        "list-id": "Project notices <project-notices.example.com>",
      })
    ).toBe("known_system");
    expect(
      classifyReadonlyAutomationHeaders({
        "x-auto-response-suppress": "All",
      })
    ).toBe("known_system");
    expect(
      classifyReadonlyAutomationHeaders({
        from: "Build bot <no-reply@ci.example.com>",
      })
    ).toBe("known_system");
    expect(
      classifyReadonlyAutomationHeaders({
        "return-path": "<mailer-daemon@example.com>",
      })
    ).toBe("known_system");
  });

  it("accepts repeated header values when any value is a system signal", () => {
    expect(
      classifyReadonlyAutomationHeaders({
        "auto-submitted": ["No", "auto-generated"],
      })
    ).toBe("unknown");

    expect(
      classifyReadonlyAutomationHeaders({
        precedence: ["personal", "bulk"],
      })
    ).toBe("unknown");
  });

  it("returns unknown when headers are absent, inconclusive, or contradictory", () => {
    expect(
      classifyReadonlyAutomationHeaders({
        from: "Consultant <consultant@example.com>",
        "return-path": "<consultant@example.com>",
      })
    ).toBe("unknown");
    expect(
      classifyReadonlyAutomationHeaders({
        "auto-submitted": "",
        precedence: "first-class",
      })
    ).toBe("unknown");
    expect(
      classifyReadonlyAutomationHeaders({
        "auto-submitted": "No",
        "list-id": "Announcements <announcements.example.com>",
      })
    ).toBe("unknown");
  });
});
