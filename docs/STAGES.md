# Basement Autopilot stage map

Basement covers the nine GitLab lifecycle stages below in source. A source link shows what is implemented; it is not proof that a job ran. Runtime evidence is currently 3/9: Verify, Secure, and Package. Never replace `PENDING` with a URL that has not been opened and checked.

| Stage | Implementation | Creative proof | Runtime evidence |
|---|---|---|---|
| Plan | [Conductor Triage flow](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/duo/flows/conductor.yaml) | Triage names acceptance criteria, tests, risk, and privacy promises before Builder starts. | PENDING: AI Catalog session and Triage issue note |
| Create | [Conductor Builder flow](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/duo/flows/conductor.yaml) | Builder opens a bounded MR and discloses any catalogued chaos drill. | PENDING: Builder MR and flow session |
| Verify | [`verify.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/verify.yml) | Unit, syntax, parity, protected-path, and speech-coaching evaluation gates run as normal jobs. | [Pipeline](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2978492394), [unit](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617381), [syntax](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617382), [Layer A](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617385) |
| Secure | [`secure.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/secure.yml) | GitLab scans are joined by static privacy rules, an isolated runtime canary, and Privacy Guard review. | [SAST](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617386), [Secret Detection](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617387), [Dependency Scanning](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617388), [static privacy](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617389), [runtime canary](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617390), [Privacy Guard](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17405453948) |
| Package | [`package.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/package.yml) | The tested image is pushed by commit SHA and its immutable digest is passed to deployment. | [Registry push job](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17397617391), [image repository](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/container_registry/12712400), digest `sha256:cd3dde1ea8780c3aff9b4d0840cf0e5fd715014cc16e5efd2b71fd891962a58f` |
| Release | [`release.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/release.yml) | Each release carries a privacy receipt, tamper-evident ledger, SBOM, and coaching report. | PENDING: release and asset URLs |
| Configure | [`deploy.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/deploy.yml) | GitLab records the existing Vercel production environment and checks its health, privacy headers, and cookies without provisioning infrastructure. | [Live Vercel application](https://basement.cefo.dev); PENDING: `deploy:vercel` job URL |
| Monitor | [`monitor.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/monitor.yml) | Scheduled privacy probes exercise the live Vercel application without cloud credentials. | PENDING: scheduled synthetic URL |
| Govern | [`govern.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/govern.yml) | A deterministic hands-off gate requires named green jobs, resolved threads, and a valid evidence chain. | PENDING: policy, evidence comment, and closed issue URLs |

## Evidence capture rule

Use one clean issue-to-production run for the stage links where possible. Open every URL before adding it here and to `PROGRESS.md`. If any stage has no run evidence at submission time, report the actual count instead of claiming 9/9.

Plan and Create come from the issue's Duo flow session. Verify through Govern come from linked merge-request/default-branch pipelines, releases, the Vercel environment check, scheduled monitoring, and the closing issue comment. Monitor pipelines intentionally run no build, release, or deployment jobs.

## CH-01 supervised drill

The [pipeline repair MR](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/merge_requests/2) and its [green pipeline](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2979681253) prove the repaired CI path. They do not prove the agent repair loop: the [Fixer job](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17405453954) skipped cleanly because `AUTOPILOT_BOT_TOKEN` is absent.

- CH-01 issue: PENDING
- Guard MR thread: PENDING
- Fixer commit: PENDING
- Repair MR: PENDING
- Green repair pipeline: PENDING

C3 and C11 remain softened until every drill link above exists and has been opened and checked.
