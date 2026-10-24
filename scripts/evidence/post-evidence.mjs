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

export function linkedIssueIid(description) {
  return description?.match(/(?:Closes|Fixes)\s+#(\d+)/i)?.[1] || null;
}

// Posts the evidence comment on the issue the source MR closes. Maintenance MRs that link no
// issue have nowhere to post, so they are reported as skipped instead of failing main.
export async function postEvidence({ ledger, client, env = process.env, output, log = console.log }) {
  const verification = verifyLedger(ledger);
  if (!verification.ok) throw new Error("Evidence ledger verification failed before posting");
  if (!client.configured || !env.AUTOPILOT_BOT_TOKEN) throw new Error("Evidence posting requires AUTOPILOT_BOT_TOKEN");
  const mergeRequests = await client.listCommitMergeRequests(env.CI_COMMIT_SHA);
  const mergeRequest = selectSourceMergeRequest(mergeRequests, env.CI_COMMIT_SHA);
  if (!mergeRequest) throw new Error("No merge request is associated with the release commit");
  const issueIid = linkedIssueIid(mergeRequest.description);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (!issueIid) {
    log(`No linked issue (Closes #<iid>) on MR !${mergeRequest.iid}; skipping issue evidence comment and close.`);
    const report = { ok: true, status: "skipped", reason: "no-linked-issue", mergeRequestIid: mergeRequest.iid, mergeRequestUrl: mergeRequest.web_url, ledgerHead: verification.head };
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    log(JSON.stringify(report));
    return report;
  }
  const projectUrl = env.CI_PROJECT_URL;
  const issueUrl = `${projectUrl}/-/issues/${issueIid}`;
  const releaseUrl = `${projectUrl}/-/releases/${encodeURIComponent(env.RELEASE_VERSION || "")}`;
  const receiptUrl = `${env.CI_JOB_URL}/artifacts/file/privacy-receipt.md`;
  const body = evidenceComment({ issueUrl, mergeRequestUrl: mergeRequest.web_url, releaseUrl, receiptUrl, ledger, pipelineUrl: env.CI_PIPELINE_URL, governJobUrl: env.CI_JOB_URL });
  const marker = `<!-- basement-evidence:${verification.head} -->`;
  const notes = await client.listIssueNotes(issueIid);
  const duplicate = notes.some((note) => note.body?.includes(marker));
  if (!duplicate) await client.createIssueNote(issueIid, body);
  await client.updateIssue(issueIid, { add_labels: "autopilot::shipped", state_event: "close" });
  const report = { ok: true, status: "posted", issueIid, issueUrl, mergeRequestIid: mergeRequest.iid, mergeRequestUrl: mergeRequest.web_url, releaseUrl, receiptUrl, ledgerHead: verification.head, duplicate };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  log(JSON.stringify({ ok: true, status: "posted", issueIid, ledgerHead: verification.head, duplicate }));
  return report;
}

async function main() {
  const ledgerPath = path.resolve(process.argv[2] || "evidence-ledger.jsonl");
  const output = path.resolve(process.argv[3] || "reports/post-evidence.json");
  const ledger = fs.readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  await postEvidence({ ledger, client: new GitLabClient(), output });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
