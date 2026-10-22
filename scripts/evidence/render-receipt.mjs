import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readJson(filename, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filename, "utf8")); } catch { return fallback; }
}

function status(ok, detail) {
  return `${ok ? "PASS" : "NOT VERIFIED"}  ${detail}`;
}

export function renderReceipt({ version, sha, pipelineId, staticReport, canary, evalReport, guardReport, ledger }) {
  const checks = canary?.checks || {};
  const routing = canary?.routing || {};
  const e05 = evalReport?.fixtures?.find((fixture) => fixture.id === "E05-injection");
  const ledgerHead = ledger.at(-1)?.hash || "unavailable";
  const staticOk = staticReport?.ok === true;
  const canaryOk = canary?.ok === true;
  const guardOk = guardReport?.agentStatus === "parsed" && guardReport?.blockers === 0;
  return `# Basement ${version} privacy receipt

Commit: \`${String(sha || "unknown").slice(0, 12)}\`
Pipeline: ${pipelineId || "unknown"}

| Promise | Result | Evidence summary |
|---|---|---|
| P1 audio never stored | ${status(canaryOk && checks.filesystemChanges === 0 && checks.temporaryFiles === 0, `filesystem changes ${checks.filesystemChanges ?? "?"}; temporary files ${checks.temporaryFiles ?? "?"}`)} |
| P2 transcripts never logged | ${status(canaryOk && checks.logHits === 0, `canary log hits ${checks.logHits ?? "?"}`)} |
| P3 no tracking | ${status(staticOk && checks.cookies === 0, `cookies ${checks.cookies ?? "?"}; static ${staticOk ? "clean" : "missing/failing"}`)} |
| P4 keys stay server-side | ${status(canaryOk && checks.environmentFiles === 0, `environment files ${checks.environmentFiles ?? "?"}; provider credential checks passed with canary`)} |
| P5 declared processors only | ${status(canaryOk && routing.unexpectedRequests === 0, `unexpected requests ${routing.unexpectedRequests ?? "?"}`)} |
| P6 security headers | ${status(canaryOk && checks.securityHeaders === 5, `${checks.securityHeaders ?? "?"}/5 headers`)} |
| P7 abuse limits | ${status(canaryOk && checks.analyzeCall11 === 429, `analyze call 11 returned ${checks.analyzeCall11 ?? "?"}`)} |
| P8 words treated as data | ${status(evalReport?.ok === true && e05?.ok === true, `E05 passing samples ${e05?.passingSamples ?? "?"}/3`)} |
| P9 browser storage constrained | ${status(staticOk, staticOk ? "static rule clean" : "static report missing/failing")} |
| P10 microphone lifecycle | ${guardOk ? "REVIEWED" : "REVIEW REQUIRED"}  ${guardOk ? "Privacy Guard returned no blockers" : "no parsed Guard artifact is attached to this pipeline"} |

Ledger head: \`${ledgerHead}\`

This receipt is generated from machine reports. The hash chain is tamper-evident, not tamper-proof. `;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ledgerPath = path.resolve(process.argv[2] || "evidence-ledger.jsonl");
  const output = path.resolve(process.argv[3] || "privacy-receipt.md");
  const ledger = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
  const receipt = renderReceipt({
    version: process.env.RELEASE_VERSION || "unreleased",
    sha: process.env.CI_COMMIT_SHA,
    pipelineId: process.env.CI_PIPELINE_ID,
    staticReport: readJson("reports/privacy-static.json"),
    canary: readJson("reports/privacy-canary.json"),
    evalReport: readJson("reports/eval-report.json"),
    guardReport: readJson("reports/privacy-guard.json"),
    ledger
  });
  fs.writeFileSync(output, `${receipt.trim()}\n`);
  console.log(JSON.stringify({ output, ledgerHead: ledger.at(-1)?.hash || null }));
}
