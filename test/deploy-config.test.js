import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (filename) => fs.readFileSync(path.join(root, filename), "utf8");

test("production stage points at the existing Vercel deployment", () => {
  const source = read(".gitlab/ci/deploy.yml");
  assert.match(source, /^deploy:vercel:/m);
  assert.match(source, /https:\/\/basement\.cefo\.dev/);
  assert.match(source, /node scripts\/monitor\/smoke\.mjs/);
});

test("deployment CI contains no Google Cloud authentication or approval gate", () => {
  const source = read(".gitlab/ci/deploy.yml");
  assert.doesNotMatch(source, /gcloud|GCP_|id_tokens|workload.identity|artifact.registry|cloud.run/i);
});

test("scheduled monitoring targets Vercel without cloud credentials", () => {
  const source = read(".gitlab/ci/monitor.yml");
  assert.match(source, /VERCEL_PRODUCTION_URL: https:\/\/basement\.cefo\.dev/);
  assert.doesNotMatch(source, /gcloud|GCP_|CLOUD_RUN|id_tokens/i);
});

test("package build does not download unrelated prior-stage artifacts", () => {
  const source = read(".gitlab/ci/package.yml");
  assert.match(source, /^  dependencies: \[\]$/m);
});

test("retired Google Cloud deployment assets are absent", () => {
  for (const filename of ["deploy/cloudrun/README.md", "deploy/cloudrun/service-prod.yaml", "deploy/cloudrun/service-staging.yaml", "scripts/deploy/cloudrun.sh", "scripts/deploy/promote.sh", "scripts/deploy/rollback.sh", "scripts/deploy/tag-url.sh"]) {
    assert.equal(fs.existsSync(path.join(root, filename)), false, filename);
  }
});

test("schedule pipelines run the monitor without a PIPELINE_KIND variable", () => {
  const monitorRule = `'$CI_PIPELINE_SOURCE == "schedule" && $PIPELINE_KIND != "nightly-eval"'`;
  for (const filename of [".gitlab-ci.yml", ".gitlab/ci/monitor.yml", ".gitlab/ci/deploy.yml", ".gitlab/ci/release.yml", ".gitlab/ci/govern.yml", ".gitlab/ci/secure.yml", ".gitlab/ci/verify.yml"]) {
    const source = read(filename);
    assert.ok(source.includes(monitorRule), filename);
    assert.doesNotMatch(source, /\$PIPELINE_KIND == "monitor"/, filename);
  }
});
