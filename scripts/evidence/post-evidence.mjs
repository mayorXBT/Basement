import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "../agents/gitlab.mjs";
import { verifyLedger } from "./verify-ledger.mjs";
import { selectSourceMergeRequest } from "./source-merge-request.mjs";

function stageLink(entries, stages) {
  const entry = entries.find((item) => stages.includes(item.stage) && item.status === "success" && item.job_url);
  return entry ? `[${entry.job}](${entry.job_url})` : "not produced";
}

export function evidenceComment({ issueUrl, mergeRequestUrl, releaseUrl, receiptUrl, ledger, pipelineUrl, governJobUrl }) {
  const head = ledger.at(-1)?.hash || "unavailable";
  return `<!-- basement-evidence:${head} -->
## Basement Autopilot evidence

The linked change completed its available deterministic gates. The privacy receipt names anything that still needs review. This ledger is tamper-evident, not tamper-proof.

| DevSecOps stage | Evidence |
|---|---|
| Plan | ${issueUrl ? `[issue](${issueUrl})` : "not produced"} |
| Create | ${mergeRequestUrl ? `[merge request](${mergeRequestUrl})` : "not produced"} |
| Verify | ${stageLink(ledger, ["verify"])} |
| Secure | ${stageLink(ledger, ["secure"])} |
| Package | ${stageLink(ledger, ["package"])} |
| Release | ${releaseUrl ? `[release](${releaseUrl})` : stageLink(ledger, ["release"])} |
| Configure | ${stageLink(ledger, ["review", "staging", "production"])} |
| Monitor | ${stageLink(ledger, ["monitor"])} |
| Govern | ${governJobUrl ? `[evidence job](${governJobUrl})` : stageLink(ledger, ["govern"])} |

- [Privacy receipt](${receiptUrl})
- [Pipeline](${pipelineUrl})
- Ledger head: \`${head}\`
`;
}

async function main() {
  const ledgerPath = path.resolve(process.argv[2] || "evidence-ledger.jsonl");
  const output = path.resolve(process.argv[3] || "reports/post-evidence.json");
  const ledger = fs.readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const verification = verifyLedger(ledger);
  if (!verification.ok) throw new Error("Evidence ledger verification failed before posting");
  const client = new GitLabClient();
  if (!client.configured || !process.env.AUTOPILOT_BOT_TOKEN) throw new Error("Evidence posting requires AUTOPILOT_BOT_TOKEN");
  const mergeRequests = await client.listCommitMergeRequests(process.env.CI_COMMIT_SHA);
  const mergeRequest = selectSourceMergeRequest(mergeRequests, process.env.CI_COMMIT_SHA);
  if (!mergeRequest) throw new Error("No merge request is associated with the release commit");
  const issueIid = mergeRequest.description?.match(/(?:Closes|Fixes)\s+#(\d+)/i)?.[1];
  if (!issueIid) throw new Error("Merge request does not identify an issue with Closes #<iid>");
  const projectUrl = process.env.CI_PROJECT_URL;
  const issueUrl = `${projectUrl}/-/issues/${issueIid}`;
  const releaseUrl = `${projectUrl}/-/releases/${encodeURIComponent(process.env.RELEASE_VERSION || "")}`;
  const receiptUrl = `${process.env.CI_JOB_URL}/artifacts/file/privacy-receipt.md`;
  const body = evidenceComment({ issueUrl, mergeRequestUrl: mergeRequest.web_url, releaseUrl, receiptUrl, ledger, pipelineUrl: process.env.CI_PIPELINE_URL, governJobUrl: process.env.CI_JOB_URL });
  const marker = `<!-- basement-evidence:${verification.head} -->`;
  const notes = await client.listIssueNotes(issueIid);
  const duplicate = notes.some((note) => note.body?.includes(marker));
  if (!duplicate) await client.createIssueNote(issueIid, body);
  await client.updateIssue(issueIid, { add_labels: "autopilot::shipped", state_event: "close" });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify({ ok: true, issueIid, issueUrl, mergeRequestUrl: mergeRequest.web_url, releaseUrl, receiptUrl, ledgerHead: verification.head, duplicate }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, issueIid, ledgerHead: verification.head, duplicate }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
