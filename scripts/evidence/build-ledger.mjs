import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stages = [".pre", "verify", "secure", "package", "review", "release", "staging", "production", "monitor", "govern", ".post", "local"];

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function orderEntries(entries) {
  return [...entries].sort((left, right) => {
    const stageOrder = stages.indexOf(left.stage) - stages.indexOf(right.stage);
    return stageOrder || String(left.started_at || "").localeCompare(String(right.started_at || "")) || String(left.job).localeCompare(String(right.job));
  });
}

export function buildLedger(entries) {
  let previous = "0".repeat(64);
  return orderEntries(entries).map((source) => {
    const { hash: _hash, prev_hash: _previous, ...entry } = source;
    const hash = crypto.createHash("sha256").update(previous + canonicalJson(entry)).digest("hex");
    const line = { ...entry, prev_hash: previous, hash };
    previous = hash;
    return line;
  });
}

export function readEntries(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort().map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = path.resolve(process.argv[2] || "evidence");
  const output = path.resolve(process.argv[3] || "evidence-ledger.jsonl");
  const ledger = buildLedger(readEntries(input));
  fs.writeFileSync(output, ledger.map((entry) => JSON.stringify(entry)).join("\n") + (ledger.length ? "\n" : ""));
  console.log(JSON.stringify({ entries: ledger.length, head: ledger.at(-1)?.hash || null }));
}
