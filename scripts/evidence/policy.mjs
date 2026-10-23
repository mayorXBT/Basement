import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "../agents/gitlab.mjs";
import { buildLedger } from "./build-ledger.mjs";
import { jobEntry } from "./collect-pipeline.mjs";
import { verifyLedger } from "./verify-ledger.mjs";

const requiredCurrent = [
  "verify:unit", "verify:syntax", "verify:niche-parity", "verify:speech-eval-a", "verify:speech-eval-b",
  "secure:privacy-static", "secure:privacy-canary", "secret_detection", "semgrep-sast", "dependency-scanning",
  "package:build", "release:publish", "deploy:vercel"
];
const requiredMergeRequest = ["verify:guard-paths", "verify:flow-parity", "secure:privacy-guard"];

function statusByName(jobs) {
  const latest = new Map();
  for (const job of jobs) if (!latest.has(job.name) || Number(job.id || 0) > Number(latest.get(job.name).id || 0)) latest.set(job.name, job);
  return latest;
}

export function evaluatePolicy({ currentJobs, mergeRequestJobs, unresolvedThreads = 0, paused = false }) {
  const current = statusByName(currentJobs);
  const mergeRequest = statusByName(mergeRequestJobs);
  const missing = [];
  const failing = [];
  for (const name of requiredCurrent) {
    if (!current.has(name)) missing.push(name);
    else if (current.get(name).status !== "success") failing.push({ name, status: current.get(name).status });
  }
  for (const name of requiredMergeRequest) {
    if (!mergeRequest.has(name)) missing.push(name);
    else if (mergeRequest.get(name).status !== "success") failing.push({ name, status: mergeRequest.get(name).status });
  }
  const ok = !paused && missing.length === 0 && failing.length === 0 && unresolvedThreads === 0;
  return { ok, paused, missing, failing, unresolvedThreads };
}

async function main() {
  const output = path.resolve(process.argv[2] || "reports/govern-policy.json");
  const client = new GitLabClient();
  if (!client.configured || !process.env.CI_PIPELINE_ID || !process.env.CI_COMMIT_SHA) throw new Error("Govern policy requires GitLab pipeline context");
  const [currentJobs, mergeRequests] = await Promise.all([client.listPipelineJobs(process.env.CI_PIPELINE_ID), client.listCommitMergeRequests(process.env.CI_COMMIT_SHA)]);
  const mergeRequest = mergeRequests.find((item) => item.state === "merged") || mergeRequests[0];
  if (!mergeRequest?.head_pipeline?.id) throw new Error("Govern policy could not find the source merge request pipeline");
  const [mergeRequestJobs, discussions] = await Promise.all([client.listPipelineJobs(mergeRequest.head_pipeline.id), client.listMergeRequestDiscussions(mergeRequest.iid)]);
  const unresolvedThreads = discussions.filter((discussion) => (discussion.notes || []).some((note) => note.resolvable === true && note.resolved !== true)).length;
  const policy = evaluatePolicy({ currentJobs, mergeRequestJobs, unresolvedThreads, paused: process.env.AUTOPILOT_PAUSED === "1" });
  const ledger = buildLedger([...currentJobs, ...mergeRequestJobs].map((job) => jobEntry(job, job.pipeline || {})));
  const verification = verifyLedger(ledger);
  const report = { ...policy, mode: process.env.AUTOPILOT_MODE || "supervised", mergeRequestIid: mergeRequest.iid, currentPipelineId: process.env.CI_PIPELINE_ID, sourcePipelineId: String(mergeRequest.head_pipeline.id), ledgerVerified: verification.ok, ledgerHead: verification.head };
  report.ok = report.ok && verification.ok;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
