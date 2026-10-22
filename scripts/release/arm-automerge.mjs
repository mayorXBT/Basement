import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "../agents/gitlab.mjs";

async function main() {
  const output = path.resolve(process.argv[2] || "reports/arm-automerge.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (process.env.AUTOPILOT_PAUSED === "1") { fs.writeFileSync(output, "{\"ok\":true,\"action\":\"paused\"}\n"); return; }
  const iid = process.env.CI_MERGE_REQUEST_IID;
  const sha = process.env.CI_COMMIT_SHA;
  const client = new GitLabClient();
  if (!iid || !sha || !client.configured || !process.env.AUTOPILOT_BOT_TOKEN) throw new Error("Auto-merge requires MR context and AUTOPILOT_BOT_TOKEN");
  const response = await client.armMergeRequest(iid, sha);
  const report = { ok: true, action: "armed", iid, sha, mergeWhenPipelineSucceeds: Boolean(response.merge_when_pipeline_succeeds || response.auto_merge_enabled) };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
