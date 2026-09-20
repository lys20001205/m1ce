# V11 design pass 1 — make the existing decisions visible

Baseline: e1f3660aec90fce20c6a551bedbabed06417cd0a (C01–C08).
User authorization: implement changes from the senior game design review. This batch implements its first, low-risk presentation pass. It does not claim complete blind A–H play, listening, or physical-device acceptance.

## Implemented

1. Route / car / START precede preparation. Zero-Bank, empty-inventory prep starts folded, but its native disclosure is always accessible; Bank/inventory owners and cash-outs see it open. The repair drill is a secondary button, separate from primary departure. Optional settings retain explicit telemetry consent, with no automatic enrollment.
2. First-route Freight suggestion is informational only: no forced choice. Cargo-less builds receive a truthful guard-and-return goal. Full cargo builds are told to protect existing cargo, not pick up an impossible extra box.
3. Car offers use read-only projected Game getters for capacity, current-condition repair duration and full-charge FAST time. Duplicate Workshop acceleration is explicitly non-stacking. Existing paid treatment and round-three industrial-fault timing are explained. No healing/cost/stacking rules change.
4. Depot progress nodes and footer guidance describe remaining depot value, free capacity, STOP/SLOW entry, local ladder, bridge direction, pickup, RETURN and LOAD. Carried uncredited cargo is distinguished from already credited/recovered cargo. Loading a new crate shows the actual increase in uncashed funds; reloading secured cargo never presents it as new money.
5. A read-only per-run presentation ledger observes existing events. Main results show net new funds, retained cargo, kills/upgrades and final condition; exceptional rescue statistics are secondary when present. A breakdown separates starting funds, completed-round rewards, retained cargo and paid service spending. Other/DEV adjustments are labelled instead of silently presented as earnings. Cash Out and defeat preserve a pre-clear display snapshot; subsequent Bank spending does not rewrite the run's results. Normal deaths do not reset this ledger. New games / practice / test resets do.
6. One More Round states the amount at stake and the next actual affordable/nearby weapon purchase. Armory explains that buying Axe unlocks Handgun; one-time affordable-upgrade footer nudges direct the player to Engine Armory. The live shop does not pause. Emergency-kit status is displayed without consuming it or changing recovery rules.

## Owners / boundaries

- `src/design_ui.js`: pure preview/guidance helpers, RunReadout, DOM presenter. It may read the current Game and create a projected object for getter evaluation; it must never write simulation/save state or call reward/purchase methods.
- `src/main.js`: existing controls and authoritative Game retain ownership; delegates presentation events, hub/end rendering and per-frame supplemental hints.
- `index.html`, `src/design.css`: hierarchy/layout only. Existing principal result ID remains accessible for the original browser checks. Runtime source, styles and new module are copied by the existing build.
- Simulation, content/balance numbers, save schema, enemy admission, audio and renderer are unchanged.

Deferred: unequal crate values, staged STOP pressure, weapon re-equipping, Intel removal/refunds, prices, new enemy combinations. These need separate comparison/economy decisions and must not sneak into this batch.

## Regression acceptance

- `tests/design_ui.test.mjs`: 56 rule-backed presentation/DOM-double checks. No claims about actual rendering or player comprehension.
- `tests/browser_v11_design.py`: 65 mandatory checks per Chromium/WebKit, with four measured CSS viewports (812x332, 844x390, 932x430, 1280x720), native disclosure/route/car/START/purchase/cargo controls and archived screenshots. Fixture resources and positions are labelled.
- Existing consent transport test now opens the optional Settings disclosure through the actual native UI before checking/revoking consent; all its original transport/privacy assertions remain.
- Release gate requires both new reports and at least 296 passing units. No existing browser suite is omitted or weakened.
- Local direct browser navigation currently returns ERR_BLOCKED_BY_ADMINISTRATOR. Only exact-commit CI screenshots may supply graphical evidence; final acceptance and deployment status belong in the PR/workflow receipt, not assumed here.

## Manual questions still open

Can a first-time player state the main goal, choose deliberately, follow the bridge/load route, and understand the end-of-round account without help? Does the nudge distract from fighting? Can the smallest landscape device read every prompt? Are known gamepad/browser/audio interruption paths still usable on hardware? CI success cannot answer these subjective/device questions or close Issue #3.
