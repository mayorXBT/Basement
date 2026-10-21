import assert from "node:assert/strict";
import test from "node:test";
import { runSynthetic } from "../scripts/monitor/synthetic.mjs";
import { incidentDescription } from "../scripts/monitor/incident.mjs";
import { rollbackIfNeeded } from "../scripts/monitor/rollback-if-needed.mjs";

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

test("rollback is deterministic and only runs after a failed synthetic", () => {
  let calls = 0;
  const healthy = rollbackIfNeeded({ ok: true, attempts: 1 }, { service: "basement", execFile: () => { calls += 1; } });
  assert.equal(healthy.action, "not-needed");
  const failed = rollbackIfNeeded({ ok: false, attempts: 2, fireDrill: true }, { service: "basement", execFile: (command, args) => {
    calls += 1;
    assert.equal(command, "bash");
    assert.deepEqual(args, ["scripts/deploy/rollback.sh", "basement"]);
    return "Rolled basement back to basement-00001.\n";
  } });
  assert.equal(calls, 1);
  assert.equal(failed.action, "rolled-back");
  assert.equal(failed.fireDrill, true);
});

test("incident template discloses a fire drill and redacts speech fields", () => {
  const body = incidentDescription({ pipelineId: "77", pipelineUrl: "https://gitlab.example/pipelines/77", synthetic: { attempts: 2, fireDrill: true, error: "transcript=\"private words\" failed" }, rollback: { action: "rolled-back" }, revisions: "revision-a True" });
  assert.match(body, /Fire drill: yes/);
  assert.match(body, /rolled-back/);
  assert.doesNotMatch(body, /private words/);
});
