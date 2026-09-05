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
