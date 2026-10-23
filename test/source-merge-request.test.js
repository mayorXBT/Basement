import assert from "node:assert/strict";
import test from "node:test";
import { GitLabClient } from "../scripts/agents/gitlab.mjs";
import { findSourceMergeRequest, selectSourceMergeRequest, selectSourcePipeline } from "../scripts/evidence/source-merge-request.mjs";

const mergeSha = "3c7aab7216d18d212f2b77f74d78a003034cf2f8";
const headSha = "da176a1f07c61da0999b3fd0302aa7392584cd7c";
// Shape returned by GET /repository/commits/:sha/merge_requests: no head_pipeline field.
const summary = { iid: 4, state: "merged", sha: headSha, merge_commit_sha: mergeSha, squash_commit_sha: null };

function fakeClient({ list = [summary], detail = {}, pipelines = [] } = {}) {
  const calls = [];
  return {
    calls,
    async listCommitMergeRequests(sha) { calls.push(["list", sha]); return list; },
    async getMergeRequest(iid) { calls.push(["get", iid]); return { ...summary, iid, ...detail }; },
    async listMergeRequestPipelines(iid) { calls.push(["pipelines", iid]); return pipelines; }
  };
}

test("selects the merge request whose merge commit is the current commit", () => {
  const other = { iid: 3, state: "merged", sha: "abc", merge_commit_sha: "def" };
  assert.equal(selectSourceMergeRequest([other, summary], mergeSha).iid, 4);
  assert.equal(selectSourceMergeRequest([{ ...summary, merge_commit_sha: null, squash_commit_sha: mergeSha }], mergeSha).iid, 4);
  assert.equal(selectSourceMergeRequest([], mergeSha), null);
});

test("source pipeline must be for the merge request head sha", () => {
  assert.equal(selectSourcePipeline({ sha: headSha, head_pipeline: { id: 9, sha: headSha } }).id, 9);
  assert.equal(selectSourcePipeline({ sha: headSha, head_pipeline: { id: 9, sha: "stale" } }), null);
  const pipelines = [
    { id: 10, sha: headSha, source: "push" },
    { id: 11, sha: headSha, source: "merge_request_event" },
    { id: 12, sha: "older", source: "merge_request_event" }
  ];
  assert.equal(selectSourcePipeline({ sha: headSha }, pipelines).id, 11);
  assert.equal(selectSourcePipeline({ sha: headSha }, [pipelines[0]]).id, 10);
  assert.equal(selectSourcePipeline({ sha: headSha }, [pipelines[2]]), null);
});

test("main pipelines read head_pipeline from the single merge request, not the commit list", async () => {
  const client = fakeClient({ detail: { head_pipeline: { id: 2980952174, sha: headSha, status: "success" } } });
  const { mergeRequest, pipeline } = await findSourceMergeRequest(client, { CI_COMMIT_SHA: mergeSha });
  assert.equal(mergeRequest.iid, 4);
  assert.equal(pipeline.id, 2980952174);
  assert.deepEqual(client.calls, [["list", mergeSha], ["get", 4]]);
});

test("falls back to the merge request pipelines list when head_pipeline is absent", async () => {
  const client = fakeClient({ pipelines: [{ id: 2980952174, sha: headSha, source: "merge_request_event", status: "failed" }] });
  const { pipeline } = await findSourceMergeRequest(client, { CI_COMMIT_SHA: mergeSha });
  assert.equal(pipeline.id, 2980952174);
  assert.equal(pipeline.status, "failed");
});

test("uses CI_MERGE_REQUEST_IID when GitLab provides it", async () => {
  const client = fakeClient({ detail: { head_pipeline: { id: 7, sha: headSha } } });
  await findSourceMergeRequest(client, { CI_MERGE_REQUEST_IID: "4", CI_COMMIT_SHA: mergeSha });
  assert.deepEqual(client.calls, [["get", "4"]]);
});

test("fails loudly when no merge request or pipeline exists", async () => {
  await assert.rejects(findSourceMergeRequest(fakeClient({ list: [] }), { CI_COMMIT_SHA: mergeSha }), /No merge request is associated/);
  const { pipeline } = await findSourceMergeRequest(fakeClient(), { CI_COMMIT_SHA: mergeSha });
  assert.equal(pipeline, null);
});

test("GitLab client reads anonymously when CI_JOB_TOKEN is rejected, but never writes without a token", async (t) => {
  const original = fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push(init.headers["job-token"] ? "job" : "anonymous");
    return init.headers["job-token"] ? new Response("", { status: 401 }) : Response.json([{ iid: 4 }]);
  };
  t.after(() => { globalThis.fetch = original; });
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  delete process.env.AUTOPILOT_BOT_TOKEN;
  delete process.env.GITLAB_TOKEN;
  process.env.CI_JOB_TOKEN = "job";
  const client = new GitLabClient({ apiUrl: "https://gitlab.example/api/v4", projectId: "1" });
  assert.deepEqual(await client.listCommitMergeRequests(mergeSha), [{ iid: 4 }]);
  assert.deepEqual(seen, ["job", "anonymous"]);
  const anonymous = new GitLabClient({ apiUrl: "https://gitlab.example/api/v4", projectId: "1", token: null });
  assert.equal(anonymous.readable, true);
  assert.equal(anonymous.configured, false);
  await assert.rejects(anonymous.createIssueNote(1, "x"), /AUTOPILOT_BOT_TOKEN or GITLAB_TOKEN is required/);
});
