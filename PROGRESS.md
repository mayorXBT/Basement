# Basement Autopilot progress

Mode: supervised | GitLab project: https://gitlab.com/mayorzeke/life-after-code | Live: https://basement.cefo.dev | Last updated: 20 Oct 2026 WAT

## Milestones

- [x] M0 setup and baseline
  - Baseline command: `npm ci && npm test`
  - Result: PASS, 10 tests, 0 failures, 0 skipped, duration 20,289 ms (20 Oct 2026 WAT).
  - Observation: four transcription cases logged expected Deepgram/Groq `fetch failed` fallbacks; the suite still passed and the unavailable calls account for most of the runtime.
- [ ] M1 GitLab home, verify, secure basics, package (local implementation complete; real GitLab pipeline and registry image blocked by missing GitLab credentials)
- [ ] M2 configure and deploy (local implementation complete; Cloud Run/WIF execution and GitLab environment evidence are approval- and credential-blocked)
- [ ] M3 privacy guard and speech eval
- [ ] M4 Duo flow, fixer, release, govern (first supervised run)
- [ ] M5 hands-off, monitor, dry runs, demo recorded
- [ ] M6 README, Devpost, video, submitted

## Claim evidence

A claim with no opened, verified link is not used.

| Claim | Status (proven / softened / cut) | Evidence link(s) | Produced in |
|---|---|---|---|
| C1 zero touches issue to prod | | | M5 |
| C2 promises machine-checked (n of 10) | | | M3 |
| C3 planted bug caught and fixed | | | M4/M5 |
| C4 chaos drill disclosed | | | M4 |
| C5 coaching regression caught | | | M3 |
| C6 guard mutation-tested | | | M3 |
| C7 9/9 stages | | | M5 |
| C8 self-healing rollback | | | M5 |
| C9 receipt and verifiable ledger | | | M4 |
| C10 Cloud Run via WIF | softened | [Cost-gated Cloud Run configuration](https://github.com/mayorXBT/Basement/tree/gitlab-autopilot/deploy/cloudrun), [WIF and deploy jobs](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/deploy.yml). No deployment, environment, or WIF job URL exists yet. | M2 |
| C11 agent threads gate merge | | | M4 |
| C12 before versus after | softened | [Before commit](https://github.com/mayorXBT/Basement/commit/91810f090ebea09ff67a724e3bb6358bc68a2fb9), [CI source after](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab-ci.yml). No GitLab pipeline link yet. | M1 |
| C13 real findings fixed (F1, F2, F4) | softened | [F1 fix and F4 parity gate](https://github.com/mayorXBT/Basement/commit/a6f2c56), [F2 proxy-aware limiter fix](https://github.com/mayorXBT/Basement/commit/faf3e3b). F2 passes unit and container probes but remains unverified on Cloud Run. | M1-M3 |

## Findings log

| ID | Status | MR | Evidence |
|---|---|---|---|
| F1 Gemini key in URL query strings | Fixed | | [Commit `a6f2c56`](https://github.com/mayorXBT/Basement/commit/a6f2c56): behavior test proves generation, catalog, and analysis calls use `x-goog-api-key` with an empty query string. |
| F2 limiter uses socket address behind proxies | Fixed locally; Cloud Run unverified | | [Commit `faf3e3b`](https://github.com/mayorXBT/Basement/commit/faf3e3b): unit and container probes show two forwarded client IPs receive separate buckets when `TRUST_PROXY=1`; live proxy behavior still needs Cloud Run evidence. |
| F3 unused `/api/auth` limiter | Noted, no change | | PRD section 5.1. |
| F4 niche list duplicated in three files | Guarded | | [Commit `a6f2c56`](https://github.com/mayorXBT/Basement/commit/a6f2c56): parity test compares server, client, and HTML values; no demo niche added by hand. |
| F5 filler regex over-counts ordinary words | Tracked, not a gate | | Planned eval precision metric. |
| F6 filler and word counters duplicated | Fixed | | [Commit `a6f2c56`](https://github.com/mayorXBT/Basement/commit/a6f2c56): client and server use `public/speech-metrics.js`. |
| F7 unreferenced `orig-index.js` | Intentionally untouched | | Owner instructed that it remain unchanged. |

## Decisions and deviations from PRD

- 20 Oct 2026: Use `https://gitlab.com/mayorzeke/life-after-code` as the temporary GitLab home because the owner explicitly selected it until the provisioned project URL arrives.
- 20 Oct 2026: Keep production deployment manual and build Cloud Run resources only as code because the owner prohibited billable resource creation without approval.
- 20 Oct 2026: Installed the Pragmatic Programmer skill at `/home/agent/.codex/skills/pragmatic-programmer` only; upstream commit `e5d025b` still has no licence file, so none of its files may enter this repository.
- 20 Oct 2026: Reused the existing remote `gitlab-autopilot` branch because evidence shows it is exactly `master` commit `91810f0` plus the PRD commit; creating a second branch would discard the provided source-of-truth file.
- 20 Oct 2026: Repaired this clone's narrow Git fetch refspec to track all GitHub branches because the requested remote branch existed but was not being fetched.
- 20 Oct 2026: Kept M1 open after completing its local code because a green GitLab pipeline, registry image, and MIT About badge are required exit evidence and cannot be replaced by local output.
- 20 Oct 2026: Updated only lockfile-compatible Express 4 dependencies after the first image build exposed one critical and three moderate advisories; the same build now reports zero vulnerabilities without a framework major upgrade.
- 20 Oct 2026: Used the current GitLab Dependency Scanning v2 template inputs for `stage: secure` and blocking failures after inspecting the live upstream template rather than relying on the PRD sketch.
- 20 Oct 2026: Kept Cloud Run private by default and every resource-creating job manual; changing `CLOUD_RUN_PUBLIC_ACCESS` or running the documented setup remains an owner approval gate.
- 20 Oct 2026: Split review, staging, and candidate smoke checks into named CI jobs so staging and production traffic moves only after a passing check; rollback targets only the recorded `last-good` tag.
- 20 Oct 2026: Left WIF, Artifact Registry, tagged revision URL queries, and same-stage GitLab `needs` behavior marked unverified because local YAML parsing and fake-gcloud tests cannot substitute for a real GitLab/GCP run.
- 20 Oct 2026: Did not apply the Cloud Run YAML templates or run any setup command; they document the intended scale-to-zero services, while CI deploys the same settings by immutable digest.

## Verification log

| Milestone | Command | Result | Evidence |
|---|---|---|---|
| Baseline | `npm ci && npm test` | PASS: 10/10 tests, 0 failures, 20,289 ms | Local run on commit `ed36b60`; no external link. |
| M0 | `npm test` | PASS: 10/10 tests, 0 failures, 20,299 ms | Local run after M0 guardrail files; external pipeline not yet available. |
| M1 app | `npm ci --ignore-scripts && npm test` | PASS: 15/15 tests, 0 failures, 672 ms | Local run; [implementation commit](https://github.com/mayorXBT/Basement/commit/a6f2c56). |
| M1 syntax | `git ls-files -z '*.js' '*.mjs' \| xargs -0 -n1 node --check` | PASS | Local run on `d3f02df`. |
| M1 dependencies | `npm audit --omit=dev` | PASS: 0 vulnerabilities | Local run after patched transitive update. |
| M1 image | Docker build plus `/api/health`, UID, `.env`, and asset probes | PASS: exact schema, UID 1000, no `.env`, metrics served | Local image `basement-autopilot:m1`; [Docker commit](https://github.com/mayorXBT/Basement/commit/dcd33d4). |
| M1 CI config | YAML parse plus exact verify commands | PASS locally; GitLab lint/pipeline not run | Blocked by missing GitLab access. |
| M2 app | `npm test` | PASS: 21/21 tests, 0 failures, 1,569 ms | Local run on `46a891c`; [rollout tests and scripts](https://github.com/mayorXBT/Basement/commit/f370412). |
| M2 dependencies | `npm audit --omit=dev` | PASS: 0 vulnerabilities | Local run on `46a891c`. |
| M2 deploy config | YAML parse with GitLab `!reference` support; `bash -n scripts/deploy/*.sh`; Node syntax checks | PASS locally; GitLab lint/pipeline not run | [CI configuration](https://github.com/mayorXBT/Basement/commit/46a891c). |
| M2 image | Build `basement-autopilot:m2`; smoke, UID, `.env`, and forwarded-IP probes | PASS: exact health schema and five headers, UID 1000, zero `.env` files, request 11 from IP A returned 429 while request 1 from IP B returned 200 | Local image `sha256:fa7aefb`; no external deployment link. |

## Blocked / needs Mayor

- GitLab contributor onboarding and Duo Agent Platform availability must be confirmed in the selected GitLab namespace before M4 can be proven.
- `GITLAB_TOKEN` is absent from this execution environment. The `gitlab` remote is configured, but authenticated read/push, MR creation, CI lint, pipelines, registry evidence, and GitLab master merges are blocked.
- Replace the GitLab remote when the hackathon-provisioned project URL is supplied.
- Cloud Run, Artifact Registry, Secret Manager, API enablement, and billing remain approval-gated. M2 will supply exact commands and cost posture but will not create resources.
- M2's exact owner-run commands and billable-resource list are in `deploy/cloudrun/README.md`; until they are approved and run, C10, live smoke, environment history, and rollback evidence remain unproven.
- Public visibility changes, demo publication, YouTube upload, and Devpost submission require explicit owner action or approval.
