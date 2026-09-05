# HeyGen / LiveAvatar Integration Audit

Date: 2026-09-05

## Verified findings

- The project has a `HEYGEN_API_KEY` environment variable present in the sandbox, but the official HeyGen `GET https://api.heygen.com/v3/users/me` health check returned HTTP 401 with `Unauthorized`.
- The HeyGen and HeyGen API connectors are present in the session configuration but currently disabled.
- Current official LiveAvatar documentation describes two integration modes: FULL mode, where LiveAvatar manages ASR, LLM, TTS, and WebRTC; and LITE/avatar-only mode, where the application supplies its own AI stack and LiveAvatar manages real-time video.
- Official LiveAvatar docs describe a sandbox embedding path using `POST https://api.liveavatar.com/v2/embeddings`, requiring a LiveAvatar API key, avatar ID, and optionally a context ID. Sandbox mode is intended for testing without consuming credits.
- No avatar identity, image, or name has been selected for the replacement assistant yet.

## Blocker

The currently injected HeyGen API credential cannot be treated as valid for the required live integration because the official authentication check returned 401. The user must provide/update a valid HeyGen/LiveAvatar credential through the secure project-secret flow, or enable the appropriate HeyGen connector, before a real session can be tested.

## Safety

No API key, email address, account identifier, or response body containing personal data was saved in this file.

## Live test result

- A new LiveAvatar Sandbox embedding session was created successfully with HTTP 200 using the current project credential.
- The generated embed URL opened successfully in the browser.
- After starting the session, the live avatar video connected and displayed a female professional avatar with the chat input and session controls.
- This proves that the current credential can create and stream a LiveAvatar Sandbox session. It does not yet prove production billing entitlement, final avatar selection, Arabic voice selection, or integration into the COMO application UI.

## Capability evaluation findings

- The authenticated LiveAvatar language endpoint returned Arabic with code `ar` in the supported-language list.
- The authenticated public-voice query returned 67 voices, all tagged `en` in the current response: 38 male, 28 female, and 1 unknown. The private-voice query returned zero voices. Therefore Arabic language support is confirmed at the language layer, but an Arabic public/private voice was not present in the current account response and must be supplied through a compatible voice/TTS path or verified in the LiveAvatar dashboard.
- The current LiveAvatar credit endpoint returned `credits_left: 10.0`. This value is not a financial assumption for the project; it is only the service-account balance observed during the capability test.
- Official documentation states that FULL mode manages VAD, STT, LLM, TTS, and WebRTC; LITE mode lets the application manage STT/LLM/TTS while LiveAvatar renders video. Official quality settings are 720p default/high and 1080p/very_high, with higher quality increasing latency. Voice speed is configurable; documented shared speed range is 0.8–1.2.

## Account dashboard verification

- After the user signed in, the LiveAvatar dashboard showed `Free`, `10 / 10 credits left`, `Default Space Free`, `Custom Avatars (0)`, and `Preset Avatars (83)`.
- The dashboard exposed pages for Avatars, Voice Agents, Contexts, Voices, API Key, Usage, Plan & Billing, Members, and General.
- The account therefore has active LiveAvatar access for the observed free allocation and preset avatars, but no custom avatar has been created in the space. The final production coverage and plan limits should not be overstated beyond what the dashboard explicitly shows.

## Selected production embed test

- The production Embed API accepted the selected avatar `Katya in Black Suit` once the newly created Layla context was supplied, returning embed id `5df69092-7baa-4a95-9ead-92d75fbe35d1`.
- The embed opened successfully and rendered a professional-looking female avatar in a black suit; the first observed state after clicking Chat now was `Connecting...`.
- This test confirms the visual choice and Embed creation path. It does not yet prove Arabic voice quality or live COMO data integration.

- The selected production embed initially rendered the avatar, then failed during connection and displayed `Something went wrong. Please try again later.` while the language selector showed Arabic. Browser console output contained no diagnostic details. The current likely boundary is the production voice/context/session configuration, not the visual avatar rendering.

## Voice library verification

- The logged-in dashboard shows `Preset Voices (67)`, `Custom voices (0)`, and controls to manage or import a third-party voice.
- The visible preset list includes `Katya - IA`, `Amina - IA`, `Aida`, `Ann - IA`, `Judy - Professional`, and others, but the page does not expose language labels in the extracted UI. The API response previously identified the current public voice list as English-tagged, so an Arabic preset remains unconfirmed.
- The account dashboard still shows the Free plan with 10/10 credits and 83 preset avatars.

- A second production Embed with the same avatar/context but `default_language: en` was created successfully. The browser session did not provide a usable visual comparison because the page changed to an unavailable image state before interaction; no conclusion about English session quality is claimed.
- The Arabic production session visibly reached the avatar-rendering stage and exposed an Arabic language selector, then failed at session connection. The current implementation must therefore keep a graceful fallback and should not claim that Arabic LiveAvatar speech is production-ready until a compatible voice/session path is verified.

- The `multi` language Embed rendered the selected Katya-in-black-suit avatar and reached `Connecting...`, but remained there during the follow-up view. It was not marked as a successful live session. This confirms visual rendering is reliable while production conversational connection remains blocked or delayed by the account/voice/session configuration.

- A fresh Sandbox Embed using the same avatar/context and `default_language: ar` also rendered the avatar but remained at `Connecting...` after clicking Chat now. The issue is not limited to production credits; the current context/voice/session configuration still does not complete a live conversation in the browser test.

Official documentation findings saved 2026-09-05:
- Create Embed V2: https://docs.liveavatar.com/api-reference/embeddings/create-embed-v2.md. `context_id` and `voice_id` are optional alternatives, while `voice_agent_id` is mutually exclusive with them; `avatar_id` is required; `default_language` accepts codes such as `en`, `es`, and `multi`.
- Create Context: https://docs.liveavatar.com/api-reference/contexts/create-context.md. A context contains only name, prompt, opening_text, and optional links; it does not select a voice. The current Layla context exists and has no required dynamic variables or links.
- LITE mode: https://docs.liveavatar.com/docs/lite-mode/overview.md and https://docs.liveavatar.com/docs/lite-mode/lifecycle.md. LITE lets COMO own STT/LLM/TTS while LiveAvatar renders real-time video; it costs 1 credit/minute versus 2 credits/minute for FULL. It requires backend token/session start and a WebRTC room/agent path, so it is the technically appropriate long-term mode for financial answers but a larger integration than iframe FULL mode.

Voice catalog check 2026-09-05: `/v1/voices?voice_type=public&page_size=100` returned 67 public voices, all with `language: en`; 28 are female. No public Arabic voice was returned for this account. A suitable visual avatar can still be selected independently, but Arabic speech requires a custom/compatible voice path or COMO-owned Arabic TTS with LITE mode; FULL mode with the current public voice catalog cannot be declared Arabic-ready.

Visual account-library check 2026-09-05: the logged-in LiveAvatar workspace shows 83 preset avatars and 0 custom avatars, with visual previews and role variants such as Ann Therapist/Doctor, Judy Lawyer/HR/Teacher, Katya Sitting/Black Suit/Pink Suit, and others. The current account has 8/10 credits left after the latest session attempts. The prior rejected image was not selected from the visual library intentionally; it was a temporary API/image choice. A final avatar must be selected from the visual library and tested as a moving session before updating COMO again.
Source page inspected: https://app.liveavatar.com/home

Candidate visual review: Amina in Black Suit is a realistic, polished, confident female presenter with curly dark hair and blue shirt; Marianne in Black Suit is a realistic, polished female presenter with dark hair and black suit, but her preview expression reads more like a close-up portrait. Both are visually more professional than the rejected placeholder image. No candidate has been installed in COMO.

Chosen preset test 2026-09-05: selected public preset `Katya in Black Suit` (avatar id `26393b8e-e944-4367-98ef-e2bc75c4b792`) and created a Sandbox embed successfully. The embed displayed the candidate as a full-height avatar with a Chat now control, confirming the selected source is a real LiveAvatar preset rather than a static app image. After starting with Arabic selected, the session remained Connecting and then showed `Something went wrong. Please try again later.` Therefore the candidate was NOT installed in COMO and the test is not considered a successful motion/speech run.

Voice Agent fallback test 2026-09-05: created a Sandbox embed using the preset's official `default_voice_agent_id` (`37885e6e-c073-4d7c-bb60-aad4058f62b6`) and `default_language: multi`, excluding the custom Salwa context. The embed loaded the same chosen Katya preset, but after Chat now it remained in Connecting. This confirms the failure is not caused only by the custom context or Arabic default language; the account/session path itself is still not completing WebRTC in this environment. Candidate remains uninstalled.

78. LITE token retry 2026-09-05: after reducing the request to the official minimum `{ mode: "LITE", avatar_id: "26393b8e-e944-4367-98ef-e2bc75c4b792", is_sandbox: true }`, the API still returned HTTP 400 before session creation. A read-only `GET /v1/avatars` with the current credential returned `code: 1000`, `count: 0`, and an empty result list. This indicates that the current API credential exposes no LiveAvatar API avatars, even though the web dashboard shows preset avatars; the hard-coded Katya UUID therefore cannot be used by the token endpoint. No production session was created by this retry and no API key was saved.

## Official-site verification 2026-09-05

The official HeyGen FAQ states that LiveAvatar is a separate platform with its own plans and settings; HeyGen paid plans and avatar slots do not automatically affect LiveAvatar. It also states that LiveAvatar avatars are not cross-compatible with HeyGen avatars, that Free accounts can explore/sample the service, and that Lite mode is the recommended route for unsupported languages because the customer supplies ASR/LLM/TTS. The FAQ confirms that LiveAvatar credits are independent from HeyGen API credits: Full uses one credit per 30 seconds, while Lite uses one credit per minute. The official overview quickstart uses a built-in sandbox avatar/context example through `POST /v2/embeddings`, and explicitly says Sandbox does not consume credits. These findings mean that a visible preset in the dashboard does not by itself prove that the current API key can use the same avatar through the LITE token endpoint; the API credential/plan path must be matched to the correct LiveAvatar resource.

References:
- https://help.heygen.com/en/articles/12758866-liveavatar-faq
- https://help.heygen.com/en/articles/12758516-introducing-liveavatar
- https://docs.liveavatar.com/

## Final official Sandbox retry — 2026-09-05

The currently logged-in LiveAvatar workspace is the single `Default Space` workspace, marked `Free`, with one space-scoped API key named `For Manus` created on 2026-09-05 and ending in `4bae`. The workspace selector exposed no second paid workspace. The official FAQ explicitly states that HeyGen paid plans and HeyGen avatar slots are separate from LiveAvatar plans and do not automatically grant LiveAvatar streaming entitlements.

Using the exact avatar and context identifiers published in the official LiveAvatar quickstart, `POST /v2/embeddings` in Sandbox returned HTTP 200 and `Embed Avatar created successfully`. The generated page rendered a real female LiveAvatar, progressed from `Connecting...` to the active chat controls, and showed visible frame-to-frame facial movement. An Arabic text prompt was submitted, but an audible Arabic reply could not be verified in the automated browser, so Arabic speech is not claimed as proven. A read-only credit check remained at `8.0` after the retry, confirming that this official Sandbox attempt did not consume additional credits.

## Salwa configuration and COMO integration — 2026-09-05

The official preset `65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0` was paired with Salwa's existing Arabic context `49f5d2d7-1f7e-4f76-a0fe-c58d64ab24ca`. The Sandbox embed request returned HTTP 200, selected Arabic by default, progressed to the active chat interface, and exposed a playing media stream with `readyState=4`, `paused=false`, `volume=1`, plus live unmuted audio and video tracks. A direct LITE token request for the same official avatar also returned HTTP 200, proving the previous LITE rejection was caused by the invalid Katya catalog identifier rather than by LITE itself.

Cross-origin WebRTC remained unreliable inside an iframe in the Manus preview, although the identical Salwa embed worked as a top-level page. COMO therefore now opens Salwa in a user-initiated standalone Sandbox window and keeps a visible recovery button inside the chat. Browser verification confirmed that the named popup opened, remained active, and navigated cross-origin to LiveAvatar. Targeted LiveAvatar/Command Center tests and the production build passed after the change.
