export const SALWA_LIVE_AVATAR_ID = "26393b8e-e944-4367-98ef-e2bc75c4b792"; // Katya preset, used only after explicit verification
export const LAYLA_LIVE_AVATAR_ID = SALWA_LIVE_AVATAR_ID;
export const LIVEAVATAR_EMBED_URL = "https://api.liveavatar.com/v2/embeddings";
export const LIVEAVATAR_SESSION_URL = "https://api.liveavatar.com/v1/sessions";
export const LAYLA_LIVE_CONTEXT_ID = "49f5d2d7-1f7e-4f76-a0fe-c58d64ab24ca";

export type LiveAvatarEmbedOptions = {
  isSandbox: boolean;
};

export type LiveAvatarLiteSession = {
  mode: "LITE";
  avatarId: string;
  isSandbox: boolean;
  sessionToken: string;
  sessionId: string;
  livekitUrl: string;
  livekitClientToken: string;
  websocketUrl: string | null;
};

export function buildLaylaLiveAvatarEmbedRequest({ isSandbox }: LiveAvatarEmbedOptions) {
  return {
    avatar_id: LAYLA_LIVE_AVATAR_ID,
    context_id: LAYLA_LIVE_CONTEXT_ID,
    type: "DEFAULT" as const,
    default_language: "ar",
    max_session_duration: 180,
    is_sandbox: isSandbox,
    orientation: "horizontal" as const,
  };
}

export async function createLaylaLiveAvatarEmbed(apiKey: string, options: LiveAvatarEmbedOptions) {
  if (!apiKey) throw new Error("LiveAvatar API key is missing");

  const response = await fetch(LIVEAVATAR_EMBED_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildLaylaLiveAvatarEmbedRequest(options)),
  });

  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || !payload?.data?.url) {
    const reason = payload?.message || payload?.detail || `HTTP ${response.status}`;
    throw new Error(`LiveAvatar embed creation failed: ${reason}`);
  }

  return {
    url: String(payload.data.url),
    embedId: payload.data.embed_id ? String(payload.data.embed_id) : null,
  };
}

export function buildSalwaLiveAvatarLiteTokenRequest({ isSandbox, avatarId = SALWA_LIVE_AVATAR_ID }: { isSandbox: boolean; avatarId?: string }) {
  return {
    mode: "LITE" as const,
    avatar_id: avatarId,
    is_sandbox: isSandbox,
    max_session_duration: 180,
    video_settings: { quality: "high" as const, encoding: "H264" as const },
  };
}

function liveAvatarError(payload: any, status: number) {
  return payload?.message || payload?.detail || payload?.error || `HTTP ${status}`;
}

/**
 * Creates a modern Avatar-Only/LITE session token and starts its LiveKit room.
 * No session is opened until the caller explicitly invokes this function.
 */
export async function createSalwaLiveAvatarLiteSession(
  apiKey: string,
  options: { isSandbox: boolean; avatarId?: string },
): Promise<LiveAvatarLiteSession> {
  if (!apiKey) throw new Error("LiveAvatar API key is missing");

  const avatarId = options.avatarId || SALWA_LIVE_AVATAR_ID;
  const tokenResponse = await fetch(`${LIVEAVATAR_SESSION_URL}/token`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildSalwaLiveAvatarLiteTokenRequest(options)),
  });
  const tokenPayload = await tokenResponse.json().catch(() => null) as any;
  if (!tokenResponse.ok || !tokenPayload?.data?.session_token) {
    throw new Error(`LiveAvatar LITE token creation failed: ${liveAvatarError(tokenPayload, tokenResponse.status)}`);
  }

  const sessionToken = String(tokenPayload.data.session_token);
  const startResponse = await fetch(`${LIVEAVATAR_SESSION_URL}/start`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
  });
  const startPayload = await startResponse.json().catch(() => null) as any;
  const data = startPayload?.data;
  if (!startResponse.ok || !data?.session_id || !data?.livekit_url || !data?.livekit_client_token) {
    throw new Error(`LiveAvatar LITE session start failed: ${liveAvatarError(startPayload, startResponse.status)}`);
  }

  return {
    mode: "LITE",
    avatarId,
    isSandbox: options.isSandbox,
    sessionToken,
    sessionId: String(data.session_id),
    livekitUrl: String(data.livekit_url),
    livekitClientToken: String(data.livekit_client_token),
    websocketUrl: data.ws_url ? String(data.ws_url) : null,
  };
}
