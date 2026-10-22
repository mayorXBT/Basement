import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GitLabClient } from "../agents/gitlab.mjs";
import { executeAgent } from "../agents/run-agent.mjs";
import { redactText } from "../privacy/redact.mjs";

function readJson(filename, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filename, "utf8")); } catch { return fallback; }
}

export function incidentDescription({ pipelineId, pipelineUrl, synthetic, rollback, revisions }) {
  const failure = redactText(synthetic?.error || "synthetic monitor failed without an error summary").slice(0, 500);
  return `<!-- basement-monitor-incident:${pipelineId} -->
## Automated production incident

- Timeline: synthetic check failed after ${synthetic?.attempts || 2} attempts; rollback action was \`${rollback?.action || "unknown"}\`.
- Check: ${failure}
- Fire drill: ${synthetic?.fireDrill === true ? "yes — deliberately requested by MONITOR_FIRE_DRILL" : "no"}
- Pipeline: ${pipelineUrl || "unavailable"}
- Recent revisions: ${redactText(revisions || "unavailable").trim().slice(0, 1000)}

No speech text, audio, request body, provider response, or credential is included. The deterministic rollback runs before this issue is created.`;
}

function validNarrative(value) {
  const text = String(value || "").trim();
  return Boolean(text) && text.length <= 900 && text.split(/[.!?]+/).filter((sentence) => sentence.trim()).length <= 3;
}

async function main() {
  const synthetic = readJson(process.argv[2] || "reports/monitor-synthetic.json");
  const rollback = readJson(process.argv[3] || "reports/monitor-rollback.json");
  const output = path.resolve(process.argv[4] || "reports/monitor-incident.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (synthetic?.ok) { fs.writeFileSync(output, "{\"ok\":true,\"action\":\"not-needed\"}\n"); return; }
  if (!rollback || !["rolled-back", "rollback-failed"].includes(rollback.action)) throw new Error("Incident creation requires a deterministic rollback result");
  const client = new GitLabClient();
  if (!client.configured || !process.env.AUTOPILOT_BOT_TOKEN) throw new Error("Incident creation requires AUTOPILOT_BOT_TOKEN");
  const pipelineId = process.env.CI_PIPELINE_ID || "unknown";
  const title = `Incident: production synthetic failed in pipeline ${pipelineId}`;
  const existing = (await client.listIssues(title)).find((issue) => issue.title === title);
  let issue = existing;
  if (!issue) {
    const revisions = fs.existsSync("reports/monitor-revisions.txt") ? fs.readFileSync("reports/monitor-revisions.txt", "utf8") : "unavailable";
    issue = await client.createIssue({ title, description: incidentDescription({ pipelineId, pipelineUrl: process.env.CI_PIPELINE_URL, synthetic, rollback, revisions }), labels: "incident,autopilot" });
  }
  let narrativePosted = false;
  try {
    const run = await executeAgent({ agent: "incident", context: { synthetic: { attempts: synthetic.attempts, fireDrill: synthetic.fireDrill, error: redactText(synthetic.error || "") }, rollback, pipelineUrl: process.env.CI_PIPELINE_URL } });
    if (run.result && validNarrative(run.result.narrative)) { await client.createIssueNote(issue.iid, run.result.narrative.trim()); narrativePosted = true; }
  } catch {}
  const report = { ok: true, action: existing ? "existing" : "created", issueIid: issue.iid, issueUrl: issue.web_url, rollback: rollback.action, fireDrill: synthetic.fireDrill === true, narrativePosted };
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(redactText(error.message)); process.exitCode = 1; });
