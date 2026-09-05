export const LAYLA_LIVE_AVATAR_ID = "26393b8e-e944-4367-98ef-e2bc75c4b792"; // Katya in Black Suit
export const LIVEAVATAR_EMBED_URL = "https://api.liveavatar.com/v2/embeddings";
export const LAYLA_LIVE_CONTEXT_ID = "49f5d2d7-1f7e-4f76-a0fe-c58d64ab24ca";

export type LiveAvatarEmbedOptions = {
  isSandbox: boolean;
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
