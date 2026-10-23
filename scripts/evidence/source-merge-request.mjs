// Resolves the merge request that produced a default-branch commit and that MR's own pipeline.
// GET /repository/commits/:sha/merge_requests returns basic MR objects without head_pipeline,
// so the pipeline always comes from the single-MR endpoint or the MR pipelines list.

function sameSha(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

export function selectSourceMergeRequest(mergeRequests, commitSha) {
  const candidates = Array.isArray(mergeRequests) ? mergeRequests : [];
  return candidates.find((item) => sameSha(item.merge_commit_sha, commitSha) || sameSha(item.squash_commit_sha, commitSha))
    || candidates.find((item) => item.state === "merged" && sameSha(item.sha, commitSha))
    || candidates.find((item) => item.state === "merged")
    || candidates[0]
    || null;
}

export function selectSourcePipeline(mergeRequest, pipelines = []) {
  const headSha = mergeRequest?.sha;
  if (!headSha) return null;
  if (mergeRequest.head_pipeline?.id && sameSha(mergeRequest.head_pipeline.sha, headSha)) return mergeRequest.head_pipeline;
  const matching = pipelines.filter((pipeline) => sameSha(pipeline.sha, headSha));
  const preferred = matching.filter((pipeline) => pipeline.source === "merge_request_event");
  return [...(preferred.length ? preferred : matching)].sort((left, right) => Number(right.id) - Number(left.id))[0] || null;
}

export async function findSourceMergeRequest(client, env = process.env) {
  const commitSha = env.CI_COMMIT_SHA;
  let iid = env.CI_MERGE_REQUEST_IID;
  if (!iid) {
    if (!commitSha) throw new Error("CI_COMMIT_SHA is required to find the source merge request");
    const summary = selectSourceMergeRequest(await client.listCommitMergeRequests(commitSha), commitSha);
    if (!summary?.iid) throw new Error(`No merge request is associated with commit ${commitSha}`);
    iid = summary.iid;
  }
  const mergeRequest = await client.getMergeRequest(iid);
  if (!mergeRequest?.iid) throw new Error(`Merge request !${iid} could not be read`);
  let pipeline = selectSourcePipeline(mergeRequest);
  if (!pipeline) pipeline = selectSourcePipeline(mergeRequest, await client.listMergeRequestPipelines(mergeRequest.iid));
  return { mergeRequest, pipeline };
}
