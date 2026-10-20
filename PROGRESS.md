# Basement Autopilot progress

Mode: supervised | GitLab project: https://gitlab.com/mayorzeke/life-after-code | Live: https://basement.cefo.dev | Last updated: 20 Oct 2026 WAT

## Milestones

- [ ] M0 setup and baseline
  - Baseline command: `npm ci && npm test`
  - Result: PASS, 10 tests, 0 failures, 0 skipped, duration 20,289 ms (20 Oct 2026 WAT).
  - Observation: four transcription cases logged expected Deepgram/Groq `fetch failed` fallbacks; the suite still passed and the unavailable calls account for most of the runtime.
- [ ] M1 GitLab home, verify, secure basics, package
- [ ] M2 configure and deploy
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
| C10 Cloud Run via WIF | | | M2 |
| C11 agent threads gate merge | | | M4 |
| C12 before versus after | | | M1 |
| C13 real findings fixed (F1, F2, F4) | | | M1-M3 |

## Findings log

| ID | Status | MR | Evidence |
|---|---|---|---|
| F1 Gemini key in URL query strings | Open | | `server.js` current implementation; planned M1 regression test and fix. |
| F2 limiter uses socket address behind proxies | Unverified | | Requires Cloud Run evidence; planned M2 `TRUST_PROXY=1` check. |
| F3 unused `/api/auth` limiter | Noted, no change | | PRD section 5.1. |
| F4 niche list duplicated in three files | Open | | Planned M1 parity test; no demo niche added by hand. |
| F5 filler regex over-counts ordinary words | Tracked, not a gate | | Planned eval precision metric. |
| F6 filler and word counters duplicated | Open | | Planned M1 extraction to `public/speech-metrics.js`. |
| F7 unreferenced `orig-index.js` | Intentionally untouched | | Owner instructed that it remain unchanged. |

## Decisions and deviations from PRD

- 20 Oct 2026: Use `https://gitlab.com/mayorzeke/life-after-code` as the temporary GitLab home because the owner explicitly selected it until the provisioned project URL arrives.
- 20 Oct 2026: Keep production deployment manual and build Cloud Run resources only as code because the owner prohibited billable resource creation without approval.
- 20 Oct 2026: Installed the Pragmatic Programmer skill at `/home/agent/.codex/skills/pragmatic-programmer` only; upstream commit `e5d025b` still has no licence file, so none of its files may enter this repository.
- 20 Oct 2026: Reused the existing remote `gitlab-autopilot` branch because evidence shows it is exactly `master` commit `91810f0` plus the PRD commit; creating a second branch would discard the provided source-of-truth file.
- 20 Oct 2026: Repaired this clone's narrow Git fetch refspec to track all GitHub branches because the requested remote branch existed but was not being fetched.

## Verification log

| Milestone | Command | Result | Evidence |
|---|---|---|---|
| Baseline | `npm ci && npm test` | PASS: 10/10 tests, 0 failures, 20,289 ms | Local run on commit `ed36b60`; no external link. |

## Blocked / needs Mayor

- GitLab contributor onboarding and Duo Agent Platform availability must be confirmed in the selected GitLab namespace before M4 can be proven.
- Replace the GitLab remote when the hackathon-provisioned project URL is supplied.
- Cloud Run, Artifact Registry, Secret Manager, API enablement, and billing remain approval-gated. M2 will supply exact commands and cost posture but will not create resources.
- Public visibility changes, demo publication, YouTube upload, and Devpost submission require explicit owner action or approval.
