import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderConductorFlow } from "../scripts/agents/build-flow.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("committed Conductor flow matches its prompt sources", () => {
  const committed = fs.readFileSync(path.join(root, ".gitlab/duo/flows/conductor.yaml"), "utf8");
  assert.equal(committed, renderConductorFlow());
});

test("Conductor flow avoids fields forbidden by GitLab custom flows", () => {
  const flow = renderConductorFlow();
  assert.doesNotMatch(flow, /^name:/m);
  assert.doesNotMatch(flow, /^description:/m);
  assert.doesNotMatch(flow, /^product_group:/m);
  assert.doesNotMatch(flow, /^\s+model:/m);
  assert.doesNotMatch(flow, /response_schema_(?:id|version):/);
  assert.match(flow, /^environment: ambient$/m);
  assert.match(flow, /max_delegations: 6/);
});
