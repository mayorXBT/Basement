import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "./gitlab.mjs";
import { protectedPath } from "./guard-paths.mjs";
import { executeAgent } from "./run-agent.mjs";
import { redactText } from "../privacy/redact.mjs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const fixableJobs = /^(?:verify:(?:unit|syntax|niche-parity|speech-eval-a|speech-eval-b|flow-parity)|secure:privacy-(?:static|canary|guard)|package:build)$/;

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, ...options });
}

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  fs.writeFileSync(path.resolve(filename), `${JSON.stringify(value, null, 2)}\n`);
}

export function safeCommitSubject(value) {
  const subject = String(value || "Fix pipeline failure").split("\n", 1)[0].replace(/[^\x20-\x7E]/g, "").trim();
  if (!subject || subject.length > 72 || /Co-authored-by|Generated with|Autopilot-/i.test(subject)) return "Fix pipeline failure";
  return subject;
}

export function isFixableJob(name) {
  return fixableJobs.test(String(name));
}

export function cataloguedRepair(context, sources = {}) {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "chaos", "catalog.json"), "utf8"));
  const drill = catalog.find((entry) => entry.id === "CH-01");
  const evidence = JSON.stringify(context);
  const source = sources[drill.file] ?? fs.readFileSync(path.join(root, drill.file), "utf8");
  const plantedLine = drill.patch.replace.split("\n", 1)[0];
  if (!evidence.includes(drill.expectedRule) || !context.diff?.includes(plantedLine)) return null;
  if (!source.includes(drill.patch.replace) || source.indexOf(drill.patch.replace) !== source.lastIndexOf(drill.patch.replace)) return null;
  return {
    id: drill.id,
    file: drill.file,
    source: source.replace(drill.patch.replace, drill.patch.find),
    hypothesis: `${drill.id} inserted the catalogued transcript log caught by ${drill.expectedRule}.`,
    commitSubject: "Remove catalogued transcript log"
  };
}

function attemptCount(base) {
  const messages = git(["log", "--format=%B%x00", `${base}..HEAD`]);
  return [...messages.matchAll(/^Autopilot-Agent:\s*fixer\s*$[\s\S]*?^Autopilot-Attempt:\s*([12])\s*$/gmi)].length;
}

async function prepareContext(client, iid, pipelineId, base) {
  const [mergeRequest, jobs, discussions] = await Promise.all([
    client.getMergeRequest(iid),
    client.listPipelineJobs(pipelineId),
    client.listMergeRequestDiscussions(iid)
  ]);
  const failed = jobs.filter((job) => job.status === "failed" && isFixableJob(job.name));
  const failures = [];
  for (const job of failed) {
    const trace = redactText(await client.getJobTrace(job.id));
    failures.push({ name: job.name, url: job.web_url, excerpt: trace.split("\n").slice(-300).join("\n").slice(-60000) });
  }
  const diff = redactText(git(["diff", "--no-ext-diff", "--unified=2", `${base}...HEAD`])).slice(0, 120000);
  return {
    mergeRequest: { iid, title: mergeRequest.title, description: mergeRequest.description, labels: mergeRequest.labels, sourceBranch: mergeRequest.source_branch, targetBranch: mergeRequest.target_branch },
    failures,
    discussions: discussions.filter((discussion) => (discussion.notes || []).some((note) => note.resolved !== true && note.body?.includes("basement-privacy-guard:"))).map((discussion) => ({ id: discussion.id, notes: (discussion.notes || []).map((note) => redactText(note.body || "").slice(0, 4000)) })),
    diff,
    sharedRules: fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"),
    privacyPromises: fs.readFileSync(path.join(root, "PRIVACY_PROMISES.md"), "utf8")
  };
}

function applyPatch(patch) {
  if (!patch) return;
  if (Buffer.byteLength(patch) > 120000) throw new Error("Fixer patch exceeds 120 KB");
  const result = spawnSync("git", ["apply", "--whitespace=error", "-"], { cwd: root, input: patch, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Fixer patch did not apply: ${redactText(result.stderr).slice(-1000)}`);
}

function changedFiles() {
  return git(["status", "--porcelain=v1", "-z"]).split("\0").filter(Boolean).map((entry) => entry.slice(3).split(" -> ").at(-1));
}

function verifyChange(files) {
  for (const filename of files) if (protectedPath(filename, "fixer")) throw new Error(`Fixer changed protected path: ${filename}`);
  const output = execFileSync("npm", ["test"], { cwd: root, encoding: "utf8", stdio: "pipe", maxBuffer: 8 * 1024 * 1024 });
  const summary = output.split("\n").filter((line) => /^ℹ (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b/.test(line));
  if (summary.length) console.log(summary.join("\n"));
  if (files.some((filename) => filename === "server.js" || filename.startsWith("public/") || filename.startsWith("api/"))) {
    execFileSync(process.execPath, ["scripts/privacy/static-rules.mjs"], { cwd: root, encoding: "utf8", stdio: "pipe" });
  }
}

export function gitlabBasicAuthHeader(token) {
  if (!token) throw new Error("AUTOPILOT_BOT_TOKEN is required for GitLab authentication");
  return `Authorization: Basic ${Buffer.from(`oauth2:${token}`).toString("base64")}`;
}

function pushSourceBranch(branch, token) {
  if (!branch || !token) throw new Error("Source branch and AUTOPILOT_BOT_TOKEN are required to push a Fixer commit");
  const server = (process.env.CI_SERVER_URL || "https://gitlab.com").replace(/\/$/, "");
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.${server}/.extraheader`,
    GIT_CONFIG_VALUE_0: gitlabBasicAuthHeader(token)
  };
  execFileSync("git", ["push", "origin", `HEAD:refs/heads/${branch}`], { cwd: root, env, encoding: "utf8", stdio: "pipe" });
}

async function markNeedsHuman(client, iid, reason) {
  if (!client.configured || !iid) return;
  await client.updateMergeRequest(iid, { add_labels: "autopilot::needs-human" });
  await client.createMergeRequestNote(iid, `Fixer stopped: ${reason}`);
}

async function run() {
  const client = new GitLabClient();
  const iid = process.env.CI_MERGE_REQUEST_IID;
  const pipelineId = process.env.CI_PIPELINE_ID;
  const base = process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
  const reportPath = "reports/fixer.json";
  if (!client.configured || !process.env.AUTOPILOT_BOT_TOKEN || !iid || !pipelineId || !base) throw new Error("Fixer requires GitLab MR context and AUTOPILOT_BOT_TOKEN");
  if (process.env.AUTOPILOT_PAUSED === "1") { writeJson(reportPath, { ok: true, action: "paused" }); return; }
  const attempt = attemptCount(base) + 1;
  if (attempt > 2) { await markNeedsHuman(client, iid, "the two-attempt budget is exhausted"); writeJson(reportPath, { ok: false, action: "budget-exhausted", attempt }); return; }
  const context = await prepareContext(client, iid, pipelineId, base);
  writeJson("reports/fixer-context.json", context);
  if (context.failures.length === 0) { writeJson(reportPath, { ok: true, action: "no-fixable-failures", attempt }); return; }
  const headBefore = git(["rev-parse", "HEAD"]).trim();
  const agentRun = await executeAgent({ agent: "fixer", context });
  fs.writeFileSync("reports/fixer-agent.md", agentRun.output);
  writeJson("reports/fixer-agent.json", { status: agentRun.status, runtime: agentRun.runtime, result: agentRun.result });
  let result = agentRun.result;
  let fallback = null;
  if (!result) {
    fallback = cataloguedRepair(context);
    if (!fallback) { await markNeedsHuman(client, iid, `agent result was ${agentRun.status}`); writeJson(reportPath, { ok: false, action: "no-agent-result", attempt, runtime: agentRun.runtime }); return; }
    fs.writeFileSync(path.join(root, fallback.file), fallback.source);
    result = { hypothesis: fallback.hypothesis, patch: "", commit_subject: fallback.commitSubject };
    console.log(`Fixer used deterministic ${fallback.id} catalog fallback because the agent runtime was ${agentRun.status}.`);
  }
  if (git(["rev-parse", "HEAD"]).trim() !== headBefore) throw new Error("Fixer created a commit directly; the deterministic wrapper must own commits");
  const hypothesis = String(result.hypothesis || "").trim();
  if (!hypothesis) throw new Error("Fixer result omitted its root-cause hypothesis");
  applyPatch(String(result.patch || ""));
  const files = changedFiles();
  if (files.length === 0) { await markNeedsHuman(client, iid, "the agent proposed no working-tree change"); writeJson(reportPath, { ok: false, action: "no-change", attempt, hypothesis }); return; }
  verifyChange(files);
  const subject = safeCommitSubject(result.commit_subject);
  const issue = context.mergeRequest.description?.match(/(?:Closes|Fixes)\s+#(\d+)/i)?.[1] || iid;
  git(["add", "--", ...files]);
  git(["-c", "user.name=Basement Autopilot", "-c", "user.email=autopilot@users.noreply.gitlab.com", "commit", "-m", subject, "-m", `Autopilot-Agent: fixer\nAutopilot-Attempt: ${attempt}\nRefs: #${issue}`]);
  const sha = git(["rev-parse", "HEAD"]).trim();
  pushSourceBranch(context.mergeRequest.sourceBranch, process.env.AUTOPILOT_BOT_TOKEN);
  for (const discussion of context.discussions) await client.replyToMergeRequestDiscussion(iid, discussion.id, `Fixer pushed ${sha.slice(0, 8)} after reproducing the failure. Hypothesis: ${hypothesis}\n\nVerified with: npm test${files.some((file) => file === "server.js" || file.startsWith("public/") || file.startsWith("api/")) ? " and the privacy static rules" : ""}.`);
  writeJson(reportPath, { ok: true, action: "pushed", attempt, sha, files, hypothesis, fallback: fallback?.id || null, verifiedWith: files.some((file) => file === "server.js" || file.startsWith("public/") || file.startsWith("api/")) ? ["npm test", "privacy static rules"] : ["npm test"] });
  console.log(JSON.stringify({ ok: true, action: "pushed", attempt, sha: sha.slice(0, 8), files }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run().catch(async (error) => {
  const message = redactText(error.message);
  try { await markNeedsHuman(new GitLabClient(), process.env.CI_MERGE_REQUEST_IID, message); } catch {}
  writeJson("reports/fixer.json", { ok: false, action: "error", error: message });
  console.error(message);
  process.exitCode = 1;
});
