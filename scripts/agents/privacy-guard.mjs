import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "./gitlab.mjs";
import { redactText } from "../privacy/redact.mjs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const markerPrefix = "basement-privacy-guard:";

function readJson(filename, fallback) {
  try { return JSON.parse(fs.readFileSync(path.resolve(filename), "utf8")); } catch { return fallback; }
}

function diffText(base) {
  if (!base || !/^[0-9a-f]{7,40}$/i.test(base)) throw new Error("A valid CI_MERGE_REQUEST_DIFF_BASE_SHA is required");
  const diff = execFileSync("git", ["diff", "--no-ext-diff", "--unified=1", `${base}...HEAD`, "--", "server.js", "api", "public", "package.json", "package-lock.json", "Dockerfile"], { cwd: root, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  if (Buffer.byteLength(diff) > 120000) throw new Error("Privacy review diff exceeds the 120 KB agent budget; label the merge request autopilot::needs-human");
  return redactText(diff);
}

export function validateFinding(finding) {
  return finding && typeof finding.path === "string" && !finding.path.startsWith("/") && !finding.path.includes("..")
    && Number.isInteger(finding.line) && finding.line > 0
    && /^P(?:10|[1-9])$/.test(finding.promise || "")
    && typeof finding.reason === "string" && typeof finding.fix === "string";
}

export function validateAgentFinding(finding, staticFindings = []) {
  if (!validateFinding(finding)) return false;
  if (!String(finding.rule || "").startsWith("PG-")) return true;
  return staticFindings.some((item) => item.rule === finding.rule && item.file === finding.path && item.line === finding.line);
}

function findingMarker(finding, severity) {
  const digest = crypto.createHash("sha256").update(JSON.stringify({ severity, path: finding.path, line: finding.line, promise: finding.promise, rule: finding.rule || "agent", reason: finding.reason })).digest("hex").slice(0, 16);
  return `<!-- ${markerPrefix}${digest} -->`;
}

function findingBody(finding, severity) {
  const rule = finding.rule || "agent-review";
  return `${findingMarker(finding, severity)}\n**Privacy Guard · severity::${severity} · ${finding.promise} · ${rule}**\n\n${finding.reason}\n\nExact code: \`${String(finding.quote || "not supplied").replaceAll("`", "'").slice(0, 300)}\`\n\nSmallest fix: ${finding.fix}`;
}

function positionFor(finding, refs) {
  return {
    position_type: "text",
    base_sha: refs.base_sha,
    start_sha: refs.start_sha,
    head_sha: refs.head_sha,
    new_path: finding.path,
    new_line: finding.line
  };
}

function deterministicFix(rule) {
  return ({
    "PG-FS-01": "Keep speech data in memory and remove the runtime filesystem write.",
    "PG-LOG-01": "Remove the speech-data log call; log only a fixed error category if needed.",
    "PG-TRACK-01": "Remove the cookie, analytics host, or third-party script.",
    "PG-KEY-01": "Keep the provider key in server-only code.",
    "PG-KEY-02": "Send the provider key in its approved request header, not the URL.",
    "PG-EGRESS-01": "Route the request only through an approved provider base URL.",
    "PG-HDR-01": "Restore the exact security-header baseline.",
    "PG-RL-01": "Restore the documented request, provider, JSON, or audio limit.",
    "PG-PROMPT-01": "Restore the tagged untrusted-data boundary in the coaching prompt.",
    "PG-STORE-01": "Remove the unapproved browser storage write."
  })[rule] || "Restore the deterministic privacy invariant without weakening the rule.";
}

function deterministicFindings(context) {
  return (context.deterministic?.static?.findings || []).map((finding) => ({
    path: finding.file,
    line: finding.line,
    promise: finding.promise,
    rule: finding.rule,
    quote: finding.excerpt,
    reason: finding.message,
    fix: deterministicFix(finding.rule)
  })).filter(validateFinding);
}

async function prepare(outputPath) {
  const base = process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA || process.argv[3];
  const context = {
    mergeRequest: { iid: process.env.CI_MERGE_REQUEST_IID || null, projectId: process.env.CI_PROJECT_ID || null, headSha: process.env.CI_COMMIT_SHA || null },
    deterministic: {
      static: readJson("reports/privacy-static.json", { ok: false, findings: [{ rule: "REPORT-MISSING", promise: "P1", message: "privacy-static.json is missing" }] }),
      canary: readJson("reports/privacy-canary.json", { ok: false, findings: [{ rule: "REPORT-MISSING", promise: "P1", message: "privacy-canary.json is missing" }] })
    },
    promises: fs.readFileSync(path.join(root, "PRIVACY_PROMISES.md"), "utf8"),
    diff: diffText(base)
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(context, null, 2)}\n`);
  console.log(JSON.stringify({ prepared: true, diffBytes: Buffer.byteLength(context.diff), staticOk: context.deterministic.static.ok, canaryOk: context.deterministic.canary.ok }));
}

async function apply(contextPath, agentResultPath, reportPath) {
  const context = readJson(contextPath, null);
  const agentRun = readJson(agentResultPath, { status: "missing", runtime: "unknown", result: null });
  if (!context) throw new Error("Privacy Guard context is missing");
  const result = agentRun.result && typeof agentRun.result === "object" ? agentRun.result : {};
  const staticFindings = context.deterministic?.static?.findings || [];
  const validAgentFinding = (finding) => validateAgentFinding(finding, staticFindings);
  const agentBlockers = Array.isArray(result.blockers) ? result.blockers.filter(validAgentFinding) : [];
  const notes = Array.isArray(result.notes) ? result.notes.filter(validAgentFinding) : [];
  const invalidFindings = [...(Array.isArray(result.blockers) ? result.blockers : []), ...(Array.isArray(result.notes) ? result.notes : [])].length - agentBlockers.length - notes.length;
  const blockers = [...deterministicFindings(context), ...agentBlockers];
  const client = new GitLabClient();
  const iid = process.env.CI_MERGE_REQUEST_IID;
  let posted = 0;
  let resolved = 0;
  let existingUnresolvedBlockers = 0;
  if (client.configured && iid) {
    const discussions = await client.listMergeRequestDiscussions(iid);
    const versions = await client.listMergeRequestVersions(iid);
    const latest = versions[0];
    const refs = {
      base_sha: latest?.base_commit_sha || process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA,
      start_sha: latest?.start_commit_sha || process.env.CI_MERGE_REQUEST_TARGET_BRANCH_SHA || process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA,
      head_sha: latest?.head_commit_sha || process.env.CI_COMMIT_SHA
    };
    const activeStaticRules = new Set((context.deterministic?.static?.findings || []).map((finding) => `${finding.rule}:${finding.file}`));
    for (const discussion of discussions) {
      const guardNote = (discussion.notes || []).find((note) => note.body?.includes(`<!-- ${markerPrefix}`) && note.body?.includes("severity::block"));
      const rule = guardNote?.body?.match(/·\s+(PG-[A-Z-]+-\d+)\*\*/)?.[1];
      const file = guardNote?.position?.new_path || guardNote?.position?.old_path;
      if (guardNote && rule && guardNote.resolved !== true && !activeStaticRules.has(`${rule}:${file}`)) {
        const jobLink = process.env.CI_JOB_URL ? ` by ${process.env.CI_JOB_URL}` : "";
        await client.replyToMergeRequestDiscussion(iid, discussion.id, `Verified ${rule} now passes${jobLink}.`);
        await client.resolveMergeRequestDiscussion(iid, discussion.id);
        guardNote.resolved = true;
        resolved += 1;
      }
    }
    const markerBodies = new Set(discussions.flatMap((discussion) => discussion.notes || []).map((note) => note.body || ""));
    existingUnresolvedBlockers = discussions.filter((discussion) => (discussion.notes || []).some((note) => note.body?.includes(`<!-- ${markerPrefix}`) && note.body?.includes("severity::block") && note.resolved !== true)).length;
    for (const [finding, severity] of [...blockers.map((item) => [item, "block"]), ...notes.map((item) => [item, "note"])]) {
      const body = findingBody(finding, severity);
      const marker = body.match(/<!-- [^>]+ -->/)?.[0];
      if ([...markerBodies].some((existing) => marker && existing.includes(marker))) continue;
      try {
        await client.createMergeRequestDiscussion(iid, body, positionFor(finding, refs));
      } catch (error) {
        await client.createMergeRequestNote(iid, `${body}\n\nThis finding could not be anchored to a changed line: ${error.message}`);
      }
      posted += 1;
    }
  }
  const staticOk = context.deterministic?.static?.ok === true;
  const canaryOk = context.deterministic?.canary?.ok === true;
  const ok = staticOk && canaryOk && blockers.length === 0 && existingUnresolvedBlockers === 0;
  const report = { ok, runtime: agentRun.runtime, agentStatus: invalidFindings ? "invalid-result" : agentRun.status, staticOk, canaryOk, blockers: blockers.length, notes: notes.length, invalidFindings, existingUnresolvedBlockers, posted, resolved, gitlabConfigured: client.configured };
  fs.writeFileSync(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (!ok) process.exitCode = 1;
}

const command = process.argv[2];
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (command === "prepare") prepare(process.argv[4] || "reports/privacy-guard-context.json").catch((error) => { console.error(error.message); process.exitCode = 1; });
  else if (command === "apply") apply(process.argv[3] || "reports/privacy-guard-context.json", process.argv[4] || "reports/privacy-guard-agent.json", process.argv[5] || "reports/privacy-guard.json").catch((error) => { console.error(error.message); process.exitCode = 1; });
  else { console.error("Usage: privacy-guard.mjs prepare <base-sha> <output> | apply <context> <agent-result> <report>"); process.exitCode = 1; }
}
