import { fileURLToPath } from "node:url";

const replacements = [
  [/BASEMENT-CANARY-[A-Za-z0-9._:-]+/g, "[REDACTED_CANARY]"],
  [/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[REDACTED_GOOGLE_KEY]"],
  [/\bglpat-[0-9A-Za-z_-]+\b/g, "[REDACTED_GITLAB_TOKEN]"],
  [/\b(?:Bearer|Token)\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, "[REDACTED_AUTHORIZATION]"],
  [/(?:x-goog-api-key|private-token|authorization)(\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]"],
  [/(?:GEMINI_API_KEY|EVAL_GEMINI_API_KEY|GITLAB_TOKEN|DUO_CLI_TOKEN|AUTOPILOT_BOT_TOKEN)(\s*[:=]\s*)[^\s,;]+/g, "$1[REDACTED]"]
];

export function redactText(value) {
  let output = String(value ?? "");
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  return output;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  process.stdout.write(redactText(input));
}
