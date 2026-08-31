import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { commandCenterMembers } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("Layla Command Center speech route", () => {
  it("returns a playable WAV through the same tRPC route used by the dashboard", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const [member] = await db!
      .select({ accessToken: commandCenterMembers.accessToken })
      .from(commandCenterMembers)
      .where(eq(commandCenterMembers.isActive, 1))
      .limit(1);
    expect(member?.accessToken).toBeTruthy();

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.commandCenter.generateLaylaSpeech({
      token: member.accessToken,
      text: "أهلاً عبدالرحمن، أنا ليلى. هذا ملخص قصير لأهم نقطتين في مركز القيادة.",
    });

    const wav = Buffer.from(result.audioBase64, "base64");
    expect(result.mimeType).toBe("audio/wav");
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.length).toBeGreaterThan(48_000);
    expect(JSON.stringify(result).length).toBeLessThan(4_000_000);

    await expect(caller.commandCenter.reportLaylaVoiceEvent({
      token: member.accessToken,
      stage: "play_started",
      detail: "route integration test",
    })).resolves.toEqual({ ok: true });
  }, 30_000);
});
