import crypto from "node:crypto";

const canary = process.env.CANARY_VALUE;
const baselineHeaders = JSON.parse(Buffer.from(process.env.BASELINE_HEADERS_B64 || "e30=", "base64").toString("utf8"));
const baseUrl = "http://127.0.0.1:8080";
if (!canary) throw new Error("CANARY_VALUE is required");

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const [appResponse, providerResponse] = await Promise.all([
        fetchWithTimeout(`${baseUrl}/api/health`),
        fetchWithTimeout("http://fake-providers:8081/__report")
      ]);
      if (appResponse.ok && providerResponse.ok) return;
    } catch { /* The application may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("canary app or fake provider did not become healthy");
}

async function jsonRequest(pathname, body) {
  const response = await fetchWithTimeout(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* Status checks handle invalid bodies. */ }
  return { response, payload };
}

await waitForHealth();
const healthResponse = await fetchWithTimeout(`${baseUrl}/api/health`);
const health = await healthResponse.json();
let headerMatches = 0;
let cookies = 0;
for (const pathname of ["/", "/analysis", "/api/health"]) {
  const response = await fetchWithTimeout(`${baseUrl}${pathname}`);
  if (response.headers.has("set-cookie")) cookies += 1;
  for (const [name, value] of Object.entries(baselineHeaders)) if (response.headers.get(name) === value) headerMatches += 1;
}

const spin = await jsonRequest("/api/spin", { mode: "off-the-cuff", niche: "general", recentTopics: [canary] });
const audio = Buffer.from("basement-audio-canary-bytes");
const transcribeResponse = await fetchWithTimeout(`${baseUrl}/api/transcribe`, { method: "POST", headers: { "content-type": "audio/webm" }, body: audio });
const transcription = await transcribeResponse.json();
const analysisBody = { topic: "Canary topic", transcript: canary, metrics: { words: 1, fillers: 0, pauses: 0, wpm: 20, speakingRatio: 80, pitchAverage: 140, pitchRange: 20 } };
let analyze = await jsonRequest("/api/analyze", analysisBody);
const firstAnalyze = { status: analyze.response.status, source: analyze.payload?.source };
for (let call = 2; call <= 11; call += 1) analyze = await jsonRequest("/api/analyze", analysisBody);
const malformed = await fetchWithTimeout(`${baseUrl}/api/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });

process.stdout.write(`${JSON.stringify({
  health,
  headerMatches,
  expectedHeaderMatches: Object.keys(baselineHeaders).length * 3,
  cookies,
  spin: { status: spin.response.status, source: spin.payload?.source },
  transcription: { status: transcribeResponse.status, provider: transcription.provider, matchesCanary: transcription.transcript === canary },
  audioSha256: crypto.createHash("sha256").update(audio).digest("hex"),
  firstAnalyze,
  analyzeCall11: analyze.response.status,
  malformedStatus: malformed.status
})}\n`);
