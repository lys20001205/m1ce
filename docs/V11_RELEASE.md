# V11 release contract and evidence

Baseline: `f1913240a372dad3be3fb18ddbe2590d02a1daec` on `master` (V10).

The V11-A through V11-L implementation was validated in GitHub Actions run `35170599346` and persisted as `ea269833954828928f6f51e47f43ae264d5d97f7`. That run passed 162 rule tests, 6 model tests and 218 browser assertions per engine. This is historical evidence, not a substitute for the final candidate's gates.

## V11-M closure

- Publish a clean source tree, no staging migrations or CI self-commits.
- Record the tested commit and version in `build.json` and the full built-site hashes in `artifacts/release-gate.json`.
- Update the PWA entry point, README and license inventory to V11.
- Keep automatic telemetry functional when full renderer snapshots exceed the 3,500-byte transport limit: use a bounded state/event allowlist for upload and keep full diagnostics local. Raw error messages, arbitrary text and unknown fields never enter the upload body.
- Include cargo-full, cancelled-respawn and enemy-spawn events in the explicit telemetry contract.
- Expose the mutable fixture API only for the exact isolated `?test=1` mode, not `?test=0`.
- Require the same rule/model/browser suites on the work branch and `master`. Guard missing and skipped evidence. No failed validation can stage or deploy Pages.

## Evidence interpretation

Each run uploads `v11-validation` and `v11-site`. The former contains TAP results, Chromium/WebKit JSON assertion reports, real rendered screenshots, source, exact commit and a fail-closed aggregate gate. The latter is the exact built site that was tested. The successful `master` workflow passes that site artifact to Pages without rebuilding it.

Browser coverage includes three route gates, landmark world/projection/pixel motion, distinct route art, roof-height/back-layer Depot geometry, carry/load/capacity, natural SLOW TRAIN LOST, five-second Engine respawn, rescue deadline priority, five behavior types, actual Scrap kill inputs, both weapon slots, non-pausing Armory, car utility, Prep Shop persistence, DEV isolation and simulation multipliers, gesture audio resume, nonzero post-Master audio samples, mute/unmute, three landscape sizes, 12-car framing and lifecycle input clearing. Fixture-based focused tests and a stitched continuous-state journey complement each other; neither establishes fun or commercial balance.

The transport browser test serves the built site under a simulated production origin and intercepts every request. It verifies real consent/UI/serialization behavior against a synthetic receipt; it does **not** post test data to the public telemetry channel.

## Remaining human acceptance

Real iPhone Safari and installed home-screen app: speaker output, hardware mute/system volume, Bluetooth routing, lock/unlock and background interruptions, safe areas, touch comfort, orientation, sustained frame rate, heat and battery cost. Desktop/Linux WebKit and software-rendered CI timings do not replace these checks. Offline play is not promised by this online-first prototype.

STOP never automatically departs. TRAIN LOST during normal play requires a moving train, such as SLOW. This preserves the frozen requirement that only the Engine Console can restore speed after braking.
