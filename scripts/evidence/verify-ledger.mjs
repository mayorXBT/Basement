import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./build-ledger.mjs";

export function verifyLedger(lines) {
  let previous = "0".repeat(64);
  for (const [index, line] of lines.entries()) {
    const { hash, prev_hash: prevHash, ...entry } = line;
    const expected = crypto.createHash("sha256").update(previous + canonicalJson(entry)).digest("hex");
    if (prevHash !== previous || hash !== expected) return { ok: false, index, expectedPrevious: previous, expectedHash: expected };
    previous = hash;
  }
  return { ok: true, entries: lines.length, head: lines.at(-1)?.hash || null };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const filename = path.resolve(process.argv[2] || "evidence-ledger.jsonl");
  const lines = fs.readFileSync(filename, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const report = verifyLedger(lines);
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
}
