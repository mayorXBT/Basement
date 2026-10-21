import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeAgent } from "../agents/run-agent.mjs";

const hype = /\b(?:revolutionary|game-changing|groundbreaking|amazing|incredible|best-in-class)\b/i;

export function validNotes(value) {
  const notes = String(value || "").trim();
  return Boolean(notes) && notes.split(/\s+/).length <= 120 && !hype.test(notes);
}

export function fallbackNotes(version, title) {
  const safeTitle = String(title || "A Basement update").replace(/[\r\n]+/g, " ").replace(/[`<>]/g, "").trim().slice(0, 160);
  return `${version} ships ${safeTitle}. The release pipeline checks the application, privacy invariants, container behavior, and coaching evaluation before publishing. See the attached privacy receipt for what passed and what still requires human review.`;
}

async function main() {
  const output = path.resolve(process.argv[2] || "release-notes.md");
  const reportPath = path.resolve(process.argv[3] || "reports/release-notes.json");
  const version = process.env.RELEASE_VERSION || "Unreleased";
  const title = process.env.CI_COMMIT_TITLE || execFileSync("git", ["show", "-s", "--format=%s", "HEAD"], { encoding: "utf8" }).trim();
  const context = {
    version,
    commitTitle: title,
    recentCommits: execFileSync("git", ["log", "-5", "--pretty=format:%h %s"], { encoding: "utf8" }).trim(),
    privacyStaticPassed: fs.existsSync("reports/privacy-static.json") && JSON.parse(fs.readFileSync("reports/privacy-static.json", "utf8")).ok === true,
    privacyCanaryPassed: fs.existsSync("reports/privacy-canary.json") && JSON.parse(fs.readFileSync("reports/privacy-canary.json", "utf8")).ok === true,
    coachingEvalPassed: fs.existsSync("reports/eval-report.json") && JSON.parse(fs.readFileSync("reports/eval-report.json", "utf8")).ok === true
  };
  let source = "template";
  let notes = fallbackNotes(version, title);
  try {
    const run = await executeAgent({ agent: "release-scribe", context });
    if (run.result && validNotes(run.result.notes)) { notes = run.result.notes.trim(); source = run.runtime; }
  } catch {}
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(output, `# ${version}\n\n${notes}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify({ ok: true, version, source, wordCount: notes.split(/\s+/).length }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, version, source, wordCount: notes.split(/\s+/).length }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
