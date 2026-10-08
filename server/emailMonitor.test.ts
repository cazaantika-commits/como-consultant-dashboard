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

  it("recognizes an authenticated reply in an existing conversation, not mere missing headers", () => {
    const reply = {
      from: "Mia Aranas <pa@zooma.ae>",
      "in-reply-to": "<owner-message@comodevelopments.com>",
      "authentication-results": "relay.example; dkim=pass header.d=zooma.ae header.s=google; dmarc=pass header.from=zooma.ae",
    };
    expect(classifyReadonlyAutomationHeaders(reply)).toBe("known_non_system");
    expect(classifyReadonlyAutomationHeaders({ ...reply, "authentication-results": "relay.example; dkim=pass header.d=notzooma.ae" })).toBe("unknown");
    expect(classifyReadonlyAutomationHeaders({ ...reply, "in-reply-to": "" })).toBe("unknown");
    expect(classifyReadonlyAutomationHeaders({ ...reply, "auto-submitted": "auto-replied" })).toBe("unknown");
    expect(classifyReadonlyAutomationHeaders({ ...reply, from: "No Reply <no-reply@zooma.ae>" })).toBe("unknown");
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
