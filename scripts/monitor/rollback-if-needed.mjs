import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactText } from "../privacy/redact.mjs";

export function rollbackIfNeeded(report, { service = process.env.CLOUD_RUN_SERVICE_PROD, execFile = execFileSync } = {}) {
  if (report.ok) return { ok: true, action: "not-needed", syntheticAttempts: report.attempts };
  if (!service) throw new Error("CLOUD_RUN_SERVICE_PROD is required for rollback");
  const stdout = execFile("bash", ["scripts/deploy/rollback.sh", service], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { ok: true, action: "rolled-back", service, syntheticAttempts: report.attempts, fireDrill: report.fireDrill === true, commandOutput: stdout.trim().split("\n").at(-1)?.slice(0, 300) || "completed" };
}

function main() {
  const input = path.resolve(process.argv[2] || "reports/monitor-synthetic.json");
  const output = path.resolve(process.argv[3] || "reports/monitor-rollback.json");
  const report = JSON.parse(fs.readFileSync(input, "utf8"));
  const result = rollbackIfNeeded(report);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    const output = path.resolve(process.argv[3] || "reports/monitor-rollback.json");
    const report = { ok: false, action: "rollback-failed", error: redactText(error.message) };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.error(report.error);
    process.exitCode = 1;
  }
}
