import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function loadSessionTranscript() {
  const context = { setTimeout, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "public", "session-transcript.js"), "utf8"), context);
  return context;
}

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("a transcribing snapshot is not shown as a missing live transcript", () => {
  const { transcriptBlockText } = loadSessionTranscript();
  assert.equal(
    transcriptBlockText({ transcript: "", error: "", transcribing: true, hasSignal: true }),
    "Transcribing your session…"
  );
});

test("an empty finished snapshot still says no transcript was captured", () => {
  const { transcriptBlockText } = loadSessionTranscript();
  assert.equal(transcriptBlockText({ transcript: "", error: "", transcribing: false }), "No transcript captured yet.");
});

test("spoken words win over transcribing and error copy", () => {
  const { transcriptBlockText } = loadSessionTranscript();
  assert.equal(
    transcriptBlockText({ transcript: "The useful detour.", error: "Transcription is unavailable right now.", transcribing: true }),
    "The useful detour."
  );
});

test("analysis page navigation stays closed while the server transcript is in flight", () => {
  const { canNavigateToAnalysis } = loadSessionTranscript();
  assert.equal(canNavigateToAnalysis({ transcript: "", transcribing: true }), false);
  assert.equal(canNavigateToAnalysis({ transcript: "Hello.", transcribing: false }), true);
  assert.equal(canNavigateToAnalysis(null), false);
});

test("a finished recording does not accept a stale prior session write", () => {
  const { isCurrentRecording } = loadSessionTranscript();
  const first = { token: Symbol("recording") };
  const second = { token: Symbol("recording") };
  const state = { analysisToken: second.token };
  assert.equal(isCurrentRecording(state, first), false);
  assert.equal(isCurrentRecording(state, second), true);
});

test("speech recognition start retries after InvalidStateError", () => {
  const { startSpeechRecognition } = loadSessionTranscript();
  let starts = 0;
  const recognition = {
    start() {
      starts += 1;
      if (starts < 3) throw new Error("InvalidStateError");
    }
  };
  const queued = [];
  startSpeechRecognition(recognition, () => true, (fn) => queued.push(fn));
  assert.equal(starts, 1);
  queued.shift()();
  assert.equal(starts, 2);
  queued.shift()();
  assert.equal(starts, 3);
  assert.equal(queued.length, 0);
});

test("analysis.js renders live transcript through transcriptBlockText", () => {
  assert.match(source("public/analysis.js"), /transcriptBlockText\(/);
});

test("app.js does not navigate to /analysis while transcribing", () => {
  const app = source("public/app.js");
  assert.match(app, /canNavigateToAnalysis\(/);
  assert.match(app, /isCurrentRecording\(/);
  assert.match(app, /startSpeechRecognition\(/);
  assert.match(app, /transcribing:\s*true/);
});
