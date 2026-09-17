# ROUNDHOUSE V11 — Train Route / Loot / Combat Progression

Release candidate scope is frozen. V11 keeps the validated V10 recovery, WebGL2, PWA, telemetry and deployment baselines while closing the train-route gameplay loop.

## Player-facing loop
- Roundhouse route choice precedes car choice and turntable departure.
- Three authored continuous ring routes: Industrial, Freight and Tunnel.
- Sustained STOP / SLOW / CRUISE / FAST speed control with battery-backed FAST.
- Physical Cargo Depots, three cargo slots per Cargo car, moving-platform TRAIN LOST and five-second Engine-interior respawn while the Engine remains recoverable.
- Five enemy identities, immediate Scrap rewards, and a live Engine Armory with Wrench -> Knife -> Axe plus Handgun -> SMG -> Rifle progression.
- Critical Engine stall / Last Chance restart, route hazards, Workshop and Battery utility, Cash Out / One More Round.
- Roundhouse Prep Shop spends Bank on Reroll Token, Emergency Repair Kit and Route Intel only; no permanent damage bonus.
- DEV acceleration remains isolated behind `?dev=1`; procedural audio remains gesture-unlocked and lifecycle-safe.

## Release gates
V11-L adds the frozen Final Snapshot / Telemetry contract plus a stitched browser journey covering Freight -> Depot -> TRAIN LOST -> Respawn -> Scrap -> Armory -> FAST -> Roundhouse -> Cash Out -> Prep Shop. Final regression also covers 812x332, 844x390 and 932x430 landscape layouts, portrait/landscape switching, lifecycle input clearing, 12-car framing, Chromium and WebKit.

V11-M may update `master` only after the work branch passes once with the L migration and then passes again from the persisted source with no staging utility. GitHub Pages deploys only from the validated `master` workflow.

## Release closure
V11-M adds clean fail-closed CI, exact built-commit provenance, V11 PWA metadata, a compact privacy-filtered telemetry transport and strict isolated test entry. No gameplay tuning or frozen decision changes are introduced by release closure. Actual final pass counts and deployment state belong to the per-run `release-gate.json` and GitHub Actions results.
