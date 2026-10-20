import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { afterEach } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const temporaryDirectories = new Set();

afterEach(() => {
  for (const directory of temporaryDirectories) fs.rmSync(directory, { recursive: true, force: true });
  temporaryDirectories.clear();
});

function fakeCloud() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "basement-gcloud-"));
  temporaryDirectories.add(directory);
  const log = path.join(directory, "calls.log");
  const executable = path.join(directory, "gcloud");
  fs.writeFileSync(executable, `#!/bin/sh
printf '%s\\n' "$*" >> "$GCLOUD_LOG"
case "$*" in
  *"tag='candidate'"*"url"*) echo "https://candidate.example.test" ;;
  *"tag='candidate'"*"revisionName"*) echo "revision-new" ;;
  *"percent=100"*) echo "revision-old" ;;
  *"tag='last-good'"*) echo "revision-old" ;;
esac
`, { mode: 0o700 });
  return { directory, log };
}

function run(script, args, cloud, extra = {}) {
  return spawnSync(path.join(root, "scripts", "deploy", script), args, {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${cloud.directory}:${process.env.PATH}`,
      GCLOUD_LOG: cloud.log,
      GCP_PROJECT_ID: "test-project",
      GCP_REGION: "europe-west1",
      CLOUD_RUN_RUNTIME_SA: "runtime@example.test",
      IMAGE_DIGEST_REF: `europe-west1-docker.pkg.dev/test/repo/app@sha256:${"a".repeat(64)}`,
      ...extra
    }
  });
}

test("Cloud Run deploy uses an immutable digest and remains private by default", () => {
  const cloud = fakeCloud();
  const result = run("cloudrun.sh", ["basement", "candidate"], cloud);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "https://candidate.example.test");
  const calls = fs.readFileSync(cloud.log, "utf8");
  assert.match(calls, /run deploy basement/);
  assert.match(calls, /--no-traffic/);
  assert.match(calls, /--no-allow-unauthenticated/);
  assert.match(calls, /TRUST_PROXY=1/);
  assert.match(calls, /GEMINI_API_KEY=gemini-api-key:latest/);
});

test("Cloud Run deploy rejects mutable image tags", () => {
  const cloud = fakeCloud();
  const result = run("cloudrun.sh", ["basement", "candidate"], cloud, { IMAGE_DIGEST_REF: "example.test/app:latest" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /immutable registry digest/);
});

test("promotion preserves the current revision as last-good before shifting traffic", () => {
  const cloud = fakeCloud();
  const result = run("promote.sh", ["basement", "candidate"], cloud);
  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(cloud.log, "utf8");
  assert.match(calls, /--update-tags=last-good=revision-old/);
  assert.match(calls, /--to-revisions=revision-new=100/);
});

test("rollback targets only the recorded last-good revision", () => {
  const cloud = fakeCloud();
  const result = run("rollback.sh", ["basement"], cloud);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(cloud.log, "utf8"), /--to-tags=last-good=100/);
});
