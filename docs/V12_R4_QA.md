# V12 R4 — hazard readability and directional ETA

Build: V12-KENNEY-REVERSE-R4-20260930. This correction changes presentation only; asset files, combat balance, guard durations, movement, collision and cargo economy are unchanged. R3 frozen copy is retained.

The real Kenney crane arm now has a restrained emissive red tint and a thin high-contrast silhouette following its actual geometry, visible through the previously obscuring background. A red-edge crossbar marker identifies the sweep location and distinguishes roof escape guidance from interior safety. No filled shape is placed over the player's body.

Hazard arrival information now includes motion. Forward approach keeps the existing positive ETA/lead calculation. STOP or an actually stalled engine returns null seconds and shows stopped/no countdown; reverse returns null seconds and shows moving away/no approaching countdown; pause shows paused/no countdown. The hazard range and safety rules are unchanged.

Validation: 376/376 npm unit tests pass; focused hazard + model round-trip 26/26 pass. Two new tests verify direction, stop, stall, pause and UI text. The first stall fixture set HP directly without updating engine state; it is retained in artifacts/v12-r4-focused-attempt1.txt, and the corrected fixture uses the real damageCar API.

Normal-input evidence is in artifacts/v12-r4-normal/report.json and its direction/sweep PNG files. Browser entry uses a fresh profile, release URL, ordinary clicks/keys and read-only snapshots; it does not accelerate or reposition the game. The initial browser attempt asserted immediately between the key event and next HUD frame; the preserved attempt1 report records that race. The final runner waits for the actual directional HUD state.

No repeat of the previously passed multi-minute gameplay flow was run. Independent R4 QA remains for the parent. Full release gate and real-device/audio limitations retain their previous status; this targeted candidate is not a declaration that complete release gates pass. No upload, push, merge or deployment.

Final normal-input browser run: seven checkpoints, zero page/runner errors. TUNNEL forward ETA 9.6s; STOP and reverse seconds null with corresponding visible text; resumed SLOW ETA 26.8s. Real INDUSTRIAL sweep roof screenshot shows the red outlined arm at the actual sweep location; ordinary overhead contact caused the unchanged 32HP hit (100 to 68). Interior screenshot confirms safety label. 812×332 canvas remains at least 160px.

## R4b correspondence correction
Independent R4 QA passed the full directional ETA sequence, then identified that TUNNEL still used the red-crane-arm roof instruction despite having no crane. R4b changes only that correspondence: crane retains red-edge guidance, while tunnel approach/interior-clearance wording names low tunnel clearance. Revision labels are V12 R4b / V12-KENNEY-REVERSE-R4B-20261001. A new semantic test covers both route hazards. Asset bytes, movement, collision, economy and balance remain unchanged. Previous R4 screenshots/input evidence retain their original labels.

## Remote gate synchronization
PR #8 CI run 36802512387 failed in the route browser suite: the FREIGHT console accepted the first F, but software WebGL had not updated the HUD within the test's fixed 180ms delay. A second F closed the console, and the FAST click then timed out. Failure evidence showed HP100, no enemies, and console true then false. The test now waits for DOM visibility to match the actual console state before retrying, retaining all visibility and FAST behavior assertions. The focused local Chromium suite passes all three routes, including visible controls and ordinary FAST clicks. No product code or release criteria changed. Complete exact-head CI is still required before merging.

## R4c docking guidance correction
The next exact-head run 36803397947 passed Chromium and WebKit route, audio, combat and depot suites, then failed design guidance in both browsers. This was a product UI priority defect: the first-station player-shield notice replaced the held-cargo return instruction for its full lifetime. R4c combines remaining shield time with the depot's current instruction, including held/unloaded value, return action and full-hold exit guidance. Outside the depot, the defensive reminder is retained. Shield duration, enemies, movement and accounting are unchanged. Revision is V12-KENNEY-REVERSE-R4C-20261001 / V12 R4c. The original browser assertions remain intact; the new unit regression checks all three depot instructions at 25s, 5s and 1s. Local unit validation passes 378/378. Full exact-head gates remain required.
