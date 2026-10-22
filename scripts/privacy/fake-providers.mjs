import crypto from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function responseJson(response, status, body) {
  const serialized = JSON.stringify(body);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(serialized) });
  response.end(serialized);
}

function geminiPayload(text) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function coachingResult() {
  return JSON.stringify({
    summary: "The response has a clear central point and can use a more deliberate pace.",
    clarity: { score: 78, feedback: "The main idea is understandable." },
    confidence: { score: 74, feedback: "Use fewer pauses between clauses." },
    fillerControl: { score: 82, feedback: "Filler use is controlled." },
    pace: { score: 80, wpm: 120, feedback: "Keep the pace near 120 WPM." },
    strengths: ["The response stays on topic."],
    improvements: ["Add one concrete supporting example."]
  });
}

export function startFakeProviders({ canary, expectedKey, port = 0, host = "127.0.0.1" }) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://fake-providers");
    if (url.pathname === "/__report") return responseJson(response, 200, { requests });

    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const bodyText = body.toString("utf8");
    const authorization = request.headers.authorization || "";
    const googleKey = request.headers["x-goog-api-key"] || "";
    const credential = googleKey || authorization;
    const provider = url.pathname.includes("generateContent") || url.pathname === "/v1beta/models"
      ? "gemini"
      : url.pathname === "/v1/listen"
        ? "deepgram"
        : url.pathname === "/openai/v1/audio/transcriptions"
          ? "groq"
          : "unexpected";
    const kind = provider === "gemini" && bodyText.includes("precise public-speaking coach") ? "analysis" : provider;
    requests.push({
      provider,
      kind,
      method: request.method,
      path: url.pathname,
      queryNames: [...url.searchParams.keys()].sort(),
      headerNames: Object.keys(request.headers).sort(),
      credentialHeader: googleKey ? "x-goog-api-key" : authorization ? "authorization" : null,
      credentialHash: credential ? digest(credential) : null,
      expectedCredential: credential === expectedKey || credential === `Token ${expectedKey}` || credential === `Bearer ${expectedKey}`,
      credentialInUrl: url.href.includes(expectedKey),
      credentialInBody: bodyText.includes(expectedKey),
      canaryInBody: bodyText.includes(canary),
      bodySha256: digest(body),
      bodyBytes: body.length
    });

    if (provider === "unexpected") return responseJson(response, 404, { error: "unknown fake-provider route" });
    if (url.pathname === "/v1beta/models") return responseJson(response, 200, { models: [{ name: "models/gemini-canary", supportedGenerationMethods: ["generateContent"] }] });
    if (provider === "gemini") {
      const text = kind === "analysis" ? coachingResult() : "Practice Makes Progress";
      return responseJson(response, 200, geminiPayload(text));
    }
    if (provider === "deepgram") {
      return responseJson(response, 200, {
        metadata: { duration: 3 },
        results: { channels: [{ alternatives: [{ transcript: canary, words: [{ word: "canary", start: 0, end: 1 }] }] }] }
      });
    }
    return responseJson(response, 200, { text: canary, words: [{ word: "canary", start: 0, end: 1 }], duration: 3 });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({ server, requests, url: `http://${host}:${address.port}` });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const canary = process.env.CANARY_VALUE;
  const expectedKey = process.env.CANARY_PROVIDER_KEY;
  if (!canary || !expectedKey) throw new Error("CANARY_VALUE and CANARY_PROVIDER_KEY are required");
  const { server } = await startFakeProviders({ canary, expectedKey, port: Number(process.env.PORT || 8081), host: "0.0.0.0" });
  console.log(JSON.stringify({ ready: true, port: server.address().port }));
}
