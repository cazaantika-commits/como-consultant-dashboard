# Layla Opening Voice Briefing Validation

## Initial live check — 2026-08-27

The authenticated Command Center loaded after the server restart and displayed a speaker-only control with the accessible label `تشغيل ملخص ليلى الصوتي`. This control is deliberately icon-only; no opening text summary was added to the page.

The automatic attempt is intentionally guarded for browser autoplay rules. The first on-screen state after load exposed the same sound-only retry control, allowing the member to start the briefing after a user gesture. The control was pressed in the authenticated browser session; the next validation checks the console and server logs for the TTS request and playback result.

## Local-device voice fallback — 2026-08-27

The external speech provider rejected the configured credential with HTTP 401, so the opening briefing and Layla's read-aloud control were converted to the browser's local speech service. No external key, audio upload, or remote TTS request is used by the new route.

The implementation prefers an installed Arabic voice whose installed name indicates a female voice; if it is unavailable, it prefers any Arabic device voice before a device default. The opening greeting identifies the speaker as Layla and varies by the authenticated member. The Command Center rendered the speaker-only control after the conversion, and a manual press completed without a browser-console error or a request to the former `textToSpeech` endpoint. The browser automation environment cannot perceive audio output, so final voice timbre is device-dependent and should be checked on the owner's phone.

The authenticated browser confirms that its speech interface is available but reports no installed voices in this headless environment. This prevents audible verification here, not the browser speech implementation itself. On a normal phone or desktop browser with Arabic voices installed, the code asks for an Arabic voice and prefers one whose installed name identifies a female voice. The sound-only button remains available after browser autoplay restrictions.
