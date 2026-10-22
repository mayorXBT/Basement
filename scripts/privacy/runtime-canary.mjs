import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const baselineHeaders = JSON.parse(fs.readFileSync(path.join(root, "scripts/privacy/baseline-headers.json"), "utf8"));
const suffix = crypto.randomBytes(5).toString("hex");
const canary = `BASEMENT-CANARY-${process.env.CI_PIPELINE_ID || "local"}-${suffix}`;
const providerKey = `CANARY_KEY_${crypto.randomBytes(12).toString("hex")}`;
const network = `basement-canary-${suffix}`;
const appContainer = `basement-app-${suffix}`;
const providerContainer = `basement-providers-${suffix}`;
const appImage = process.env.CANARY_IMAGE || "basement-autopilot:canary";
const providerImage = process.env.CANARY_PROVIDER_IMAGE || "basement-fake-providers:canary";

function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", ...options });
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || result.error?.message || `status ${result.status}, signal ${result.signal || "none"}`).trim();
    throw new Error(`docker ${args.slice(0, 3).join(" ")} failed: ${detail}`);
  }
  return result;
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function junit(report) {
  const escapedError = String(report.error || "privacy canary failed")
    .replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const failure = report.ok ? "" : `<failure message="${escapedError}" />`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="privacy-canary" tests="1" failures="${report.ok ? 0 : 1}"><testcase name="container privacy promises">${failure}</testcase></testsuite>\n`;
}

async function runCanary() {
  docker(["network", "create", "--internal", network]);
  docker(["run", "--detach", "--name", providerContainer, "--network", network, "--network-alias", "fake-providers", "--env", `CANARY_VALUE=${canary}`, "--env", `CANARY_PROVIDER_KEY=${providerKey}`, providerImage]);
  docker([
    "run", "--detach", "--name", appContainer, "--network", network, "--env", "PORT=8080",
    "--env", `GEMINI_API_KEY=${providerKey}`, "--env", `DEEPGRAM_API_KEY=${providerKey}`, "--env", `GROQ_API_KEY=${providerKey}`,
    "--env", "GEMINI_MODEL=gemini-canary", "--env", "GEMINI_ANALYSIS_MODEL=gemini-canary",
    "--env", "GEMINI_BASE_URL=http://fake-providers:8081", "--env", "DEEPGRAM_BASE_URL=http://fake-providers:8081", "--env", "GROQ_BASE_URL=http://fake-providers:8081",
    appImage
  ]);
  let execReady = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (docker(["exec", appContainer, "node", "-e", "process.exit(0)"], { allowFailure: true }).status === 0) { execReady = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  ensure(execReady, "the application container did not become available for the canary client");
  const clientSource = fs.readFileSync(path.join(root, "scripts/privacy/runtime-client.mjs"), "utf8");
  const baselineHeadersBase64 = Buffer.from(JSON.stringify(baselineHeaders)).toString("base64");
  const clientResult = docker([
    "exec", "--interactive", "--env", `CANARY_VALUE=${canary}`, "--env", `BASELINE_HEADERS_B64=${baselineHeadersBase64}`,
    appContainer, "node", "--input-type=module", "-"
  ], { input: clientSource });
  const client = JSON.parse(clientResult.stdout);
  ensure(JSON.stringify(client.health) === JSON.stringify({ ok: true, geminiConfigured: true, groqConfigured: true, deepgramConfigured: true }), "health schema or provider configuration changed");
  ensure(client.cookies === 0 && client.headerMatches === client.expectedHeaderMatches, "cookies or security headers changed");
  ensure(client.spin.status === 200 && client.spin.source === "gemini", "spin did not use the Gemini stub");
  ensure(client.transcription.status === 200 && client.transcription.provider === "deepgram" && client.transcription.matchesCanary, "audio did not route through the Deepgram stub");
  ensure(client.firstAnalyze.status === 200 && client.firstAnalyze.source === "gemini", "analysis did not use the Gemini stub");
  ensure(client.analyzeCall11 === 429, "the eleventh analyze request was not rate limited");
  ensure([400, 429].includes(client.malformedStatus), "malformed JSON was not rejected");

  const providerReportOutput = docker(["exec", appContainer, "node", "-e", "fetch('http://fake-providers:8081/__report').then(r=>r.text()).then(console.log)"]).stdout;
  const providerReport = JSON.parse(providerReportOutput);
  const requests = providerReport.requests;
  ensure(requests.length > 0 && requests.every((request) => ["gemini", "deepgram", "groq"].includes(request.provider)), "an unexpected provider route was called");
  ensure(requests.every((request) => request.expectedCredential && !request.credentialInUrl && !request.credentialInBody), "a provider credential was missing or left its header");
  ensure(requests.some((request) => request.provider === "gemini" && request.canaryInBody), "the transcript canary did not reach Gemini");
  ensure(requests.some((request) => request.provider === "deepgram" && request.bodySha256 === client.audioSha256), "audio did not reach Deepgram");
  ensure(requests.every((request) => request.provider === "deepgram" || request.bodySha256 !== client.audioSha256), "audio reached a non-transcription provider");

  const logResult = docker(["logs", appContainer]);
  const logs = logResult.stdout + logResult.stderr;
  ensure(!logs.includes(canary), "the transcript canary appeared in container logs");
  ensure(docker(["diff", appContainer]).stdout.trim() === "", "the application container filesystem changed during the canary");
  ensure(docker(["exec", appContainer, "sh", "-c", "test -z \"$(find /tmp -mindepth 1 -print -quit)\""], { allowFailure: true }).status === 0, "the application wrote a temporary file");
  ensure(docker(["exec", appContainer, "sh", "-c", "test -z \"$(find /app -name '.env*' -type f -print -quit)\""], { allowFailure: true }).status === 0, "an environment file exists in the image");

  return {
    ok: true,
    canarySha256: crypto.createHash("sha256").update(canary).digest("hex"),
    checks: { logHits: 0, filesystemChanges: 0, temporaryFiles: 0, environmentFiles: 0, cookies: 0, securityHeaders: 5, analyzeCall11: 429 },
    routing: { geminiRequests: requests.filter((request) => request.provider === "gemini").length, deepgramRequests: requests.filter((request) => request.provider === "deepgram").length, groqRequests: requests.filter((request) => request.provider === "groq").length, unexpectedRequests: 0 }
  };
}

async function main() {
  const output = path.resolve(process.env.PRIVACY_CANARY_REPORT || "reports/privacy-canary.json");
  const junitOutput = path.resolve(process.env.PRIVACY_CANARY_JUNIT || "reports/privacy-canary-junit.xml");
  let report;
  try {
    report = await runCanary();
  } catch (error) {
    report = { ok: false, error: String(error.message || error).replaceAll(canary, "[CANARY]").replaceAll(providerKey, "[REDACTED]") };
  } finally {
    docker(["rm", "--force", appContainer], { allowFailure: true });
    docker(["rm", "--force", providerContainer], { allowFailure: true });
    docker(["network", "rm", network], { allowFailure: true });
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(junitOutput, junit(report));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export { runCanary };
