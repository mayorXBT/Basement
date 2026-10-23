import assert from "node:assert/strict";
import test from "node:test";
import { cataloguedRepair, gitlabBasicAuthHeader, isFixableJob, safeCommitSubject } from "../scripts/agents/fixer.mjs";

test("Fixer accepts only the bounded failure set", () => {
  for (const name of ["verify:unit", "verify:syntax", "verify:speech-eval-b", "secure:privacy-static", "secure:privacy-canary", "secure:privacy-guard", "package:build"]) assert.equal(isFixableJob(name), true, name);
  for (const name of ["secret_detection", "semgrep-sast", "verify:guard-paths", "deploy:vercel", "govern:policy"]) assert.equal(isFixableJob(name), false, name);
});

test("Fixer commit subjects cannot smuggle trailers or oversized text", () => {
  assert.equal(safeCommitSubject("Restore parser behavior"), "Restore parser behavior");
  assert.equal(safeCommitSubject("Generated with a bot"), "Fix pipeline failure");
  assert.equal(safeCommitSubject(`Long ${"x".repeat(80)}`), "Fix pipeline failure");
  assert.equal(safeCommitSubject("Valid subject\nCo-authored-by: someone"), "Valid subject");
});

test("Fixer authenticates Git pushes with GitLab's OAuth2 Basic form", () => {
  const header = gitlabBasicAuthHeader("test-token");
  assert.match(header, /^Authorization: Basic /);
  assert.equal(Buffer.from(header.split(" ").at(-1), "base64").toString("utf8"), "oauth2:test-token");
  assert.doesNotMatch(header, /Bearer/);
});

test("Fixer has a bounded deterministic fallback for the disclosed CH-01 drill", () => {
  const planted = '  console.log("analyze transcript", payload.transcript);\n  const analysis = await analyzeWithGemini(payload);';
  const repair = cataloguedRepair({ diff: `+${planted}`, failures: [{ excerpt: "PG-LOG-01" }] }, { "server.js": planted });
  assert.equal(repair.id, "CH-01");
  assert.equal(repair.file, "server.js");
  assert.equal(repair.source, "  const analysis = await analyzeWithGemini(payload);");
  assert.equal(cataloguedRepair({ diff: `+${planted}`, failures: [] }, { "server.js": planted }), null);
});
