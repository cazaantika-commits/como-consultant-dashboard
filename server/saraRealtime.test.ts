import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSaraRealtimeInstructions,
  buildSaraRealtimeSession,
  createSaraRealtimeClientSecret,
  lookupExecutiveWorkspace,
  saraRealtimeTools,
  SARA_REALTIME_MODEL,
  SARA_REALTIME_VOICE,
} from "./services/saraRealtime";

const abdulrahman = { memberId: "abdulrahman", nameAr: "عبدالرحمن", role: "admin" };
const wael = { memberId: "wael", nameAr: "وائل", role: "executive" };
const roomSource = readFileSync("client/src/components/SaraRealtimeRoom.tsx", "utf8");
const avatarSource = readFileSync("client/src/components/SaraLiveAvatarView.tsx", "utf8");
const routerSource = readFileSync("server/routers/saraRealtime.ts", "utf8");
const rootRouterSource = readFileSync("server/routers.ts", "utf8");

const originalFetch = globalThis.fetch;
afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("Sara Realtime architecture", () => {
  it("keeps Sara as the interface and Manus as the executive brain", () => {
    const instructions = buildSaraRealtimeInstructions(abdulrahman);
    expect(instructions).toContain("أنتِ سارة");
    expect(instructions).toContain("Manus هو العقل التنفيذي");
    expect(instructions).toContain("لا ترسلي بريدًا أو واتساب أو تيليغرام");
    expect(instructions).toContain("القرار ليس تنفيذًا، والمسودة ليست إرسالًا");
  });

  it("uses the approved Realtime model, Arabic transcription, semantic interruption, and audio output", () => {
    const session = buildSaraRealtimeSession(abdulrahman);
    expect(session.model).toBe(SARA_REALTIME_MODEL);
    expect(session.audio.output.voice).toBe(SARA_REALTIME_VOICE);
    expect(session.output_modalities).toEqual(["audio"]);
    expect(session.audio.input.transcription.language).toBe("ar");
    expect(session.audio.input.turn_detection).toMatchObject({ type: "semantic_vad", interrupt_response: true });
  });

  it("exposes read-only lookup tools and no send, approve, or execute function", () => {
    expect(saraRealtimeTools.map(tool => tool.name)).toEqual(["lookup_command_center", "lookup_executive_workspace"]);
    const names = saraRealtimeTools.map(tool => tool.name).join(" ");
    expect(names).not.toMatch(/send|approve|execute|create|update|delete/i);
  });

  it("creates a short-lived client secret on the server without exposing the API key", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.session.model).toBe(SARA_REALTIME_MODEL);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer server-secret");
      return new Response(JSON.stringify({ value: "ek_test", expires_at: 123, session: { id: "sess_1", model: SARA_REALTIME_MODEL } }), { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(createSaraRealtimeClientSecret("  server-secret\n", abdulrahman)).resolves.toEqual({
      clientSecret: "ek_test",
      expiresAt: 123,
      sessionId: "sess_1",
      model: SARA_REALTIME_MODEL,
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/realtime/client_secrets", expect.any(Object));
  });

  it("keeps COMO Next private to Abdulrahman in the voice tool", async () => {
    await expect(lookupExecutiveWorkspace(wael, JSON.stringify({ category: "overview" }))).resolves.toEqual({
      found: false,
      reason: "مكتب COMO Next التنفيذي خاص بعبدالرحمن.",
    });
  });

  it("connects the browser through ephemeral WebRTC and starts LiveAvatar only from an explicit control", () => {
    expect(roomSource).toContain('https://api.openai.com/v1/realtime/calls');
    expect(roomSource).toContain('Authorization: `Bearer ${session.clientSecret}`');
    expect(roomSource).not.toContain("OPENAI_API_KEY");
    expect(roomSource).toContain("ابدأ الحديث مع سارة");
    expect(roomSource).toContain("تشغيل الصورة الحية");
    expect(roomSource).toContain('peer.addTransceiver("audio", { direction: "recvonly" })');
    expect(roomSource).toContain("فتحت سارة وضع الكتابة مع بقاء الرد الصوتي");
    expect(roomSource).toContain("لا إرسال خارجي · لا تنفيذ تلقائي");
    expect(avatarSource).toContain("session.repeatAudio");
    expect(avatarSource).toContain("event.currentTarget.muted = true");
  });

  it("registers the authenticated Sara router and reuses the existing Command Center access token", () => {
    expect(rootRouterSource).toContain("saraRealtime: saraRealtimeRouter");
    expect(routerSource).toContain("await verifyToken(input.token)");
    expect(routerSource).toContain("externalActionsEnabled: false");
    expect(routerSource).toContain("manusDelegationConfigured: false");
    expect(routerSource).toContain("process.env.COMO_OPENAI_REALTIME_API_KEY || process.env.OPENAI_API_KEY");
  });
});
