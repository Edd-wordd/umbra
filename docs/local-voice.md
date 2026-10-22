# Local voice transcription

The voice preview has explicit Start/Stop microphone controls. Recording stops after 30 seconds or when the panel closes. Audio is converted in the browser to mono 16 kHz PCM WAV, then sent through `/api/voice/transcribe` to a loopback Whisper server. Umbra does not persist recordings or use vendor speech recognition. Review/edit the transcript and press ROUTE; transcription never executes an action.

## Setup

A transcription engine is not bundled or installed automatically. Run a whisper.cpp-compatible server with a downloaded model on the Mac, bound to loopback. Configure its multipart inference endpoint in `.env.local`:

```env
UMBRA_WHISPER_URL=http://127.0.0.1:8080/inference
```

Restart Umbra after configuration. The endpoint must accept multipart `file` (WAV) and `response_format=json`, returning `{ "text": "..." }`. Only loopback HTTP destinations are accepted; redirects are refused. The existing Mac helper remains unchanged: transcription is a separate local service for now.

Open the existing voice simulation/preview with V in development, start recording, stop, review the transcript, and route it. HTTPS or localhost and microphone permission are required by the browser. Without a local server configured, the UI reports that explicitly. No microphone, model accuracy, or local server integration is verified by a production build alone.
