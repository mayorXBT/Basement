# Basement Autopilot Devpost draft

This is a submission draft, not a published entry. Every evidence URL below was opened on 24 October 2026. Three items remain explicitly `PENDING`: a Duo/AI Catalog run, a scheduled Monitor run, and the demo video.

## Project name

Basement Autopilot

## Tagline

An evidence-first GitLab delivery loop for a privacy-sensitive speech coaching app.

## Inspiration

I built Basement because I wanted a place to practise talking off the cuff without anyone watching. There is no account and no saved history. You spin a topic, talk, and get feedback about filler words, pace, and pauses.

The original app worked, but its two most important promises were not delivery gates. I could not prove that speech stayed out of logs, and I could not tell whether a prompt change made the coaching less honest. As a solo builder, I wanted the delivery system to check both promises every time.

## What it does

Basement Autopilot adds a supervised GitLab issue-to-evidence loop around the existing app:

- unit, syntax, parity, and protected-path checks
- six explicitly synthetic coaching evaluations, including prompt injection and garbled input
- GitLab SAST, Secret Detection, Dependency Scanning, static privacy rules, and an isolated runtime canary
- a Privacy Guard that creates exact-line findings and a bounded Fixer path that cannot edit protected gates or tests
- deterministic releases with a privacy receipt, hash-chained evidence ledger, CycloneDX SBOM, and coaching report
- a production-stage `deploy:vercel` job that checks the existing Vercel application without deploying it
- a governance job that posts the issue-to-production evidence and applies `autopilot::shipped` to the linked issue

A custom Duo Conductor flow is implemented for Triage and Builder, but no AI Catalog session was captured. The demonstrated CH-01 repair therefore uses the documented catalog-only fallback, and I do not claim that Duo authored the patch.

## How I built it

The app remains Node.js and Express. GitLab CI separates Verify, Secure, Package, Release, Configure, Monitor, and Govern. Agents can propose findings or bounded edits, but deterministic jobs own every pass/fail decision.

The privacy canary builds the real app with fake Gemini, Deepgram, and Groq endpoints inside an isolated Docker network. It uses synthetic values, stores only hashes and counts, checks the container filesystem, and scans logs for a unique canary. The evaluation cache stores redacted scoring summaries rather than transcripts or raw provider output.

Production remains at [basement.cefo.dev](https://basement.cefo.dev). GitLab's [`deploy:vercel` job](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17438123018) checks that existing application, its privacy headers, and its cookie contract. It does not deploy, promote, or roll back Vercel.

## Before and after

At the [original GitHub commit](https://github.com/mayorXBT/Basement/commit/91810f090ebea09ff67a724e3bb6358bc68a2fb9), Basement had no GitHub or GitLab CI workflow. Tests ran only when I invoked them, privacy promises were prose, and there was no coaching regression suite.

The current [main pipeline 2984574204](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2984574204) passed all 18 jobs across Verify, Secure, Package, Release, Configure, and Govern. Together with [issue #4](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/4), [MR !11](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/merge_requests/11), and its [evidence comment](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/4#note_4082415574), that proves eight of nine lifecycle stages. A scheduled Monitor run and Duo execution remain unproven.

## Challenges

The first challenge was keeping agents away from their own guardrails. Builder and Fixer cannot edit CI, privacy rules, evidence code, prompts, fixtures, baselines, or gate tests. Their output is untrusted and rechecked by deterministic scripts.

The second challenge was making evaluation stable enough to explain. Layer B runs three times, accepts a two-of-three majority, compares anchor scores with a protected baseline, and uses a redacted cache. The planned Gemini model was retired for new users, so a minimal experiment selected `gemini-3.1-flash-lite` and recorded the deviation.

The third challenge was making the writable repair loop work in real CI. Early runs exposed missing CA certificates and the wrong Git authentication scheme. After those factory fixes, the disclosed CH-01 drill produced a PG-LOG-01 thread, a bounded catalog-only Fixer commit, a green rerun, and a merged MR.

## Accomplishments

- [Main pipeline 2984574204](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2984574204) passed all 18 jobs, including [six synthetic Layer A evaluations](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17438123007), security/privacy gates, release, the Vercel check, and governance.
- The [disclosed CH-01 issue](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/3) produced an exact-line [Guard thread](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/merge_requests/8#note_4080377040), bounded [Fixer commit `32f47fdf`](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/commit/32f47fdf6ac532ffd7fa3a97c220901c42f7977d), and [green repair pipeline 2983272276](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2983272276) before [MR !8](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/merge_requests/8) merged.
- [Release v1.0.11](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/releases/v1.0.11) carries a [privacy receipt](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17438123017/artifacts/file/release-assets/privacy-receipt.md), ledger, SBOM, and coaching report; its [tag pipeline](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2984578289) passed.
- Governance completed two real loops: [issue #2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/2) through [MR !6](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/merge_requests/6) and its [evidence comment](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/2#note_4076273874), then issue #4 through MR !11 and its evidence comment. In both timelines, the merge closed the issue first; `govern:evidence` then posted the receipt links and applied `autopilot::shipped`.
- The mutation suite catches all eight catalogued privacy failures with the expected rule. C11 stays softened because Guard blocked the pipeline, but the project reports that unresolved discussions do not directly block merge.

## What I learned

Autonomy is easier to trust when the model does not own the final decision. Agents are useful for bounded review and repair, while deterministic jobs decide whether a secret leaked, a privacy promise broke, a score regressed, or evidence is complete.

I also learned to separate implementation evidence from run evidence. A YAML file is not a green pipeline, and a URL check is not a deployment. That distinction kept the submission honest and made failures much easier to debug.

## What's next

Validate the Conductor flow in AI Catalog, capture a real scheduled Monitor pipeline, and record the final demo. The current submission remains Path B, Supervised; it does not claim hands-off delivery or Vercel deployment.

## Built with

GitLab, GitLab Duo Agent Platform, GitLab CI/CD, Node.js, Express, Docker, Vercel, Gemini, Deepgram, and Groq.

## Evidence links

- GitLab repository: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase
- Main pipeline, 18/18 jobs green: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2984574204
- Release v1.0.11: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/releases/v1.0.11
- CH-01 repair MR: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/merge_requests/8
- Green CH-01 rerun: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2983272276
- Governance evidence: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/4#note_4082415574
- Live Vercel application: https://basement.cefo.dev
- Autopilot source branch: https://github.com/mayorXBT/Basement/tree/gitlab-autopilot
- Demo video: PENDING — recording and publication are owner actions.

## Remaining evidence boundaries

- Duo/AI Catalog run: PENDING — the flow source exists, but there is no opened session or agent-authored Builder MR.
- Scheduled Monitor run: PENDING — the project API returned no pipeline with `source=schedule` on 24 October 2026.
- C11: softened — the Guard job blocked the failed CH-01 pipeline and its thread was resolved, but direct discussion-resolution merge blocking is not enabled.

## Submission classification

Submit to Path B as Supervised. Claim eight of nine stages with opened run or work-item evidence. Do not claim Duo execution, a scheduled monitor, hands-off operation, or that GitLab deploys the existing Vercel application.
