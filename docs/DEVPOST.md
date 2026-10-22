# Basement Autopilot Devpost draft

This is a submission draft, not a published entry. Replace every `PENDING` value with an opened, verified URL before submission. If a proof remains missing, keep the softened wording below.

## Project name

Basement Autopilot

## Tagline

I open an issue and walk away. GitLab agents prepare the change, while deterministic gates protect my speech app's privacy and coaching quality.

## Inspiration

I built Basement because I wanted a place to practise talking off the cuff without anyone watching. There is no account and no saved history. You spin a topic, talk, and get feedback about filler words, pace, and pauses.

Then I realised that the two things that make Basement worth using were not covered by my original tests. I could not prove that speech stayed out of logs, and I could not tell whether a prompt change made the coaching less honest. I am one student, so I wanted the delivery system to check those promises every time.

## What it does

I create a GitLab issue with the `autopilot` label. A GitLab Duo Conductor flow is designed to plan the work and open a small merge request. The pipeline then runs:

- ordinary unit, syntax, and parity tests
- a six-fixture coaching evaluation, including prompt injection and garbled input
- GitLab SAST, Secret Detection, Dependency Scanning, and an SBOM
- static privacy rules and an isolated container canary that checks logs, disk changes, headers, cookies, rate limits, key placement, and provider routing
- a Privacy Guard review and a bounded Fixer path that cannot edit protected gates or tests
- deterministic versioning, release notes, a privacy receipt, and a hash-chained evidence ledger
- private-by-default Cloud Run staging and production jobs through short-lived Workload Identity Federation credentials
- scheduled production checks that retry once, roll back only to the recorded `last-good` revision, and then open a privacy-safe incident

Agents propose code and explanations. Normal jobs decide whether the change can ship. The default mode is supervised. Hands-off production also requires a separate cloud cost approval variable and a passing governance policy.

## How I built it

The app remains Node.js and Express. GitLab CI is split into verify, secure, package, release, configure, monitor, and govern jobs. Plan and Create come from a custom Duo flow with Triage and Builder agents. Later agents use one guarded adapter that tries Duo CLI and can fall back to Gemini when Duo is unavailable. Deterministic wrappers validate every agent result and never allow an agent to waive a failing check.

The privacy canary builds the real app container and fake Gemini, Deepgram, and Groq endpoints inside an isolated Docker network. It sends synthetic values through the real routes, records only hashes and counts, checks the container filesystem, and scans logs for a unique canary. The evaluation cache stores only redacted scoring summaries, not transcripts or raw provider output.

Cloud Run configuration targets `europe-west1`, scale to zero, immutable image digests, Secret Manager, and GitLab OIDC. The existing Vercel deployment remains untouched as the before-state and fallback.

## Before and after

Before, Basement deployed from GitHub to Vercel with no CI configuration. Tests ran only when I remembered. The privacy promises were sentences in a README, and there was no coaching regression suite.

The Autopilot branch has 57 passing tests, P1 through P9 covered by deterministic checks, P10 explicitly review-required, six synthetic coaching fixtures, eight privacy chaos mutations, and source implementations for all nine lifecycle stages. A real showcase pipeline now proves Verify, Secure, and Package, including a registry image. The proven runtime count is 3/9; Duo, release, Cloud Run, monitor, and governance links remain `PENDING`, so this is not yet a hands-off production claim.

## Challenges

The first challenge was keeping agents away from their own guardrails. Builder and Fixer cannot edit CI, privacy rules, evidence code, prompts, fixtures, baselines, or tests used as gates. Their output is treated as untrusted data and rechecked by deterministic scripts.

The second challenge was making AI evaluation stable enough to explain. Layer B runs three times, accepts a two-of-three majority, compares anchor scores with a protected baseline, and uses a redacted cache. The originally planned Gemini model was retired for new users, so the smallest live experiment selected `gemini-3.1-flash-lite` and recorded that deviation.

The remaining challenge is default-branch and deployment evidence. GitHub Actions can mirror the source branch into the showcase project, but this build environment has no GitLab API token or Duo CLI, and cloud billing is an explicit owner approval gate. I kept the remaining milestones open instead of replacing real flow, release, and deployment links with source-only claims.

## Accomplishments

- The mutation suite catches all eight catalogued privacy failures with the expected rule.
- A container canary proves zero canary log hits, zero unexpected filesystem changes, correct provider routing, five exact security headers, no cookies, and rate limiting in a local isolated run.
- The app now keeps Gemini keys in headers, shares one speech-metrics implementation, checks niche parity, and handles trusted proxy rate-limit keys behind Cloud Run configuration.
- Releases are designed to carry a privacy receipt, a tamper-evident evidence ledger, a CycloneDX SBOM, and the coaching report.
- Monitor recovery is deterministic and unit-tested before the optional Incident agent writes any narrative.

## What I learned

Autonomy is easier to trust when the model does not own the final decision. Agents are useful for planning, bounded code changes, and concise explanations. A small deterministic job is better for deciding whether a secret leaked, a promise broke, a score regressed, or a deployment may proceed.

I also learned to separate implementation evidence from run evidence. A correct-looking YAML file is not a green pipeline, and a tested rollback script is not a production rollback. Keeping that distinction visible made the project more honest and easier to debug.

## What's next

First, merge the mirrored branch into the hackathon project's default branch, validate the flow in AI Catalog, and complete one supervised issue-to-production run. After the owner approves billing, verify WIF and Cloud Run, run the disclosed rollback drill, and capture the real evidence links. Later, the privacy gates and receipt format could become a reusable GitLab CI component for other small AI applications.

## Built with

GitLab, GitLab Duo Agent Platform, GitLab CI/CD, Node.js, Express, Docker, Google Cloud Run, Artifact Registry, Secret Manager, Workload Identity Federation, Gemini, Deepgram, and Groq.

## Links

- GitLab repository: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase
- Green branch pipeline: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2978492394
- Live Cloud Run application: PENDING
- Original GitHub repository: https://github.com/mayorXBT/Basement
- Autopilot source branch: https://github.com/mayorXBT/Basement/tree/gitlab-autopilot
- Demo video: PENDING

## Submission classification

Use Path B. Claim Supervised unless C1 has a verified issue, MR, default-branch pipeline, automatic `deploy:prod` job, and live result with no human event after issue creation. Claim Most Stages Covered only as the number of stages with opened run links in `docs/STAGES.md`.
