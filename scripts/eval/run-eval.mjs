import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../public/speech-metrics.js";
import app, { analyzeWithGemini, getAnalysisDiagnostics } from "../../server.js";
import { renderEvalReport } from "./report.mjs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const reportsDirectory = path.join(root, "reports");
const fixtures = fs.readdirSync(path.join(root, "eval/fixtures"))
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(fs.readFileSync(path.join(root, "eval/fixtures", name), "utf8")));
const metrics = globalThis.BasementSpeechMetrics;

function ensureDirectory() {
  fs.mkdirSync(reportsDirectory, { recursive: true });
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function writeJunit(filename, suite, cases) {
  const failures = cases.filter((item) => !item.ok).length;
  const body = cases.map((item) => `<testcase name="${xmlEscape(item.name)}">${item.ok ? "" : `<failure message="${xmlEscape(item.message || "failed")}" />`}</testcase>`).join("");
  fs.writeFileSync(path.join(reportsDirectory, filename), `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${suite}" tests="${cases.length}" failures="${failures}">${body}</testsuite>\n`);
}

function deterministicResult(fixture) {
  const words = metrics.countWords(fixture.transcript);
  const fillers = metrics.countFillers(fixture.transcript);
  const wpm = metrics.computeWpm(words, fixture.durationSec);
  const local = metrics.localScores({ words, fillers, pauses: fixture.inputMetrics.pauses, wpm, hasSignal: Boolean(words) });
  const trueFillers = fixture.labels.trueFillers;
  const matchedFillers = Math.min(fillers, trueFillers);
  return {
    words, fillers, wpm, local,
    fillerPrecision: fillers ? matchedFillers / fillers : trueFillers ? 0 : 1,
    fillerRecall: trueFillers ? matchedFillers / trueFillers : 1
  };
}

async function fallbackCheck() {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const server = await new Promise((resolve) => {
    const candidate = app.listen(0, "127.0.0.1", () => resolve(candidate));
  });
  try {
    const fixture = fixtures[0];
    const actual = deterministicResult(fixture);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: fixture.topic, transcript: fixture.transcript, metrics: { ...fixture.inputMetrics, words: actual.words, fillers: actual.fillers, wpm: actual.wpm } })
    });
    const body = await response.json();
    return response.status === 200 && body.analysis === null && body.source === "local-fallback";
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  }
}

async function runLayerA() {
  ensureDirectory();
  const results = fixtures.map((fixture) => {
    const actual = deterministicResult(fixture);
    return { id: fixture.id, ok: JSON.stringify(actual.words) === JSON.stringify(fixture.expect.deterministic.words)
      && actual.fillers === fixture.expect.deterministic.fillers
      && actual.wpm === fixture.expect.deterministic.wpm
      && JSON.stringify(actual.local) === JSON.stringify(fixture.expect.deterministic.local), ...actual };
  });
  const fallback = await fallbackCheck();
  const report = { ok: results.every((item) => item.ok) && fallback, fixtures: results, fallback };
  fs.writeFileSync(path.join(reportsDirectory, "eval-layer-a.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeJunit("eval-layer-a-junit.xml", "speech-eval-a", [
    ...results.map((item) => ({ name: item.id, ok: item.ok, message: "deterministic metrics changed" })),
    { name: "no-key fallback", ok: fallback, message: "analysis fallback contract changed" }
  ]);
  console.log(JSON.stringify({ layer: "A", ok: report.ok, fixtures: results.length, fallback }));
  return report.ok;
}

function valueAt(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], object);
}

function analysisStrings(analysis) {
  return [analysis?.summary, analysis?.clarity?.feedback, analysis?.confidence?.feedback, analysis?.fillerControl?.feedback, analysis?.pace?.feedback, ...(analysis?.strengths || []), ...(analysis?.improvements || [])].filter((item) => typeof item === "string");
}

function checkSchema(analysis) {
  const scores = [analysis?.clarity?.score, analysis?.confidence?.score, analysis?.fillerControl?.score, analysis?.pace?.score];
  return typeof analysis?.summary === "string" && analysis.summary.trim().length > 0
    && scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 100)
    && Number.isFinite(analysis?.pace?.wpm)
    && [analysis?.clarity?.feedback, analysis?.confidence?.feedback, analysis?.fillerControl?.feedback, analysis?.pace?.feedback].every((item) => typeof item === "string" && item.trim())
    && [analysis?.strengths, analysis?.improvements].every((list) => Array.isArray(list) && list.length >= 1 && list.length <= 3 && list.every((item) => typeof item === "string" && item.trim()));
}

function checkGrounding(analysis, fixture, deterministic) {
  const strings = analysisStrings(analysis);
  const measurements = { filler: deterministic.fillers, word: deterministic.words, pause: fixture.inputMetrics.pauses, wpm: deterministic.wpm, "words per minute": deterministic.wpm };
  for (const text of strings) {
    for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(fillers?|words?|pauses?|wpm|words per minute)\b/gi)) {
      const unit = match[2].toLowerCase().replace(/s$/, "");
      const expected = measurements[unit] ?? measurements[match[2].toLowerCase()];
      if (expected !== undefined && Math.abs(Number(match[1]) - expected) > (unit === "wpm" || unit === "words per minute" ? 1 : 0)) return false;
    }
    for (const match of text.matchAll(/["“]([^"”]{2,})["”]/g)) if (!fixture.transcript.toLowerCase().includes(match[1].toLowerCase())) return false;
  }
  return true;
}

function evaluateSample(analysis, fixture, deterministic) {
  const checks = { provider: Boolean(analysis), schema: checkSchema(analysis) };
  const strings = analysisStrings(analysis);
  const combined = strings.join(" ").toLowerCase();
  for (const [field, [minimum, maximum]] of Object.entries(fixture.expect.llm.bands)) {
    const value = valueAt(analysis, field);
    checks[`band:${field}`] = Number.isFinite(value) && value >= minimum && value <= maximum;
  }
  const fillerDistance = Math.abs((analysis?.fillerControl?.score ?? 1000) - deterministic.local.fillerControl);
  const paceDistance = Math.abs((analysis?.pace?.score ?? 1000) - deterministic.local.paceScore);
  checks["anchor:fillerControl"] = fillerDistance <= fixture.expect.llm.anchorTolerance;
  checks["anchor:pace"] = paceDistance <= fixture.expect.llm.anchorTolerance;
  checks.mustMention = fixture.expect.llm.mustMentionAny.some((phrase) => combined.includes(phrase.toLowerCase()));
  checks.mustNotMention = fixture.expect.llm.mustNotMention.every((phrase) => !combined.includes(phrase.toLowerCase()));
  checks.grounding = checkGrounding(analysis, fixture, deterministic);
  checks.listLengths = ["strengths", "improvements"].every((name) => {
    const [minimum, maximum] = fixture.expect.llm.listLengths[name];
    return Array.isArray(analysis?.[name]) && analysis[name].length >= minimum && analysis[name].length <= maximum;
  });
  if (fixture.expect.llm.rejectInjection) checks.rejectInjection = !combined.includes("genius") && ![analysis?.clarity?.score, analysis?.confidence?.score, analysis?.fillerControl?.score, analysis?.pace?.score].every((score) => score === 100);
  if (fixture.expect.llm.requiresUnclearSignal) checks.noInventedPraise = !(analysis?.strengths || []).join(" ").match(/great|excellent|strong content|compelling/i);
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    scores: { clarity: analysis?.clarity?.score ?? null, confidence: analysis?.confidence?.score ?? null, fillerControl: analysis?.fillerControl?.score ?? null, pace: analysis?.pace?.score ?? null, wpm: analysis?.pace?.wpm ?? null },
    anchorDistances: { fillerControl: fillerDistance, pace: paceDistance }
  };
}

function cacheKey(fixture, model) {
  const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
  return crypto.createHash("sha256").update(JSON.stringify({ model, fixture, serverSource })).digest("hex");
}

async function runLayerB() {
  ensureDirectory();
  const key = process.env.EVAL_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const model = process.env.EVAL_GEMINI_MODEL || "gemini-3.1-flash-lite";
  const baselinePath = path.resolve(process.env.EVAL_BASELINE || path.join(root, "eval/baseline.json"));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const refresh = process.env.EVAL_REFRESH === "1";
  const original = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_ANALYSIS_MODEL, config: process.env.ANALYSIS_GENERATION_CONFIG };
  if (key) process.env.GEMINI_API_KEY = key;
  process.env.GEMINI_ANALYSIS_MODEL = model;
  process.env.ANALYSIS_GENERATION_CONFIG = "deterministic";
  const evaluated = [];
  const nextBaseline = { version: 1, model, generatedAt: new Date().toISOString(), fixtures: {} };
  try {
    for (const fixture of fixtures) {
      const deterministic = deterministicResult(fixture);
      const keyHash = cacheKey(fixture, model);
      const cached = !refresh && baseline.fixtures?.[fixture.id]?.cacheKey === keyHash && baseline.fixtures[fixture.id].samples?.length === 3;
      const samples = cached ? baseline.fixtures[fixture.id].samples : [];
      if (!cached) {
        if (!key) throw new Error(`EVAL_GEMINI_API_KEY is required for uncached fixture ${fixture.id}`);
        for (let run = 0; run < 3; run += 1) {
          const analysis = await analyzeWithGemini({
            topic: fixture.topic,
            transcript: fixture.transcript,
            metrics: { ...fixture.inputMetrics, words: deterministic.words, fillers: deterministic.fillers, wpm: deterministic.wpm, transcriptionProvider: "fixture" }
          });
          samples.push(evaluateSample(analysis, fixture, deterministic));
        }
      }
      const assertionNames = [...new Set(samples.flatMap((sample) => Object.keys(sample.checks)))];
      const majorities = Object.fromEntries(assertionNames.map((name) => [name, samples.filter((sample) => sample.checks[name]).length]));
      const anchorMean = samples.reduce((total, sample) => total + sample.anchorDistances.fillerControl + sample.anchorDistances.pace, 0) / (samples.length * 2);
      const priorAnchor = baseline.fixtures?.[fixture.id]?.anchorMean;
      const regression = Number.isFinite(priorAnchor) && anchorMean > priorAnchor + 10;
      const ok = Object.values(majorities).every((passes) => passes >= 2) && !regression;
      const result = { id: fixture.id, ok, cached, passingSamples: samples.filter((sample) => sample.ok).length, majorities, anchorMean, regression };
      evaluated.push(result);
      nextBaseline.fixtures[fixture.id] = { cacheKey: keyHash, anchorMean, samples };
    }
  } finally {
    if (original.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = original.key;
    if (original.model === undefined) delete process.env.GEMINI_ANALYSIS_MODEL; else process.env.GEMINI_ANALYSIS_MODEL = original.model;
    if (original.config === undefined) delete process.env.ANALYSIS_GENERATION_CONFIG; else process.env.ANALYSIS_GENERATION_CONFIG = original.config;
  }
  const assertionVotes = evaluated.flatMap((fixture) => Object.values(fixture.majorities));
  const flakeRate = assertionVotes.filter((passes) => passes > 0 && passes < 3).length / Math.max(1, assertionVotes.length);
  const observedSeedStatus = getAnalysisDiagnostics().seedStatus;
  const seedStatus = observedSeedStatus === "unverified" ? baseline.seedStatus || "unverified" : observedSeedStatus;
  nextBaseline.seedStatus = seedStatus;
  const report = { ok: evaluated.every((item) => item.ok), model, seedStatus, cachedFixtures: evaluated.filter((item) => item.cached).length, flakeRate, fixtures: evaluated };
  fs.writeFileSync(path.join(reportsDirectory, "eval-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(reportsDirectory, "eval-report.md"), `${renderEvalReport(report)}\n`);
  fs.writeFileSync(path.join(reportsDirectory, "eval-next-baseline.json"), `${JSON.stringify(nextBaseline, null, 2)}\n`);
  writeJunit("eval-layer-b-junit.xml", "speech-eval-b", evaluated.map((item) => ({ name: item.id, ok: item.ok, message: item.regression ? "anchor distance regressed" : "an assertion failed majority vote" })));
  console.log(JSON.stringify({ layer: "B", ok: report.ok, model, fixtures: evaluated.length, cachedFixtures: report.cachedFixtures, flakeRate, seedStatus: report.seedStatus }));
  return report.ok;
}

const layer = process.argv[2] || "all";
let ok = true;
if (["a", "all"].includes(layer)) ok = await runLayerA() && ok;
if (["b", "all"].includes(layer)) ok = await runLayerB() && ok;
if (!ok) process.exitCode = 1;
