import assert from "node:assert/strict";

const expectedHeaders = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "permissions-policy": "microphone=(self)",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

export async function smoke(baseUrl, { fetchImpl = fetch } = {}) {
  const root = new URL(baseUrl);
  const healthResponse = await fetchImpl(new URL("/api/health", root), { signal: AbortSignal.timeout(15000) });
  assert.equal(healthResponse.status, 200, "health endpoint must return 200");
  const health = await healthResponse.json();
  assert.deepEqual(Object.keys(health).sort(), ["deepgramConfigured", "geminiConfigured", "groqConfigured", "ok"]);
  assert.equal(health.ok, true);

  const expectProviders = process.env.SMOKE_EXPECT_PROVIDERS !== "0";
  if (expectProviders) {
    assert.equal(health.geminiConfigured, true, "Gemini secret is not configured");
    assert.equal(health.deepgramConfigured, true, "Deepgram secret is not configured");
    assert.equal(health.groqConfigured, true, "Groq secret is not configured");
  }

  const pageResponse = await fetchImpl(root, { signal: AbortSignal.timeout(15000) });
  assert.equal(pageResponse.status, 200, "home page must return 200");
  for (const [name, value] of Object.entries(expectedHeaders)) {
    assert.equal(pageResponse.headers.get(name), value, `${name} changed`);
  }
  assert.equal(pageResponse.headers.has("set-cookie"), false, "responses must not set cookies");

  const result = { ok: true, healthSchema: true, providersConfigured: expectProviders, securityHeaders: 5, cookies: 0 };
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const baseUrl = process.argv[2];
  if (!baseUrl) throw new Error("usage: node scripts/monitor/smoke.mjs BASE_URL");
  await smoke(baseUrl);
}
