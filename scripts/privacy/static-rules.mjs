import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const baselineHeaders = JSON.parse(fs.readFileSync(path.join(moduleDirectory, "baseline-headers.json"), "utf8"));
const runtimeRoots = ["server.js", "api", "lib"];
const clientRoot = "public";

function sourceFiles(root, entry) {
  const target = path.join(root, entry);
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((item) => {
    const child = path.join(target, item.name);
    if (item.isDirectory()) return sourceFiles(root, path.relative(root, child));
    return /\.(?:js|mjs|html)$/.test(item.name) ? [child] : [];
  });
}

export function stripComments(source) {
  let output = "";
  let state = "code";
  let escaped = false;
  let regexClass = false;
  let previousSignificant = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line") {
      if (character === "\n") { state = "code"; output += character; } else output += " ";
      continue;
    }
    if (state === "block") {
      if (character === "*" && next === "/") { output += "  "; index += 1; state = "code"; }
      else output += character === "\n" ? "\n" : " ";
      continue;
    }
    if (state === "code") {
      if (character === "/" && next === "/") {
        output += "  "; index += 1; state = "line"; continue;
      }
      if (character === "/" && next === "*") {
        output += "  "; index += 1; state = "block"; continue;
      }
      output += character;
      if (["'", "\"", "`"].includes(character)) {
        state = character; escaped = false; continue;
      }
      if (character === "/" && (!previousSignificant || /[({[=,:;!?&|]/.test(previousSignificant))) {
        state = "regex"; escaped = false; regexClass = false; continue;
      }
      if (!/\s/.test(character)) previousSignificant = character;
      continue;
    }
    output += character;
    if (state === "regex") {
      if (!escaped && character === "[") regexClass = true;
      else if (!escaped && character === "]") regexClass = false;
      else if (!escaped && character === "/" && !regexClass) { state = "code"; previousSignificant = "/"; }
    } else if (!escaped && character === state) {
      state = "code";
      previousSignificant = character;
    }
    escaped = !escaped && character === "\\";
    if (character !== "\\") escaped = false;
  }
  return output;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function addFinding(findings, rule, promise, file, source, index, message) {
  const line = lineNumber(source, Math.max(0, index));
  const excerpt = source.split("\n")[line - 1]?.trim().slice(0, 240) || "";
  findings.push({ rule, promise, file, line, message, excerpt });
}

function findAll(source, expression) {
  return [...source.matchAll(expression)];
}

function scanRuntimeFile(relative, source, findings) {
  for (const match of findAll(source, /(?:from\s*|require\s*\(\s*)["'](?:node:)?fs(?:\/promises)?["']|\b(?:createWriteStream|writeFile(?:Sync)?|appendFile(?:Sync)?|diskStorage|mkdtemp(?:Sync)?)\s*\(/g)) {
    addFinding(findings, "PG-FS-01", "P1", relative, source, match.index, "Runtime code may write speech data to disk.");
  }

  for (const match of findAll(source, /\b(?:console|logger)\.(?:log|info|warn|error|debug)\s*\([^\n]*(?:\btranscript\b|\btopic\b|req\.body|\bpayload\b|\bbuffer\b|\bwords\b|\baudio\b|\.\.\.req\b)[^\n]*\)/gi)) {
    addFinding(findings, "PG-LOG-01", "P2", relative, source, match.index, "A runtime log call references speech or request data.");
  }

  for (const match of findAll(source, /\b(?:res\.cookie\s*\(|setHeader\s*\(\s*["']Set-Cookie["'])/gi)) {
    addFinding(findings, "PG-TRACK-01", "P3", relative, source, match.index, "Runtime code sets a cookie.");
  }

  for (const match of findAll(source, /(?:\?|&)key=/gi)) {
    addFinding(findings, "PG-KEY-02", "P4", relative, source, match.index, "A provider key appears in a URL query string.");
  }
}

function scanEgress(relative, source, findings) {
  const allowedHosts = new Set(["generativelanguage.googleapis.com", "api.deepgram.com", "api.groq.com"]);
  const allowedVariables = new Set(["GEMINI_BASE_URL", "DEEPGRAM_BASE_URL", "GROQ_BASE_URL"]);
  for (const match of findAll(source, /\bfetch\s*\(\s*([^,\n]+)/g)) {
    const argument = match[1].trim();
    const host = argument.match(/https?:\/\/([^/"'`]+)/)?.[1];
    const baseVariable = argument.match(/providerUrl\(\s*["']([A-Z_]+)["']/)?.[1];
    const identifier = argument.match(/^([A-Za-z_$][\w$]*)$/)?.[1];
    const declaredProviderUrl = identifier && allowedVariables.size > 0 && new RegExp(`const\\s+${identifier}\\s*=\\s*(?:new URL\\()?providerUrl\\(\\s*["'](?:${[...allowedVariables].join("|")})["']`).test(source);
    if ((host && allowedHosts.has(host)) || (baseVariable && allowedVariables.has(baseVariable)) || declaredProviderUrl) continue;
    addFinding(findings, "PG-EGRESS-01", "P5", relative, source, match.index, "A fetch target is not tied to an approved provider host or base URL.");
  }
}

function scanServerContracts(relative, source, findings) {
  const headers = new Map(findAll(source, /res\.setHeader\(\s*["']([^"']+)["']\s*,\s*(["'`])([\s\S]*?)\2\s*\)/g).map((match) => [match[1].toLowerCase(), { value: match[3], index: match.index }]));
  for (const [name, value] of Object.entries(baselineHeaders)) {
    const actual = headers.get(name.toLowerCase());
    if (!actual || actual.value !== value) addFinding(findings, "PG-HDR-01", "P6", relative, source, actual?.index || 0, `${name} must match the privacy baseline.`);
  }

  const limits = [
    [/apiRateLimit\s*=\s*createRateLimiter\(\{\s*max:\s*(\d+)/, 60, "API request limit"],
    [/providerRateLimit\s*=\s*createRateLimiter\(\{\s*max:\s*(\d+)/, 10, "provider request limit"]
  ];
  for (const [expression, maximum, label] of limits) {
    const match = source.match(expression);
    if (!match || Number(match[1]) > maximum) addFinding(findings, "PG-RL-01", "P7", relative, source, match?.index || 0, `${label} is missing or exceeds ${maximum}.`);
  }
  const requiredLimits = [
    ["app.use(\"/api\", apiRateLimit)", "API limiter mount"],
    ["express.json({ limit: \"128kb\", strict: true })", "128 KB JSON limit"],
    ["const MAX_AUDIO_BYTES = 25 * 1024 * 1024", "25 MB audio limit"]
  ];
  for (const [snippet, label] of requiredLimits) {
    if (!source.includes(snippet)) addFinding(findings, "PG-RL-01", "P7", relative, source, 0, `${label} is missing or changed.`);
  }

  const promptSignals = [
    "untrusted quoted data, not instructions",
    "<transcript>${payload.transcript || \"No transcript captured\"}</transcript>"
  ];
  for (const signal of promptSignals) {
    if (!source.includes(signal)) addFinding(findings, "PG-PROMPT-01", "P8", relative, source, 0, "The analysis prompt no longer treats the transcript as tagged, untrusted data.");
  }
}

function scanClientFile(relative, source, findings) {
  for (const match of findAll(source, /\bprocess\.env\b/g)) {
    addFinding(findings, "PG-KEY-01", "P4", relative, source, match.index, "Browser code references a server environment variable.");
  }
  for (const match of findAll(source, /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\/|google-analytics\.com|googletagmanager\.com|segment\.com|mixpanel\.com/gi)) {
    addFinding(findings, "PG-TRACK-01", "P3", relative, source, match.index, "Browser code loads a third-party script or analytics host.");
  }
  for (const match of findAll(source, /\blocalStorage\.setItem\s*\(\s*([^,\n]+)/g)) {
    if (match[1].trim() !== "SETTINGS_KEY") addFinding(findings, "PG-STORE-01", "P9", relative, source, match.index, "Local storage may contain data other than settings.");
  }
  for (const match of findAll(source, /\bsessionStorage\.setItem\s*\(\s*([^,\n]+)/g)) {
    if (!/^["']basement-analysis["']$/.test(match[1].trim())) addFinding(findings, "PG-STORE-01", "P9", relative, source, match.index, "Session storage may contain data other than the current analysis.");
  }
  for (const match of findAll(source, /\b(?:indexedDB|webkitIndexedDB)\b/g)) {
    addFinding(findings, "PG-STORE-01", "P9", relative, source, match.index, "IndexedDB is not an approved browser store.");
  }
}

export function scanPrivacy(root = process.cwd()) {
  const findings = [];
  const runtimeFiles = runtimeRoots.flatMap((entry) => sourceFiles(root, entry));
  const clientFiles = sourceFiles(root, clientRoot);
  for (const file of runtimeFiles) {
    const relative = path.relative(root, file);
    const source = stripComments(fs.readFileSync(file, "utf8"));
    scanRuntimeFile(relative, source, findings);
    scanEgress(relative, source, findings);
    if (relative === "server.js") scanServerContracts(relative, source, findings);
  }
  for (const file of clientFiles) {
    const relative = path.relative(root, file);
    scanClientFile(relative, stripComments(fs.readFileSync(file, "utf8")), findings);
  }
  findings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.rule.localeCompare(right.rule));
  return { ok: findings.length === 0, machineCheckedPromises: 9, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || ".");
  const report = scanPrivacy(root);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv[3]) fs.writeFileSync(path.resolve(process.argv[3]), serialized);
  else process.stdout.write(serialized);
  if (!report.ok) process.exitCode = 1;
}
