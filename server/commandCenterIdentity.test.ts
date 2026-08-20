import { describe, expect, it } from "vitest";
import { getCommandCenterTokenKey, getPersonaLoginHint, resolveCommandCenterPersona } from "../client/src/lib/commandCenterIdentity";

describe("Command Center member identity", () => {
  it("recognizes Wael and Sheikh Issa from authenticated user identities", () => {
    expect(resolveCommandCenterPersona({ name: "وائل" })).toBe("wael");
    expect(resolveCommandCenterPersona({ email: "sheikh.issa@como.ae" })).toBe("sheikh_issa");
    expect(resolveCommandCenterPersona({ name: "Abdulrahman Zaqout" })).toBe("abdulrahman");
  });

  it("keeps each recognized member’s access token in a separate browser scope", () => {
    expect(getCommandCenterTokenKey("wael")).toBe("cc_token_wael");
    expect(getCommandCenterTokenKey("sheikh_issa")).toBe("cc_token_sheikh_issa");
    expect(getCommandCenterTokenKey("abdulrahman")).toBe("cc_token_abdulrahman");
  });

  it("provides a respectful person-specific login hint", () => {
    expect(getPersonaLoginHint("wael")).toContain("وائل");
    expect(getPersonaLoginHint("sheikh_issa")).toContain("شيخ عيسى");
  });
});
