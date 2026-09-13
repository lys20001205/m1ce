# ROUNDHOUSE V10 — Recovery, readable success and fair failure

Baseline: e296a6c10a5d3cdfd5db2bdfada99d5f3fafc92e (validated V9R1 WebGL).
Scope: existing single-player browser prototype. No multiplayer, parallel train, new paid service or S&box runtime.

## Ownership

- `balance.js`: version and initial playtest numbers.
- `sim.js`: sole authority for health, rescue deadlines, channels, cargo, phase, settlement and metrics.
- `director.js`: admission budget, recovery windows and finite maintenance fault; never owns player health directly.
- `view.js` / `feedback3d.js`: existing real 3D models plus pooled presentation; no damage or payout decisions.
- `main.js`: input, mobile lifecycle, UI and persistence. `audio.js`: optional original synthetic cues.
- Telemetry remains explicitly opt-in, using the inherited temporary public ntfy channel. No new endpoint or credentials.

## Implemented

### Last chance and repair

Engine states use the same engine-car HP: >50% normal, >25% damaged, >0 critical, zero stalled.
Stalling stops route movement and new admissions, not existing enemies. It does not instantly fail.
Minimum grace is 8 simulation seconds. At stall entry it is increased, never shortened, to cover walking back to the engine, 3 seconds of repair and 1.5 seconds margin. Carrying cargo includes the detour to return it. The deadline is fixed at entry, not extended by running farther away.

Normal repair: hold still near the local station for 1.8 seconds, restore up to 28 HP. Movement, release, attack or player damage interrupts without free partial healing. Engine console is at x=5.8; other station centres are x=index*8.3+4.15. Radius 1.9m.
Emergency repair: 3 seconds, restores 20% engine HP, 4-second engine-only damage shield and 8-second admission recovery. Existing enemies can still hurt the player. Exact-deadline completion succeeds; completion after the deadline fails.
No money is awarded for emergency/critical repairs. A critical repair milestone is counted at most once per lap; each stall can grant only one clutch-save event.

### Warning and achievement

Crane warning gets at least 4 seconds; tunnel warning at least 6, including when boosting. A signal meters route progress rather than silently reducing reaction time.
Player 40/20% bands and battery flicker/emergency/offline states are explicit. Emergency light has a visibility floor; no total blackout.
A thief still removes money only on escape (preserved V9R1 rule). Recovery now reports the saved value and tracks it once per thief. Saved value is not an extra payout. Cargo still physically aboard is secured on arrival, including cargo in a thief's hands.

At arrival enemies stop, input clears, and a 4-second safe docking phase plays before the cashout/continue panel. The safe phase pauses with the game. Summary includes clutch saves, recovered cargo value, critical time and completed repairs, plus actual engine/player condition and a qualitative next-round risk label. Risk is not a calibrated success probability.

3D engine beacon, smoke, warning footprint, repair marker/ring, existing wrench animation and optional synthesized success/warning audio support the rule changes. Repair/success UI occupies the reserved footer, not the roof lane. Reduced-motion setting is provided.

### Difficulty and train identity

Initial R1–R5 admission caps: 2,3,4,5,6; later capped at 8. One environment slot is reserved in R1, two in later rounds. The reserve is held even before the hazard so live enemies do not suddenly push the total over budget at a phase boundary. Low health is a consequence of existing incidents, not an extra duplicated budget charge.
Enemy HP does not grow with rounds. R1 introduces only ordinary boarders. Extra cargo cars bias thief composition within the same cap. Wallet/bank values never raise difficulty.
Recovery windows after hazards/rescue/faults block new incidents for 8 seconds, without deleting threats or granting global invincibility. Critical engine/player condition also suspends new admissions until stabilised.
From R3, one announced maintenance fault may occur early in the yard: 3 seconds warning then at most 6 seconds of 6 HP/sec damage. Successful engine repair ends it. It is excluded for weak players/engines and must fit before the crane phase. This is not a scripted forced stall.
Roof movement is 25% faster. Workshop makes repairs faster; functioning battery above 25% adds a further 20% speed. Boost uses finite stored charge, preferring a healthy battery, refilled at dock.

### Testability, logging and persistence

A clearly labelled rescue-practice button starts an isolated scenario. It does not write bank, cannot cash out and cannot continue into a paid real run. Real runs use a logged random seed; tests use a fixed seed.
Snapshots add engine state, rescue/channel progress, admission budget, recovery, per-lap/run metrics, warning clocks and failure reason. Critical lifecycle events request an upload, still respecting consent, receipt, backoff and byte limits. "Received" only proves server acknowledgement; public messages are not authenticated user evidence.
`roundhouse_bank` and unrelated existing keys are preserved. No service worker or new remote dependency was introduced. Application module URLs are versioned together to avoid mixing cached V9R1 rules with V10 UI.

## Verification

Local: deterministic rule tests and the five original model round-trip tests. This environment cannot create a WebGL2 context, so no local visual pass is claimed.
GitHub CI: the built site over HTTP, actual WebGL2 in Chromium and WebKit, retained V9R1 rendering checks plus V10 input/channel/rescue/deadline/cargo/arrival/practice checks and screenshots. Pages is dependent on validation success. The workflow result/artifact is the authoritative pass/fail record.

Real iPhone standalone rendering, frame rate, perceived achievement, frustration and difficulty remain device/playtest acceptance. The prior proposed 90%/80%/65–75% win rates are goals only, not observed or automatically proven results. No numerical "fun score" improvement is claimed.

## Phone acceptance

1. Confirm V10 / WEBGL 3D. Do not erase website data to refresh it.
2. Run "抢修演练 · 不结算": hold repair; test releasing midway, pausing, successful restart, and timeout on a separate attempt. Bank must not change.
3. Start a real run, compare roof/interior traversal, read environment warnings, and recover stolen cargo.
4. Return to the depot: notice the safe pause before decisions. Compare engine condition, saved cargo and critical time.
5. Test continue and cashout separately. Enable telemetry only with awareness of the public temporary channel.

The full permanent economy, advanced car builds, new routes, heavy enemies and multiplayer remain deferred. No ability was added merely to force unavoidable losses.
