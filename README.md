# Basement

Basement is an anonymous impromptu speaking practice app. It spins a topic, gives the speaker a timed mission, records the session locally in the browser, and returns a delivery-focused analysis.

The product is intentionally account-free. A session is not saved to a database and no user profile is created.

## What It Does

- Generates speaking prompts with Gemini, with local topic fallbacks when the provider is unavailable.
- Supports off-the-cuff and deep-research practice modes.
- Runs a speech timer with pause and reset controls.
- Requests microphone access only while a speech session is active.
- Shows a live microphone waveform and pitch readout in the timer.
- Detects audible speaking coverage and long pauses in the browser.
- Records audio as a temporary browser blob for transcription.
- Sends completed audio to Deepgram first, with Groq Whisper as a fallback.
- Sends the transcript and measured delivery signals to Gemini for coaching.
- Shows clarity, confidence, filler control, speaking pace, pitch span, transcript, strengths, and next moves.
- Plays a completion sound and confetti effect when a mission ends.

## Architecture

```text
Browser
  ├─ topic reel and timer
  ├─ Web Audio analyser: speaking ratio, pauses, pitch span
  ├─ MediaRecorder: temporary audio blob
  └─ sessionStorage: current analysis only

Vercel Node function / Express server
  ├─ POST /api/spin        -> Gemini topic generation
  ├─ POST /api/transcribe -> Deepgram -> Groq fallback
  ├─ POST /api/analyze    -> Gemini speech coaching
  └─ GET  /api/health     -> provider configuration status
```

The app does not use Supabase because it currently has no accounts, saved history, relational data, or persistence requirement. Vercel is the appropriate backend host for the existing stateless API.

## Requirements

- Node.js 18 or newer
- A Gemini API key for topic generation and analysis
- A Deepgram API key for primary transcription
- A Groq API key for transcription fallback
- A browser that supports `MediaRecorder` and microphone access for full sessions

## Local Setup

```powershell
npm install
Copy-Item .env.example .env.local
```

Fill in `.env.local`:

```env
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
DEEPGRAM_API_KEY=your-deepgram-key
GEMINI_MODEL=gemini-3.6-flash
GEMINI_ANALYSIS_MODEL=gemini-3.6-flash
DEEPGRAM_MODEL=nova-3
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
PORT=3000
```

Start the local server:

```powershell
npm start
```

Open [http://localhost:3000/i](http://localhost:3000/i).

For development with automatic server restarts:

```powershell
npm run dev
```

## API

### `GET /api/health`

Returns provider configuration booleans. It never returns secret values.

### `POST /api/spin`

Request:

```json
{
  "mode": "off-the-cuff",
  "niche": "general"
}
```

`mode` is `off-the-cuff` or `deep-research`. Niche values are allowlisted by the server.

### `POST /api/transcribe`

Accepts an audio request body. The server accepts supported audio content types and limits uploads to 25 MB. Deepgram is tried first, then Groq Whisper.

### `POST /api/analyze`

Request:

```json
{
  "topic": "A difficult decision",
  "transcript": "The spoken transcript goes here.",
  "metrics": {
    "words": 31,
    "fillers": 1,
    "pauses": 2,
    "wpm": 124,
    "speakingRatio": 68,
    "pitchAverage": 148,
    "pitchRange": 42,
    "transcriptionProvider": "deepgram"
  }
}
```

Gemini returns structured delivery feedback for clarity, confidence, filler control, pace, strengths, and improvements. Transcript and topic fields are bounded and treated as untrusted quoted data in the analysis prompt.

## Security

- API keys are read only on the server through environment variables.
- `.env`, `.env.*`, and `.env.local` are ignored by Git; `.env.example` is safe to commit.
- API routes have IP-based rate limits with stricter limits on provider calls.
- Future `/api/auth` routes are reserved for a five-attempt-per-15-minute limiter.
- JSON, transcript, topic, metrics, and audio payloads are validated and bounded.
- Security headers include CSP, frame protection, MIME sniffing protection, referrer policy, and microphone permissions policy.
- Gemini receives transcript data as untrusted content and is instructed not to follow embedded commands.
- The app does not log API key values or audio contents.

Before a public launch, rotate any API keys that have been used during development and configure HTTPS through the deployment platform.

## Deployment

The app is prepared for Vercel through `api/index.js` and `vercel.json`. Vercel runs the Express app as a Node function and serves the public UI through the same app.

Configure these Vercel environment variables for Preview and Production:

- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_ANALYSIS_MODEL`
- `DEEPGRAM_MODEL`
- `GROQ_TRANSCRIPTION_MODEL`

The custom domain is intended to be `basement.cefo.dev`.

## Verification

```powershell
node --check server.js
node --check public\app.js
node --check public\analysis.js
npm audit --omit=dev
```

The app should return `200` from `/api/health`, `400` for malformed API payloads, `415` for unsupported audio types, and `429` after the configured rate limit is exceeded.

## Project Files

- `server.js`: Express API, provider integrations, validation, rate limiting, and security headers.
- `api/index.js`: Vercel serverless entry point.
- `public/index.html`: practice interface and timer modal.
- `public/app.js`: timer, recording, waveform, local metrics, and analysis handoff.
- `public/analysis.html`: dedicated analysis route.
- `public/analysis.js`: analysis page rendering.
- `public/styles.css`: Basement visual system and responsive layout.
- `.env.example`: safe environment variable template.
