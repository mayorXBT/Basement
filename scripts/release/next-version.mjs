import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "../agents/gitlab.mjs";

export function nextVersion(current, labels = []) {
  const match = String(current).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid semantic version: ${current}`);
  let [, major, minor, patch] = match.map(Number);
  if (labels.includes("type::breaking")) { major += 1; minor = 0; patch = 0; }
  else if (labels.includes("type::feature")) { minor += 1; patch = 0; }
  else patch += 1;
  return `v${major}.${minor}.${patch}`;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

async function main() {
  const output = path.resolve(process.argv[2] || "release.env");
  const reportPath = path.resolve(process.argv[3] || "reports/release-version.json");
  const currentSha = process.env.CI_COMMIT_SHA || git(["rev-parse", "HEAD"]);
  const existing = git(["tag", "--points-at", currentSha, "--list", "v[0-9]*"]).split("\n").filter(Boolean).sort().at(-1);
  let labels = (process.env.RELEASE_LABELS || "").split(",").map((item) => item.trim()).filter(Boolean);
  let mergeRequestUrl = null;
  const client = new GitLabClient();
  if (!labels.length && client.configured) {
    const mergeRequests = await client.listCommitMergeRequests(currentSha);
    const merged = mergeRequests.find((item) => item.state === "merged") || mergeRequests[0];
    labels = merged?.labels || [];
    mergeRequestUrl = merged?.web_url || null;
  }
  const latest = git(["tag", "--list", "v[0-9]*", "--sort=-v:refname"]).split("\n").find(Boolean) || "v1.0.0";
  const version = existing || nextVersion(latest, labels);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(output, `RELEASE_VERSION=${version}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify({ version, previous: latest, labels, mergeRequestUrl, reusedExistingTag: Boolean(existing) }, null, 2)}\n`);
  console.log(JSON.stringify({ version, previous: latest, labels, reusedExistingTag: Boolean(existing) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
