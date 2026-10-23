import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePolicy } from "../scripts/evidence/policy.mjs";

const currentNames = [
  "verify:unit", "verify:syntax", "verify:niche-parity", "verify:speech-eval-a", "verify:speech-eval-b",
  "secure:privacy-static", "secure:privacy-canary", "secret_detection", "semgrep-sast", "dependency-scanning",
  "package:build", "release:publish", "deploy:vercel"
];
const mrNames = ["verify:guard-paths", "verify:flow-parity", "secure:privacy-guard"];
const jobs = (names) => names.map((name, index) => ({ id: index + 1, name, status: "success" }));

test("hands-off policy requires every named job and resolved thread", () => {
  assert.equal(evaluatePolicy({ currentJobs: jobs(currentNames), mergeRequestJobs: jobs(mrNames) }).ok, true);
  const missing = evaluatePolicy({ currentJobs: jobs(currentNames.filter((name) => name !== "verify:speech-eval-b")), mergeRequestJobs: jobs(mrNames) });
  assert.deepEqual(missing.missing, ["verify:speech-eval-b"]);
  assert.equal(evaluatePolicy({ currentJobs: jobs(currentNames), mergeRequestJobs: jobs(mrNames), unresolvedThreads: 1 }).ok, false);
});

test("paused mode cannot authorize deployment", () => {
  const report = evaluatePolicy({ currentJobs: jobs(currentNames), mergeRequestJobs: jobs(mrNames), paused: true });
  assert.equal(report.ok, false);
  assert.equal(report.paused, true);
});
