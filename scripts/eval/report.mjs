import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function renderEvalReport(report) {
  const lines = [
    "# Basement coaching eval",
    "",
    `Model: \`${report.model}\` | Overall: **${report.ok ? "PASS" : "FAIL"}** | Cached fixtures: ${report.cachedFixtures}/${report.fixtures.length} | Flake rate: ${(report.flakeRate * 100).toFixed(1)}%`,
    "",
    "| Fixture | Result | Passing samples | Anchor distance | Cache |",
    "|---|---:|---:|---:|---:|"
  ];
  for (const fixture of report.fixtures) {
    lines.push(`| ${fixture.id} | ${fixture.ok ? "PASS" : "FAIL"} | ${fixture.passingSamples}/3 | ${fixture.anchorMean.toFixed(1)} | ${fixture.cached ? "hit" : "miss"} |`);
  }
  lines.push("", `Seed experiment: ${report.seedStatus}.`, "", "The gate uses 2-of-3 majority per assertion. Reports contain scores and check results, not transcripts or provider responses.", "");
  return lines.join("\n");
}

async function postMergeRequestNote(markdown) {
  const token = process.env.AUTOPILOT_BOT_TOKEN;
  const api = process.env.CI_API_V4_URL;
  const project = process.env.CI_PROJECT_ID;
  const iid = process.env.CI_MERGE_REQUEST_IID;
  if (!token || !api || !project || !iid) return { posted: false, reason: "GitLab MR credentials or context unavailable" };
  const response = await fetch(`${api}/projects/${encodeURIComponent(project)}/merge_requests/${iid}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json", "private-token": token },
    body: JSON.stringify({ body: markdown })
  });
  if (!response.ok) throw new Error(`GitLab eval note returned ${response.status}`);
  const note = await response.json();
  return { posted: true, url: note.web_url || null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportPath = path.resolve(process.argv[2] || "reports/eval-report.json");
  const outputPath = path.resolve(process.argv[3] || "reports/eval-report.md");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const markdown = renderEvalReport(report);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${markdown}\n`);
  if (process.argv.includes("--post")) console.log(JSON.stringify(await postMergeRequestNote(markdown)));
}
