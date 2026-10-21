import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { auditAgentCommits, protectedPath } from "../scripts/agents/guard-paths.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function commit(cwd, message) {
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", message]);
  return git(cwd, ["rev-parse", "HEAD"]);
}

function repository() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "basement-guard-"));
  git(cwd, ["init", "--quiet"]);
  git(cwd, ["config", "user.email", "agent@example.test"]);
  git(cwd, ["config", "user.name", "Agent Test"]);
  fs.mkdirSync(path.join(cwd, "test"));
  fs.mkdirSync(path.join(cwd, "chaos"));
  fs.writeFileSync(path.join(cwd, "server.js"), "export const value = 1;\n");
  fs.writeFileSync(path.join(cwd, "test", "server.test.js"), "// test\n");
  fs.writeFileSync(path.join(cwd, "chaos", "catalog.json"), "[]\n");
  return { cwd, base: commit(cwd, "Initial") };
}

test("protected path policy distinguishes Builder and Fixer test access", () => {
  assert.equal(protectedPath(".gitlab-ci.yml", "builder"), true);
  assert.equal(protectedPath("agents/prompts/builder.md", "builder"), true);
  assert.equal(protectedPath("test/new-feature.test.js", "builder"), false);
  assert.equal(protectedPath("test/new-feature.test.js", "fixer"), true);
  assert.equal(protectedPath("orig-index.js", "builder"), true);
});

test("Builder may change product code and ordinary tests with required trailers", () => {
  const { cwd, base } = repository();
  try {
    fs.appendFileSync(path.join(cwd, "server.js"), "export const next = 2;\n");
    fs.appendFileSync(path.join(cwd, "test", "server.test.js"), "// coverage\n");
    commit(cwd, "Add behavior\n\nAutopilot-Agent: builder\nRefs: #12");
    assert.deepEqual(auditAgentCommits({ cwd, base }).violations, []);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test("Fixer cannot edit tests or omit its bounded attempt", () => {
  const { cwd, base } = repository();
  try {
    fs.appendFileSync(path.join(cwd, "test", "server.test.js"), "// weakened\n");
    commit(cwd, "Patch check\n\nAutopilot-Agent: fixer\nRefs: #12");
    const reasons = auditAgentCommits({ cwd, base }).violations.map((item) => item.reason);
    assert.equal(reasons.some((reason) => reason.includes("protected path")), true);
    assert.equal(reasons.some((reason) => reason.includes("attempt")), true);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test("agent workload branches cannot hide commits by omitting metadata", () => {
  const { cwd, base } = repository();
  try {
    fs.appendFileSync(path.join(cwd, "server.js"), "export const hidden = 3;\n");
    commit(cwd, "Unattributed workload change");
    const report = auditAgentCommits({ cwd, base, requireAgentMetadata: true });
    assert.equal(report.ok, false);
    assert.match(report.violations[0].reason, /missing the Autopilot-Agent/);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
