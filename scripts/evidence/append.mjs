import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function fileHashes(files = []) {
  return Object.fromEntries(files.filter((filename) => fs.existsSync(filename) && fs.statSync(filename).isFile()).map((filename) => [filename, crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex")]));
}

export function currentJobEntry({ env = process.env, artifacts = [] } = {}) {
  return {
    job: env.CI_JOB_NAME || "local",
    stage: env.CI_JOB_STAGE || "local",
    pipeline_id: env.CI_PIPELINE_ID || null,
    pipeline_url: env.CI_PIPELINE_URL || null,
    job_url: env.CI_JOB_URL || null,
    sha: env.CI_COMMIT_SHA || null,
    status: env.CI_JOB_STATUS || "running",
    started_at: env.CI_JOB_STARTED_AT || null,
    finished_at: new Date().toISOString(),
    artifact_sha256: fileHashes(artifacts),
    summary: {}
  };
}

function safeName(value) {
  return String(value || "job").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputDirectory = path.resolve(process.argv[2] || "evidence");
  const artifacts = process.argv.slice(3);
  const entry = currentJobEntry({ artifacts });
  fs.mkdirSync(outputDirectory, { recursive: true });
  const output = path.join(outputDirectory, `${safeName(entry.job)}-${process.env.CI_JOB_ID || "local"}.json`);
  fs.writeFileSync(output, `${JSON.stringify(entry, null, 2)}\n`);
  console.log(output);
}
