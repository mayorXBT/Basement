import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

const protectedPrefixes = [
  ".gitlab/",
  "scripts/privacy/",
  "scripts/evidence/",
  "eval/fixtures/",
  "chaos/",
  "agents/prompts/"
];
const protectedExact = new Set([
  ".gitlab-ci.yml",
  "eval/baseline.json",
  "PRIVACY_PROMISES.md",
  "AGENTS.md",
  "LICENSE",
  "orig-index.js",
  "vercel.json",
  "api/index.js"
]);

export function protectedPath(filename, agent = "builder") {
  const normalized = filename.replaceAll("\\", "/");
  if (protectedExact.has(normalized) || protectedPrefixes.some((prefix) => normalized.startsWith(prefix))) return true;
  if (/^test\/privacy-.*\.test\.js$/.test(normalized)) return true;
  return agent === "fixer" && (normalized === "test" || normalized.startsWith("test/") || /(?:^|\/)\.test\.js$/.test(normalized));
}

function git(args, cwd = root, options = {}) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, ...options });
}

function trailer(message, name) {
  return message.match(new RegExp(`^${name}:\\s*(.+)$`, "mi"))?.[1]?.trim() || null;
}

function changedFiles(sha, cwd) {
  return git(["diff-tree", "--no-commit-id", "--name-status", "-r", "--root", sha], cwd)
    .trim().split("\n").filter(Boolean).map((line) => line.split("\t").at(-1));
}

function fileAt(revision, filename, cwd) {
  try { return git(["show", `${revision}:${filename}`], cwd, { stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; }
}

export function auditAgentCommits({ cwd = root, base, head = "HEAD", labels = "", requireAgentMetadata = /^(?:autopilot|workloads)\//.test(process.env.CI_COMMIT_REF_NAME || "") }) {
  if (!base || !/^[0-9a-f]{7,40}$/i.test(base)) throw new Error("A valid merge request base SHA is required");
  const commits = git(["rev-list", "--reverse", `${base}..${head}`], cwd).trim().split("\n").filter(Boolean);
  const catalogPath = path.join(cwd, "chaos", "catalog.json");
  const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, "utf8")) : [];
  const chaosLabel = labels.split(",").map((item) => item.trim()).includes("autopilot::chaos-drill");
  const violations = [];
  const audited = [];
  let appliedDrills = 0;
  const fixerAttempts = new Set();
  for (const sha of commits) {
    const message = git(["show", "-s", "--format=%B", sha], cwd);
    const agent = trailer(message, "Autopilot-Agent")?.toLowerCase();
    const shortSha = sha.slice(0, 8);
    if (!agent) {
      if (requireAgentMetadata) violations.push({ sha: shortSha, reason: "agent workload commit is missing the Autopilot-Agent trailer" });
      continue;
    }
    const files = changedFiles(sha, cwd);
    audited.push({ sha: shortSha, agent, files });
    if (!["builder", "fixer"].includes(agent)) violations.push({ sha: shortSha, reason: `unsupported repository-writing agent: ${agent}` });
    const subject = message.split("\n", 1)[0];
    if (subject.length > 72) violations.push({ sha: shortSha, reason: "agent commit subject exceeds 72 characters" });
    if (!trailer(message, "Refs")?.match(/^#\d+$/)) violations.push({ sha: shortSha, reason: "agent commit is missing a valid Refs: #<issue> trailer" });
    if (/Co-authored-by:|Generated with|AI attribution/i.test(message)) violations.push({ sha: shortSha, reason: "agent commit contains a forbidden attribution trailer" });
    for (const filename of files) if (protectedPath(filename, agent)) violations.push({ sha: shortSha, file: filename, reason: `${agent} changed a protected path` });
    if (agent === "fixer") {
      const attempt = Number(trailer(message, "Autopilot-Attempt"));
      if (![1, 2].includes(attempt) || fixerAttempts.has(attempt)) violations.push({ sha: shortSha, reason: "Fixer attempt must be unique and equal to 1 or 2" });
      fixerAttempts.add(attempt);
    }
    if (agent === "builder") {
      const parent = `${sha}^`;
      for (const drill of catalog) {
        if (!files.includes(drill.file)) continue;
        const before = fileAt(parent, drill.file, cwd);
        const after = fileAt(sha, drill.file, cwd);
        if (!before.includes(drill.patch.replace) && after.includes(drill.patch.replace)) appliedDrills += 1;
      }
    }
  }
  if (appliedDrills > 0 && !chaosLabel) violations.push({ reason: "a catalog drill was applied without the autopilot::chaos-drill label" });
  if (chaosLabel && audited.some((item) => item.agent === "builder") && appliedDrills !== 1) violations.push({ reason: `chaos-labelled Builder work must apply exactly one catalog drill; found ${appliedDrills}` });
  return { ok: violations.length === 0, base, head, agentCommits: audited, appliedDrills, violations };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] || process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA;
  const output = process.argv[3];
  try {
    const report = auditAgentCommits({ base, labels: process.env.CI_MERGE_REQUEST_LABELS || "" });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (output) { fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true }); fs.writeFileSync(path.resolve(output), serialized); }
    process.stdout.write(serialized);
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
