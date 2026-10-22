import assert from "node:assert/strict";
import test from "node:test";
import { isFixableJob, safeCommitSubject } from "../scripts/agents/fixer.mjs";

test("Fixer accepts only the bounded failure set", () => {
  for (const name of ["verify:unit", "verify:syntax", "verify:speech-eval-b", "secure:privacy-static", "secure:privacy-canary", "secure:privacy-guard", "package:build"]) assert.equal(isFixableJob(name), true, name);
  for (const name of ["secret_detection", "semgrep-sast", "verify:guard-paths", "deploy:prod", "govern:policy"]) assert.equal(isFixableJob(name), false, name);
});

test("Fixer commit subjects cannot smuggle trailers or oversized text", () => {
  assert.equal(safeCommitSubject("Restore parser behavior"), "Restore parser behavior");
  assert.equal(safeCommitSubject("Generated with a bot"), "Fix pipeline failure");
  assert.equal(safeCommitSubject(`Long ${"x".repeat(80)}`), "Fix pipeline failure");
  assert.equal(safeCommitSubject("Valid subject\nCo-authored-by: someone"), "Valid subject");
});
