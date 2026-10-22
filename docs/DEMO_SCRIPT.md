# Basement Autopilot demo plan

Do not record the final voiceover until every proof URL used below has been opened and added to `PROGRESS.md`. The target is 2:58 or less. Use no third-party music. Label every speed-up on screen.

## Evidence-dependent cut

The full cut requires a live GitLab flow, a successful issue-to-production run, a failed and repaired privacy drill, a release, Cloud Run, a governed closing comment, and a rollback drill. Those are currently pending. The showcase branch does have real Verify, Secure, and Package evidence in pipeline 2978492394. If the remaining proof is still missing at recording time, omit those claims and record a shorter source-and-branch-pipeline walkthrough. Never stage activity or describe a manual job as automatic.

| Time | Voiceover | On-screen proof | Required evidence |
|---|---|---|---|
| 0:00-0:15 | “This is Basement. Spin a topic, talk for a minute, and get coached without an account.” | Live app, short owner speech, feedback page | Opened live URL; owner-approved speech |
| 0:15-0:30 | “The old version deployed from GitHub with no CI. Its privacy promises were words, not gates.” | Original commit and old README | Original commit `91810f0` |
| 0:30-0:42 | “Now I open one labelled issue and leave.” | Create the approved demo issue, then no further owner actions | Issue activity log |
| 0:42-0:58 | “Duo plans the work and opens the merge request.” | Triage note, Builder MR, AI session | Flow session and MR URLs |
| 0:58-1:25 | “This disclosed drill adds one catalogued transcript log. Static rules and the container canary stop it.” | Red Secure jobs and exact Guard thread | Failed job and thread URLs |
| 1:25-1:45 | “The bounded Fixer repairs the root cause. The same gates rerun before merge.” | Fixer reply and commit, resolved thread, green pipeline | Repair commit and rerun URLs |
| 1:45-2:00 | “The pipeline also replays six synthetic speeches, including an instruction-injection case.” | Eval report with six passing rows | Report artifact URL; say synthetic |
| 2:00-2:20 | “A green merge creates the receipt and release, checks staging, and reaches production only after policy passes.” | Release assets, staging smoke, policy, automatic production job | Release and job URLs |
| 2:20-2:35 | “The change is live.” | Production app showing the new Conductor-created feature | Opened Cloud Run URL |
| 2:35-2:48 | “The issue closes with its evidence. A disclosed monitor drill rolls traffic back to the recorded last-good revision.” | Evidence comment and fire-drill incident | Issue, rollback job, and incident URLs |
| 2:48-2:58 | “That is the lifecycle, from issue to evidence.” | Stage map with only proven ticks | `docs/STAGES.md` run links |

## Softened cut with branch-pipeline proof

Use this wording with the showcase pipeline, its privacy jobs, the registry push, source, and local test output:

> I built the factory for nine lifecycle stages, with agents proposing changes and deterministic jobs owning every gate. A real GitLab pipeline proves three stages today: Verify, Secure, and Package. It runs 57 tests, catches all eight privacy mutations, passes the isolated canary and six synthetic Layer A fixtures, and pushes the image by immutable digest. The Duo flow, release, Cloud Run, monitor, and governance evidence is still pending, so I am showing a supervised implementation, not a hands-off production claim.

Show pipeline 2978492394, the opened job logs linked from `docs/STAGES.md`, the actual `npm test` summary, Conductor source, privacy receipt test, and the stage map. Do not show a mock pipeline, fake job URL, fabricated issue, or edited status badge.

## Capture checklist

- Browser zoom and terminal text are readable at 1080p.
- No token, environment value, speech transcript, request body, provider response, or unredacted canary appears.
- Every browser tab shows the expected project and commit.
- Every evidence URL is opened before recording and copied into `PROGRESS.md`.
- The demo issue is created by the owner; the “Add a Job interview niche” change is never implemented by hand.
- The fire drill is visibly labelled and runs only after a verified `last-good` revision exists.
- The final title card uses the honest autonomy level and proven stage count.
- Publication to YouTube or Devpost happens only after owner approval.
