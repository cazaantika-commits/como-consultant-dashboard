# Layla Gemini TTS integration reference

Official source: [Gemini API — Text-to-speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)

The official documentation states that Gemini TTS accepts text-only input and returns audio-only output, supports Arabic, allows control of style, pace, accent, and tone, and exposes the REST endpoint `POST https://generativelanguage.googleapis.com/v1beta/interactions` using the `x-goog-api-key` header.

This implementation uses `gemini-3.1-flash-tts-preview` with the single-speaker voice `Aoede`. The successful live probe on 31 August 2026 returned HTTP 200. The audio payload was found at `steps[].content[]` where `type` is `audio`; it contained base64 PCM16 data with MIME `audio/l16; rate=24000; channels=1`. The server wraps that PCM data in a standard WAV header before returning it to the browser.

The existing OpenAI TTS probe returned HTTP 401 because the injected OpenAI key was rejected. Layla therefore uses Gemini TTS as the high-quality primary path and browser speech synthesis only as a fallback.
