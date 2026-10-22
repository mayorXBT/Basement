import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("server, client, and HTML expose the same niche values", () => {
  const server = read("server.js");
  const topicsBody = server.match(/const topics = \{([\s\S]*?)\n\};\n\nconst allowedNiches/)?.[1] || "";
  const serverValues = [...topicsBody.matchAll(/^  (?:"([^"]+)"|([a-z][\w-]*)):\s*\[/gm)]
    .map((match) => match[1] || match[2])
    .filter((value) => value !== "deep")
    .sort();
  const clientValues = [...read("public/app.js").matchAll(/\["([a-z][\w-]*)",\s*"[^"]+",\s*"[^"]+"\]/g)]
    .map((match) => match[1])
    .sort();
  const htmlValues = [...read("public/index.html").matchAll(/<option value="([a-z][\w-]*)">/g)]
    .map((match) => match[1])
    .sort();

  assert.ok(serverValues.length > 0, "server topics were not detected");
  assert.deepEqual(clientValues, serverValues);
  assert.deepEqual(htmlValues, serverValues);
});
