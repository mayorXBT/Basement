import assert from "node:assert/strict";
import test from "node:test";
import { buildLedger, canonicalJson } from "../scripts/evidence/build-ledger.mjs";
import { verifyLedger } from "../scripts/evidence/verify-ledger.mjs";
import { renderReceipt } from "../scripts/evidence/render-receipt.mjs";

const entries = [
  { job: "secure:privacy-static", stage: "secure", status: "success", started_at: "2026-10-21T10:01:00Z", artifact_sha256: {}, summary: {} },
  { job: "verify:unit", stage: "verify", status: "success", started_at: "2026-10-21T10:00:00Z", artifact_sha256: {}, summary: {} }
];

test("canonical JSON is stable across object key order", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
});

test("ledger ordering and hash chain are deterministic and tamper-evident", () => {
  const ledger = buildLedger(entries);
  assert.equal(ledger[0].job, "verify:unit");
  assert.equal(verifyLedger(ledger).ok, true);
  const tampered = structuredClone(ledger);
  tampered[0].status = "failed";
  assert.equal(verifyLedger(tampered).ok, false);
});

test("privacy receipt refuses to claim missing P10 review", () => {
  const ledger = buildLedger(entries);
  const receipt = renderReceipt({
    version: "v1.1.0", sha: "abcdef123456", pipelineId: "42", ledger,
    staticReport: { ok: true },
    canary: { ok: true, checks: { filesystemChanges: 0, temporaryFiles: 0, logHits: 0, cookies: 0, environmentFiles: 0, securityHeaders: 5, analyzeCall11: 429 }, routing: { unexpectedRequests: 0 } },
    evalReport: { ok: true, fixtures: [{ id: "E05-injection", ok: true, passingSamples: 3 }] },
    guardReport: null
  });
  assert.match(receipt, /P1 audio never stored \| PASS/);
  assert.match(receipt, /P10 microphone lifecycle \| REVIEW REQUIRED/);
  assert.match(receipt, new RegExp(ledger.at(-1).hash));
});
