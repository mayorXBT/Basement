import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scanPrivacy } from "../scripts/privacy/static-rules.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "chaos", "catalog.json"), "utf8"));

test("clean source satisfies all deterministic privacy rules", () => {
  const report = scanPrivacy(root);
  assert.deepEqual(report.findings, []);
  assert.equal(report.machineCheckedPromises, 9);
});

for (const drill of catalog) {
  test(`${drill.id} is caught by ${drill.expectedRule}`, () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), `basement-${drill.id.toLowerCase()}-`));
    try {
      for (const entry of ["server.js", "api", "lib", "public"]) {
        const source = path.join(root, entry);
        if (fs.existsSync(source)) fs.cpSync(source, path.join(temporaryRoot, entry), { recursive: true });
      }
      const target = path.join(temporaryRoot, drill.file);
      const before = fs.readFileSync(target, "utf8");
      assert.equal(before.includes(drill.patch.find), true, `${drill.id} patch anchor is stale`);
      fs.writeFileSync(target, before.replace(drill.patch.find, drill.patch.replace));
      const report = scanPrivacy(temporaryRoot);
      assert.equal(report.findings.some((finding) => finding.rule === drill.expectedRule), true, JSON.stringify(report, null, 2));
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
}
