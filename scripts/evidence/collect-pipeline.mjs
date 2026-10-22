import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "../agents/gitlab.mjs";

export function jobEntry(job, pipeline = {}) {
  return {
    job: job.name,
    stage: job.stage,
    pipeline_id: String(pipeline.id || job.pipeline?.id || ""),
    pipeline_url: pipeline.web_url || job.pipeline?.web_url || null,
    job_url: job.web_url || null,
    sha: job.commit?.id || pipeline.sha || null,
    status: job.status,
    started_at: job.started_at || null,
    finished_at: job.finished_at || null,
    artifact_sha256: {},
    summary: { allow_failure: Boolean(job.allow_failure), retried: Boolean(job.retried) }
  };
}

function safeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const client = new GitLabClient();
  const pipelineId = process.env.CI_PIPELINE_ID;
  if (!client.configured || !pipelineId) throw new Error("Pipeline evidence collection requires GitLab API context");
  const jobs = await client.listPipelineJobs(pipelineId);
  const directory = path.resolve(process.argv[2] || "evidence");
  fs.mkdirSync(directory, { recursive: true });
  for (const job of jobs) fs.writeFileSync(path.join(directory, `${safeName(job.name)}-${job.id}.json`), `${JSON.stringify(jobEntry(job, { id: pipelineId, web_url: process.env.CI_PIPELINE_URL, sha: process.env.CI_COMMIT_SHA }), null, 2)}\n`);
  console.log(JSON.stringify({ collected: jobs.length, pipelineId }));
}
