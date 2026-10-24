import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildLedger } from "../scripts/evidence/build-ledger.mjs";
import { linkedIssueIid, postEvidence } from "../scripts/evidence/post-evidence.mjs";

const script = fileURLToPath(new URL("../scripts/evidence/post-evidence.mjs", import.meta.url));
const sha = "4d5595e2247c7cc649713d64b62a02323dd25e00";
const ledger = buildLedger([{ job: "verify:unit", stage: "verify", status: "success", started_at: "2026-10-24T10:00:00Z", artifact_sha256: {}, summary: {} }]);
const env = { AUTOPILOT_BOT_TOKEN: "test", CI_COMMIT_SHA: sha, CI_PROJECT_URL: "https://gitlab.example/p", CI_JOB_URL: "https://gitlab.example/p/-/jobs/9", CI_PIPELINE_URL: "https://gitlab.example/p/-/pipelines/4", RELEASE_VERSION: "v1.2.3" };

function tempOutput() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "post-evidence-")), "reports", "post-evidence.json");
}

function fakeClient(description, { failNotes = false } = {}) {
  const calls = [];
  return {
    calls,
    configured: true,
    async listCommitMergeRequests() { return [{ iid: 11, state: "merged", merge_commit_sha: sha, web_url: "https://gitlab.example/p/-/merge_requests/11", description }]; },
    async listIssueNotes(iid) { calls.push(["notes", iid]); if (failNotes) throw new Error("GitLab API GET notes returned 500"); return []; },
    async createIssueNote(iid, body) { calls.push(["note", iid, body]); },
    async updateIssue(iid, body) { calls.push(["update", iid, body]); }
  };
}

test("linked issue is parsed from Closes or Fixes", () => {
  assert.equal(linkedIssueIid("Fix it.\n\nCloses #12"), "12");
  assert.equal(linkedIssueIid("fixes #3"), "3");
  assert.equal(linkedIssueIid("Maintenance only"), null);
  assert.equal(linkedIssueIid(null), null);
});

test("merge request with a linked issue posts evidence, labels, and closes the issue", async () => {
  const client = fakeClient("Body\n\nCloses #12");
  const output = tempOutput();
  const report = await postEvidence({ ledger, client, env, output, log: () => {} });
  assert.equal(report.status, "posted");
  assert.equal(report.issueIid, "12");
  assert.deepEqual(client.calls.map((call) => call[0]), ["notes", "note", "update"]);
  assert.match(client.calls[1][2], new RegExp(`basement-evidence:${ledger.at(-1).hash}`));
  assert.deepEqual(client.calls[2][2], { add_labels: "autopilot::shipped", state_event: "close" });
  assert.equal(JSON.parse(fs.readFileSync(output, "utf8")).status, "posted");
});

test("merge request without a linked issue is skipped and writes a report", async () => {
  const client = fakeClient("Skip unrelated artifacts in the package job");
  const output = tempOutput();
  const lines = [];
  const report = await postEvidence({ ledger, client, env, output, log: (line) => lines.push(line) });
  assert.deepEqual(client.calls, []);
  assert.equal(report.status, "skipped");
  const written = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(written.status, "skipped");
  assert.equal(written.reason, "no-linked-issue");
  assert.equal(written.mergeRequestIid, 11);
  assert.equal(written.ledgerHead, ledger.at(-1).hash);
  assert.match(lines[0], /No linked issue \(Closes #<iid>\) on MR !11; skipping/);
});

test("ledger verification and API failures still fail evidence posting", async () => {
  const tampered = structuredClone(ledger);
  tampered[0].status = "failed";
  await assert.rejects(postEvidence({ ledger: tampered, client: fakeClient("Closes #12"), env, output: tempOutput(), log: () => {} }), /verification failed/);
  await assert.rejects(postEvidence({ ledger, client: fakeClient("Closes #12", { failNotes: true }), env, output: tempOutput(), log: () => {} }), /returned 500/);
  await assert.rejects(postEvidence({ ledger, client: { ...fakeClient(""), async listCommitMergeRequests() { return []; } }, env, output: tempOutput(), log: () => {} }), /No merge request/);
});

test("CLI exits 0 and writes a skipped report when the merge request links no issue", async () => {
  const writes = [];
  const server = http.createServer((request, response) => {
    if (request.method !== "GET") writes.push(request.url);
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify([{ iid: 11, state: "merged", merge_commit_sha: sha, web_url: "https://gitlab.example/p/-/merge_requests/11", description: "No issue here" }]));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "post-evidence-cli-"));
    const ledgerPath = path.join(dir, "evidence-ledger.jsonl");
    fs.writeFileSync(ledgerPath, `${ledger.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    const output = path.join(dir, "reports", "post-evidence.json");
    const child = spawn(process.execPath, [script, ledgerPath, output], {
      env: { ...process.env, ...env, GITLAB_TOKEN: "", CI_JOB_TOKEN: "", CI_API_V4_URL: `http://127.0.0.1:${server.address().port}/api/v4`, CI_PROJECT_ID: "1" }
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    const code = await new Promise((resolve) => child.on("close", resolve));
    assert.equal(code, 0);
    assert.match(stdout, /skipping issue evidence comment and close/);
    assert.equal(JSON.parse(fs.readFileSync(output, "utf8")).reason, "no-linked-issue");
    assert.deepEqual(writes, []);
  } finally {
    server.close();
  }
});
