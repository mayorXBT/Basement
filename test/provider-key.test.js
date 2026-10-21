import assert from "node:assert/strict";
import test from "node:test";

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalBaseUrl = process.env.GEMINI_BASE_URL;
const originalGenerationConfig = process.env.ANALYSIS_GENERATION_CONFIG;
const requests = [];
let generationCalls = 0;

process.env.GEMINI_API_KEY = "provider-test-key";
process.env.GEMINI_BASE_URL = "https://gemini.example.test/root";

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  if (url.hostname === "127.0.0.1") return originalFetch(input, init);

  requests.push({ url, headers: new Headers(init.headers), body: init.body ? JSON.parse(init.body) : null });
  if (url.pathname.endsWith("/v1beta/models")) {
    return Response.json({ models: [{ name: "models/gemini-test", supportedGenerationMethods: ["generateContent"] }] });
  }

  const body = JSON.parse(init.body || "{}");
  const prompt = body.contents?.[0]?.parts?.[0]?.text || "";
  if (prompt.includes("public-speaking coach")) {
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: "Grounded coaching.", clarity: { score: 80 }, confidence: { score: 80 }, fillerControl: { score: 80 }, pace: { score: 80, wpm: 120 }, strengths: ["Clear opening."], improvements: ["Add an example."] }) }] } }] });
  }

  generationCalls += 1;
  if (generationCalls === 1) return new Response("not found", { status: 404 });
  return Response.json({ candidates: [{ content: { parts: [{ text: "A useful detour" }] } }] });
};

const { default: app } = await import("../server.js");

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("Gemini calls keep the key in a header and honor the base URL", async () => {
  const server = await listen();
  try {
    const { port } = server.address();
    const spin = await originalFetch(`http://127.0.0.1:${port}/api/spin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "off-the-cuff", niche: "general" })
    });
    assert.equal(spin.status, 200);

    process.env.ANALYSIS_GENERATION_CONFIG = "deterministic";
    const analyze = await originalFetch(`http://127.0.0.1:${port}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "Testing", transcript: "A short answer.", metrics: {} })
    });
    assert.equal(analyze.status, 200);

    assert.ok(requests.length >= 4, "expected generation, catalog, retry, and analysis calls");
    for (const request of requests) {
      assert.equal(request.url.origin, "https://gemini.example.test");
      assert.match(request.url.pathname, /^\/root\/v1beta\/models/);
      assert.equal(request.url.search, "");
      assert.equal(request.headers.get("x-goog-api-key"), "provider-test-key");
    }
    const analysisRequest = requests.find((request) => request.body?.contents?.[0]?.parts?.[0]?.text?.includes("public-speaking coach"));
    assert.deepEqual(analysisRequest.body.generationConfig, { temperature: 0, responseMimeType: "application/json", seed: 1 });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    if (originalBaseUrl === undefined) delete process.env.GEMINI_BASE_URL; else process.env.GEMINI_BASE_URL = originalBaseUrl;
    if (originalGenerationConfig === undefined) delete process.env.ANALYSIS_GENERATION_CONFIG; else process.env.ANALYSIS_GENERATION_CONFIG = originalGenerationConfig;
  }
});
