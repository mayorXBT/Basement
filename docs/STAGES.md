# Basement Autopilot stage map

Basement covers the nine GitLab lifecycle stages below in source. A source link shows what is implemented; it is not proof that a job ran. Runtime evidence remains `PENDING` until the linked GitLab project has produced a real flow session, pipeline job, artifact, release, environment, or issue. Never replace `PENDING` with a URL that has not been opened and checked.

| Stage | Implementation | Creative proof | Runtime evidence |
|---|---|---|---|
| Plan | [Conductor Triage flow](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/duo/flows/conductor.yaml) | Triage names acceptance criteria, tests, risk, and privacy promises before Builder starts. | PENDING: AI Catalog session and Triage issue note |
| Create | [Conductor Builder flow](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/duo/flows/conductor.yaml) | Builder opens a bounded MR and discloses any catalogued chaos drill. | PENDING: Builder MR and flow session |
| Verify | [`verify.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/verify.yml) | Unit, syntax, parity, protected-path, and speech-coaching evaluation gates run as normal jobs. | PENDING: one successful Verify job URL |
| Secure | [`secure.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/secure.yml) | GitLab scans are joined by static privacy rules, an isolated runtime canary, and Privacy Guard review. | PENDING: one successful Secure job URL |
| Package | [`package.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/package.yml) | The tested image is pushed by commit SHA and its immutable digest is passed to deployment. | PENDING: registry job and image digest URLs |
| Release | [`release.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/release.yml) | Each release carries a privacy receipt, tamper-evident ledger, SBOM, and coaching report. | PENDING: release and asset URLs |
| Configure | [`deploy.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/deploy.yml) | GitLab OIDC exchanges for short-lived Google credentials; secrets stay in Secret Manager. | PENDING: environment, deploy job, and Cloud Run URLs |
| Monitor | [`monitor.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/monitor.yml) | Live privacy probes retry once, roll traffic back to `last-good`, then open a privacy-safe incident. | PENDING: scheduled synthetic, rollback, and incident URLs |
| Govern | [`govern.yml`](https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/.gitlab/ci/govern.yml) | A deterministic hands-off gate requires named green jobs, resolved threads, and a valid evidence chain. | PENDING: policy, evidence comment, and closed issue URLs |

## Evidence capture rule

Use one clean issue-to-production run for the stage links where possible. Open every URL before adding it here and to `PROGRESS.md`. If any stage has no run evidence at submission time, report the actual count instead of claiming 9/9.

Plan and Create come from the issue's Duo flow session. Verify through Govern come from the linked merge-request/default-branch pipelines, release, environments, and closing issue comment. The Monitor link may come from the separately disclosed fire-drill schedule because monitor pipelines intentionally run no build, release, or deploy jobs.
