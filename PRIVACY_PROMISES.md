# Basement privacy promises

Basement is useful only if people can practise speaking without their voice or words being retained, exposed, or repurposed. These promises are product requirements and release gates.

Checks use four layers: static source inspection (**S**), a container runtime canary against fake providers (**R**), a live environment probe (**L**), and Privacy Guard review (**A**). A missing check is not a pass.

| ID | Promise to speakers | Required checks |
|---|---|---|
| P1 | Audio is handled in memory and is never written to disk, a database, or object storage. | **S** `PG-FS-01`; **R** container filesystem diff and empty temporary storage; **A** review new storage code or SDKs. |
| P2 | Transcripts, topics, audio, and request bodies are never logged. | **S** `PG-LOG-01`; **R** unique canary has zero container-log hits; **L** live canary query when logging access exists; **A** review errors and logging calls. |
| P3 | There are no accounts, tracking cookies, analytics, or third-party browser scripts. | **S** `PG-TRACK-01`; **R/L** no `Set-Cookie`; **A** review client dependencies and external scripts. |
| P4 | Provider keys stay on the server and never appear in browser code, responses, URLs, or image layers. | **S** `PG-KEY-01` and `PG-KEY-02`; **R** fake providers see keys only in headers, health schema is exact, and image contains no environment files; **A** review error paths. |
| P5 | Audio is sent only to Deepgram or Groq, and transcripts are sent only to Gemini. No other service receives speech data. | **S** `PG-EGRESS-01`; **R** isolated fake-provider routing recorder; **A** review every new outbound call. |
| P6 | The content security policy, frame denial, MIME sniffing protection, no-referrer policy, and microphone permissions policy remain enabled. | **S** `PG-HDR-01`; **R/L** exact header checks on page and health routes; **A** review any relaxation. |
| P7 | Abuse and payload limits remain enforced: API 60 requests per 15 minutes, provider routes 10 per 15 minutes, JSON 128 KB, audio 25 MB. | **S** `PG-RL-01`; **R** the eleventh analyze request is rejected; **A** review proxy and limiter changes. |
| P8 | Coaching treats the transcript as quoted, untrusted data rather than instructions. | **S** `PG-PROMPT-01`; **R** injection evaluation fixture; **L** scheduled evaluation; **A** review prompt edits. |
| P9 | The browser retains only settings in local storage and the current analysis in session storage. | **S** `PG-STORE-01`; **A** review browser persistence changes. |
| P10 | The microphone is active only during a speech session, and every stop path releases its tracks. | **A** review `getUserMedia` and track lifecycle changes; targeted browser testing when these paths change. |

P1 through P9 must have at least one deterministic check when the privacy suite is complete. P10 remains behaviorally reviewed unless a reliable browser gate is added. Reports and release receipts must state the real machine-checked count rather than implying all ten are automated.

## Enforcement rules

- A release fails closed when a required deterministic check reports a finding or cannot produce valid evidence.
- Agent approval cannot override a deterministic failure.
- Privacy checks, fixtures, baselines, and this file are protected from in-product agent edits.
- Any intentional chaos drill must come from `chaos/catalog.json`, be labelled `autopilot::chaos-drill`, and be disclosed in the merge request.
- Evidence may include hashes, counts, schemas, rule identifiers, and job links. It must never include secret values, audio, transcripts, request bodies, or canary text.
