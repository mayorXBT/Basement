import assert from "node:assert/strict";
import test from "node:test";
import { runSynthetic } from "../scripts/monitor/synthetic.mjs";

const securityHeaders = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "permissions-policy": "microphone=(self)",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

function fakeFetch(request, init = {}) {
  const url = new URL(request);
  if (url.pathname === "/api/health") return Promise.resolve(Response.json({ ok: true, geminiConfigured: true, groqConfigured: true, deepgramConfigured: true }));
  if (url.pathname === "/") return Promise.resolve(new Response("ok", { status: 200, headers: securityHeaders }));
  if (url.pathname === "/api/spin") return Promise.resolve(Response.json({ topic: "A safe synthetic topic", source: "gemini" }));
  if (url.pathname === "/api/analyze") {
    const body = JSON.parse(init.body);
    assert.equal(body.metrics.words, 81);
    return Promise.resolve(Response.json({ source: "gemini", analysis: { summary: "Grounded" } }));
  }
  throw new Error(`unexpected request: ${url.pathname}`);
}

test("synthetic monitor checks health, privacy headers, spin, and analyze without an audio claim", async () => {
  const report = await runSynthetic("https://basement.example", { fetchImpl: fakeFetch, now: new Date("2026-10-21T05:00:00Z") });
  assert.deepEqual({ health: report.health, spin: report.spin, analyze: report.analyze, transcription: report.transcription }, { health: "passed", spin: "passed", analyze: "passed", transcription: "not-due" });
  assert.match(report.fixtureSha256, /^[0-9a-f]{64}$/);
});

test("six-hour transcription probe is honest when no approved clip exists", async () => {
  const report = await runSynthetic("https://basement.example", { fetchImpl: fakeFetch, now: new Date("2026-10-21T06:00:00Z"), audioPath: "/does/not/exist" });
  assert.equal(report.transcription, "skipped-no-approved-clip");
});

test("disclosed monitor fire drill fails after real checks", async () => {
  const original = process.env.MONITOR_FIRE_DRILL;
  process.env.MONITOR_FIRE_DRILL = "1";
  try {
    await assert.rejects(runSynthetic("https://basement.example", { fetchImpl: fakeFetch, now: new Date("2026-10-21T05:00:00Z") }), /disclosed MONITOR_FIRE_DRILL/);
  } finally {
    if (original === undefined) delete process.env.MONITOR_FIRE_DRILL; else process.env.MONITOR_FIRE_DRILL = original;
  }
});
