import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadMetrics() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "public", "speech-metrics.js"), "utf8"), context);
  return context.BasementSpeechMetrics;
}

test("speech metrics preserve the current word and filler rules", () => {
  const metrics = loadMetrics();
  const transcript = "Um, I actually like this idea, you know?";
  assert.equal(metrics.countWords(transcript), 8);
  assert.equal(metrics.countFillers(transcript), 4);
  assert.equal(metrics.computeWpm(140, 60), 140);
});

test("local scores preserve the current deterministic formulas", () => {
  const { localScores } = loadMetrics();
  assert.deepEqual(
    JSON.parse(JSON.stringify(localScores({ words: 100, fillers: 5, pauses: 2, wpm: 140, hasSignal: true }))),
    { fillerControl: 80, clarity: 67, confidence: 77, paceScore: 100 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(localScores({ words: 0, fillers: 0, pauses: 0, wpm: 0, hasSignal: false }))),
    { fillerControl: 0, clarity: 0, confidence: 0, paceScore: 0 }
  );
});
