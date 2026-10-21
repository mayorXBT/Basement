import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { smoke } from "./smoke.mjs";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function headers(contentType) {
  return {
    ...(contentType ? { "content-type": contentType } : {}),
    ...(process.env.CLOUD_RUN_ID_TOKEN ? { authorization: `Bearer ${process.env.CLOUD_RUN_ID_TOKEN}` } : {})
  };
}

async function jsonRequest(fetchImpl, url, body) {
  const response = await fetchImpl(url, { method: "POST", headers: headers("application/json"), body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned ${response.status}`);
  return response.json();
}

export async function runSynthetic(baseUrl, { fetchImpl = fetch, now = new Date(), audioPath = process.env.MONITOR_AUDIO_PATH } = {}) {
  const base = new URL(baseUrl);
  const fixture = JSON.parse(fs.readFileSync(path.join(root, "eval", "fixtures", "E01-clean.json"), "utf8"));
  await smoke(base, { fetchImpl });
  const spin = await jsonRequest(fetchImpl, new URL("/api/spin", base), { mode: "off-the-cuff", niche: "general" });
  if (!spin.topic || typeof spin.topic !== "string") throw new Error("spin response omitted a topic");
  const analysis = await jsonRequest(fetchImpl, new URL("/api/analyze", base), { topic: fixture.topic, transcript: fixture.transcript, metrics: { words: fixture.expect.deterministic.words, fillers: fixture.expect.deterministic.fillers, wpm: fixture.expect.deterministic.wpm, pauses: fixture.inputMetrics.pauses } });
  if (analysis.source !== "gemini" || !analysis.analysis) throw new Error("analysis did not return Gemini coaching");
  let transcription = "not-due";
  if (now.getUTCHours() % 6 === 0) {
    if (!audioPath || !fs.existsSync(audioPath)) transcription = "skipped-no-approved-clip";
    else {
      const audio = fs.readFileSync(audioPath);
      const response = await fetchImpl(new URL("/api/transcribe", base), { method: "POST", headers: headers("audio/webm"), body: audio, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`/api/transcribe returned ${response.status}`);
      const body = await response.json();
      if (!body.transcript || !body.provider) throw new Error("transcription response omitted its contract fields");
      transcription = "passed";
    }
  }
  if (process.env.MONITOR_FIRE_DRILL === "1") throw new Error("disclosed MONITOR_FIRE_DRILL forced the synthetic check to fail");
  return { ok: true, health: "passed", headers: 5, cookies: 0, spin: "passed", analyze: "passed", transcription, fixtureSha256: crypto.createHash("sha256").update(JSON.stringify(fixture)).digest("hex") };
}

async function main() {
  const baseUrl = process.argv[2];
  const output = path.resolve(process.argv[3] || "reports/monitor-synthetic.json");
  if (!baseUrl) throw new Error("usage: synthetic.mjs BASE_URL [REPORT]");
  let report;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      report = { ...(await runSynthetic(baseUrl)), attempts: attempt, fireDrill: process.env.MONITOR_FIRE_DRILL === "1" };
      break;
    } catch (error) {
      report = { ok: false, attempts: attempt, fireDrill: process.env.MONITOR_FIRE_DRILL === "1", error: String(error.message).replace(/BASEMENT-CANARY-[A-Za-z0-9._:-]+/g, "[REDACTED_CANARY]") };
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
