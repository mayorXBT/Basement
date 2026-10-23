import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../.github/workflows/mirror-to-gitlab.yml", import.meta.url), "utf8");
const openStep = workflow.slice(workflow.indexOf("- name: Ensure GitLab merge request is open"), workflow.indexOf("- name: Arm explicitly requested GitLab merge"));

test("mirror opens the GitLab MR with the pushed commit's subject and body", () => {
  assert.match(openStep, /title="\$\(git log -1 --pretty=%s\)"/);
  assert.match(openStep, /git log -1 --pretty=%b > "\$description"/);
  assert.match(openStep, /--data-urlencode "title=\$title"/);
  assert.match(openStep, /--data-urlencode "description@\$description"/);
});

test("mirror never hard-codes an MR title", () => {
  assert.doesNotMatch(openStep, /--data-urlencode "title=[^$]/);
});

