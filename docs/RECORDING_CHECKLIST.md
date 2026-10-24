# Basement Autopilot recording checklist

Deadline: Tuesday 27 October 2026, 2:00 PM WAT. Final cut: 2:58 maximum. Submission: Path B, Supervised.

## Open these tabs in order

1. **Live Basement** — https://basement.cefo.dev
   - Confirm the page loads before recording.
   - Click **Spin**, start the timer, speak briefly, and open the feedback panel.
   - Frame only the summary and metric rows; keep the transcript section below the fold.

2. **Before commit** — https://github.com/mayorXBT/Basement/commit/91810f090ebea09ff67a724e3bb6358bc68a2fb9
   - Start at the commit header.
   - Be ready to show the old tree with no `.github/workflows` and no `.gitlab-ci.yml`.

3. **Green main pipeline** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2984574204
   - Expand or scroll through Verify, Secure, Package, Release, production, and Govern.
   - Keep the green pipeline status and all 18 successful jobs readable.

4. **CH-01 issue** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/3
   - Position the issue title and disclosed chaos-drill description in view.
   - Add the video overlay **DISCLOSED DRILL** before switching to this tab.

5. **Failed CH-01 pipeline** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2983264846
   - Position the red `secure:privacy-static`, `secure:privacy-canary`, and `secure:privacy-guard` jobs together.
   - Do not open raw logs; they are unnecessary for the proof and harder to screen for sensitive values.

6. **Guard thread on MR !8** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/merge_requests/8#note_4080377040
   - Confirm the anchor lands on PG-LOG-01.
   - Show the exact unsafe line and the resolved thread state.

7. **Fixer commit** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/commit/32f47fdf6ac532ffd7fa3a97c220901c42f7977d
   - Show the one-line deletion.
   - Scroll only far enough to show `Autopilot-Agent: fixer`, `Autopilot-Attempt: 1`, and `Refs: #3`.

8. **Green CH-01 rerun** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2983272276
   - Show the green status and the repaired commit SHA.
   - Remove the **DISCLOSED DRILL** overlay after leaving this tab.

9. **Six synthetic evaluations** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17438123007
   - Find the six-case Layer A summary before recording.
   - Keep “synthetic” in the voiceover; do not show fixture transcript bodies.

10. **Release v1.0.11** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/releases/v1.0.11
    - Position the release name and asset links in view.
    - Open **Privacy receipt** from the asset list, then return to the release page.
    - If time permits, open its passing tag pipeline: https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/pipelines/2984578289

11. **Vercel production check** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/jobs/17438123018
    - Show the green `deploy:vercel` title and the production URL.
    - Say that it checks the existing deployment; never call this job a deployment.

12. **Governance evidence on issue #4** — https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43556545/showcase/-/issues/4#note_4082415574
    - Confirm the issue is closed and `autopilot::shipped` is visible.
    - Scroll through the evidence table from Plan to Govern and the receipt/pipeline links.

13. **Final stage map** — https://github.com/mayorXBT/Basement/blob/gitlab-autopilot/docs/STAGES.md
    - Position the 8/9 summary and the table together.
    - Show eight proven rows and the pending Monitor row.
    - End on a title card: **Path B · Supervised · 8/9 proven**.

## Capture rules

- Record at 1920×1080 or higher. Browser text must remain readable at normal playback speed.
- Use a clean browser profile. Hide bookmarks, personal avatars where possible, notifications, password-manager prompts, and unrelated tabs.
- Never show tokens, CI/CD variable values, environment values, authorization headers, local `.env` files, provider responses, request bodies, or raw job logs.
- Never show a real or synthetic transcript on screen. On the live feedback panel, keep the transcript below the fold; in evaluation views, show only case names and pass summaries.
- Use no music. Keep voiceover clean and consistent.
- Label every accelerated visual segment on screen, for example **2× screen capture**. Do not speed up the voiceover.
- Keep **DISCLOSED DRILL** visible from issue #3 through the green CH-01 rerun.
- Do not describe `deploy:vercel` as deploying, promoting, or rolling back production. It is a read-only check of `basement.cefo.dev`.
- Do not claim Duo execution, an AI Catalog session, a scheduled Monitor run, direct discussion gating, hands-off autonomy, or 9/9 stages.
- Do not create or apply an `autopilot` issue label during recording.
- Before the final take, reload every tab and confirm the anchor links still land on the intended evidence.
