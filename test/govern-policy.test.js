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

test("policy fails when the source merge request pipeline did not pass", () => {
  const ok = evaluatePolicy({ currentJobs: jobs(currentNames), mergeRequestJobs: jobs(mrNames), sourcePipelineStatus: "success" });
  assert.equal(ok.ok, true);
  for (const status of ["failed", "running", null]) {
    const report = evaluatePolicy({ currentJobs: jobs(currentNames), mergeRequestJobs: jobs(mrNames), sourcePipelineStatus: status });
    assert.equal(report.ok, false);
    assert.deepEqual(report.failing, [{ name: "source merge request pipeline", status: status || "unknown" }]);
  }
});

test("every job the policy requires from the source MR pipeline runs on every MR", async () => {
  const fs = await import("node:fs");
  const { requiredMergeRequest } = await import("../scripts/evidence/policy.mjs");
  const config = ["verify", "secure"].map((name) => fs.readFileSync(new URL(`../.gitlab/ci/${name}.yml`, import.meta.url), "utf8")).join("\n");
  for (const name of requiredMergeRequest) {
    const start = config.indexOf(`\n${name}:\n`);
    assert.notEqual(start, -1, `${name} is defined`);
    const rest = config.slice(start + name.length + 3);
    const block = rest.slice(0, rest.search(/\n[^\s#][^\n]*:\n|$/));
    assert.doesNotMatch(block, /^\s+changes:/m, `${name} must not be skipped by rules:changes`);
    assert.doesNotMatch(block, /when:\s*never[\s\S]*merge_request_event|merge_request_event[^\n]*\n\s+when:\s*(never|manual)/, `${name} runs on MR pipelines`);
  }
});
