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
const pageSource = readFileSync("client/src/pages/SaraPage.tsx", "utf8");
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
    expect(instructions).toContain("Speak in natural Lebanese Arabic");
    expect(instructions).toContain("soft, warm feminine delivery");
    expect(instructions).toContain("playfully flattering");
    expect(instructions).toContain("occasional natural chuckle");
    expect(instructions).toContain("لا تلقي نشرة طويلة كقطار");
    expect(instructions).toContain("لا تمزحي في مبلغ مالي");
  });

  it("uses the approved Realtime model, Arabic transcription, semantic interruption, and audio output", () => {
    const session = buildSaraRealtimeSession(abdulrahman);
    expect(session.model).toBe(SARA_REALTIME_MODEL);
    expect(session.audio.output.voice).toBe(SARA_REALTIME_VOICE);
    expect(session.output_modalities).toEqual(["audio"]);
    expect(session.audio.input.transcription.language).toBe("ar");
    expect(session.audio.input.turn_detection).toMatchObject({ type: "semantic_vad", interrupt_response: true });
  });

  it("exposes read-only lookups plus proposal-only capture and no send, approve, or execute function", () => {
    expect(saraRealtimeTools.map(tool => tool.name)).toEqual(["lookup_command_center", "lookup_executive_workspace", "capture_intake_proposal"]);
    const names = saraRealtimeTools.map(tool => tool.name).join(" ");
    expect(names).not.toMatch(/send|approve|execute|create|update|delete/i);
    expect(saraRealtimeTools[2].description).toContain("لا تنشئ إجراءً أو قرارًا أو مراسلة تشغيلية");
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

  it("connects through ephemeral WebRTC and auto-starts the streamlined Sara page", () => {
    expect(roomSource).toContain('https://api.openai.com/v1/realtime/calls');
    expect(roomSource).toContain('Authorization: `Bearer ${session.clientSecret}`');
    expect(roomSource).not.toContain("OPENAI_API_KEY");
    expect(pageSource).toContain("autoStart");
    expect(pageSource).toContain("streamlined");
    expect(roomSource).toContain("if (status.data.liveAvatarConfigured) await startAvatar(true)");
    expect(roomSource).toContain("if (status.data.realtimeConfigured) await startSession()");
    expect(roomSource).toContain("grid-rows-[42%_58%]");
    expect(roomSource).toContain("h-[100dvh]");
    expect(roomSource).toContain("transcriptScrollRef");
    expect(roomSource).toContain('panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" })');
    expect(roomSource).not.toContain('"pt-[76px] sm:pt-20"');
    expect(roomSource).not.toContain("relative hidden min-h-0");
    expect(roomSource).toContain('peer.addTransceiver("audio", { direction: "recvonly" })');
    expect(roomSource).toContain("فتحت سارة وضع الكتابة مع بقاء الرد الصوتي");
    expect(roomSource).toContain("المس الشاشة مرة واحدة لسماع سارة");
    expect(avatarSource).toContain("createLiveAvatarPcmStream");
    expect(roomSource).toContain('case "response.created"');
    expect(roomSource).toContain("float32ToPcmBase64");
    expect(roomSource).toContain("createScriptProcessor");
    expect(roomSource).toContain("avatarCommitTimerRef");
    expect(avatarSource).toContain("video.muted = !playAudio");
    expect(roomSource).toContain("avatarOwnsPlayback");
    expect(roomSource).toContain("handleAvatarAudioRouteFailure");
    expect(avatarSource).toContain("object-[center_25%]");
    expect(avatarSource).toContain('<img\n        src={portrait}');
    expect(roomSource).not.toContain('@/assets/como/sara-idle.webm');
    expect(pageSource).not.toContain('@/assets/como/sara-idle.webm');
    expect(pageSource).toContain('<img src={saraPortrait}');
    expect(pageSource).toContain('@/assets/como/sara.webp');
    expect(roomSource).toContain("الموجز الشامل");
    expect(roomSource).toContain("أعمال اليوم");
    expect(roomSource).toContain("ما الجديد؟");
    expect(roomSource).toContain('playBriefing("auto")');
    expect(roomSource).toContain('type: "response.cancel"');
    expect(roomSource).toContain("completeBriefing.mutate");
    expect(roomSource).not.toContain("أهم ثلاث أولويات حالية فقط");
  });

  it("gives Sara a direct persona-scoped login page without routing through the legacy dashboard", () => {
    expect(pageSource).toContain("getCommandCenterTokenKey");
    expect(pageSource).toContain("commandCenter.verifyAccess.useQuery");
    expect(pageSource).toContain("التحقق وفتح سارة");
    expect(pageSource).toContain("بعد التحقق تفتح سارة مباشرة");
    expect(pageSource).not.toContain('navigate("/command-center")');
  });

  it("registers the authenticated Sara router and reuses the existing Command Center access token", () => {
    expect(rootRouterSource).toContain("saraRealtime: saraRealtimeRouter");
    expect(routerSource).toContain("await verifyToken(input.token)");
    expect(routerSource).toContain("externalActionsEnabled: false");
    expect(routerSource).toContain("manusDelegationConfigured: false");
    expect(routerSource).toContain("process.env.COMO_OPENAI_REALTIME_API_KEY || process.env.OPENAI_API_KEY");
  });
});
