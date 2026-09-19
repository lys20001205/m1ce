# V11 Senior QA follow-up: C01-C03

Baseline: `84d983cc7550fff14408fa6f29950255b6e20d26`.
Scope: three narrowly evidenced QA candidates, with deterministic and browser regression coverage. This is not a full gameplay QA sign-off or a rebalance.

## Changes

- **C01 / full train:** at the existing 12-car cap (including Engine), route choice goes straight to departure. No new car is pretended to be selected, no Reroll token can be spent, and both stale rule calls and stale UI offers are guarded. The hub explains that the train is full. The final legal 11-to-12 choice still permits one normal reroll. Route repeat pressure, One More Round and Cash Out are unchanged.
- **C02 / restart hint:** the live HUD reads the existing `emergencyRepairTime`, including Emergency Repair Kit, Workshop and powered Battery bonuses. An equipped kit is labelled in the same hint. Repair timing, rescue deadlines and consumption rules are not retuned.
- **C03 / route text:** authored route content supplies the ordinary travel label: Industrial `工业装卸区`, Freight `货运堆场`, Tunnel `地下连接段`. Both the stage HUD and the ordinary segment event use it. Crane, tunnel and Stall warning priority and special messages are preserved.

## Regression coverage

`npm test` now includes `tests/qa_followup.test.mjs`: 21 focused tests covering the three full-train routes, stale/duplicate requests, final legal car selection, 14 consecutive round transitions, isolated save persistence, all eight kit/Workshop/Battery combinations, interruption, live Battery power loss, and route/hazard text.

The HUD tests execute the production `ui()` function against a minimal DOM double. They test text bindings, not layout, WebGL, sound or physical-device input. On the unchanged baseline, the focused suite yields 7 pass / 14 fail. After the fixes it yields 21 pass / 0 fail. Total local `npm test`: 188 pass / 0 fail. Model serialization: 6 pass / 0 fail. Syntax, build and the existing release/Pages guard self-tests also pass locally.

`tests/browser_v11_qa.py` adds 41 required assertions per Chromium/WebKit run. It uses isolated `?test=1` fixtures, renders the real page, drives hub buttons, checks save isolation and the 11/12-car boundary, verifies restart text against the actual channel, and checks route/warning text. It captures the full-train hub at 812x332, 844x390, 932x430 and 1280x720. These are browser regression checks, not normal playthroughs or real-phone certification.

The non-deploy validation workflow now also runs for pull requests targeting `master`. The release evidence gate requires both new QA browser reports; missing or false evidence blocks it. No existing gate has been disabled or relaxed.

## Validation boundaries

The local Chromium environment returns `ERR_BLOCKED_BY_ADMINISTRATOR` for localhost and does not expose WebGL2. Local graphical execution is therefore **ENVIRONMENT BLOCKED**, not PASS. Browser results must come from the new commit's CI artifacts; see the PR checks for their actual status. Existing remote artifacts are not counted as validation of these changes.

Normal A-H playthroughs, subjective weapon/enemy readability, audio listening, real iPhone interaction and hardware performance remain **NOT_VERIFIED / REAL-DEVICE REQUIRED** as documented in the preceding QA report. No damage, drops, enemy pressure, audio or rendering parameters are changed here. No save schema or release version migration is introduced.

## Manual spot checks after deployment

1. At 11 cars, reroll once and select the final car. Complete the round. At 12 cars, choose each route: the hub explains full capacity, does not show Reroll, and START works. Repeated clicks must not consume inventory or exceed 12 cars.
2. Stall at the Engine Console without a kit, then with a kit. Check 3.0s vs 1.5s in the unmodified base build; compare Workshop/Battery combinations. Release repair halfway, move away or take a hit, retry, and confirm the kit is only consumed upon successful restart.
3. Travel normally on all three routes. Verify ordinary stage labels and that crane/tunnel warnings and Engine Critical/Stall still replace lower-priority route text.
4. Check the four recorded landscape sizes on actual target browsers. Check the longer equipped-kit hint for clipping. Audio and real touch still require separate human verification.
