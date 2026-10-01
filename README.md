# ROUNDHOUSE V12 — Train Route / Loot / Combat Progression

Single-player Three.js / WebGL2 browser prototype. A stable 2.5D cutaway train travels through three continuous ring worlds. No S&box migration, multiplayer, parallel enemy trains . Persistent crew upgrades affect the next run.

Play: https://lys20001205.github.io/m1ce/

DEV: https://lys20001205.github.io/m1ce/?dev=1

## Play loop
Choose a route, then a car. Freight offers two depots. In the Cargo interior press F near a depot to approach, then F to enter, F to pick the first crate, F to return and load. Walking close picks subsequent crates up. Follow the center bridge back. Cargo has three slots; held/stored/stolen value stays separate from settled Bank.

B / STOP brakes anywhere on the train. Wait 0.5s, press V / reverse to recover a missed depot at 28% speed; F arms automatic reverse docking. Brake and V again for slow forward. Engine Console offers sustained SLOW/CRUISE/FAST; FAST drains charge. STOP has a finite early reading window, followed by warned reinforcements.

Kills grant Scrap. Buy or freely re-equip independent Wrench/Knife/Axe and Handgun/SMG/Piercing Rifle/Shotgun choices at the live Engine Armory. Complete a loop and CASH OUT to settle Bank; crew boots/hull/kit persist into the next run, alongside the consumable Prep Shop.

The desktop keyboard legend is generated from `INPUT_BINDINGS_SSOT`. Touch controls provide independent melee/ranged buttons. Bank and preferences persist locally; DEV and test URLs use separate storage. Use a landscape browser or add the online-first app to the home screen. Audio starts from a real gesture. Telemetry uploads require explicit consent; the channel is labelled public. Detailed renderer diagnostics and free-form errors stay local.

## Playability candidate (2026-09-30, local only)

Cargo interior interaction now handles docking and boarding. When near an upcoming station, press F to approach slowly and stop at the aligned bridge. Enter directly from the cargo interior; walking near a crate picks it up. Return to the central bridge and press F to load and return to the interior together. STOP continues to carry risk.

Each station visit per lap has one 24-second equipment guard at 25% enemy damage; player damage is unchanged. Re-entry cannot refresh it. The first new shipment has an 18-second theft seal and an eight-second spawn breather. Reloads, recovered crates and third crates do not renew that seal. Thieves telegraph theft for three seconds and hold stolen cargo for six seconds before escaping. The persistent ledger separates held, stored, stolen, lost, pending income and settled Bank.

Ranged purchases start at 12 Scrap with no melee prerequisite. The Armory offers free switching among owned weapons, a five-pellet shotgun and a three-target piercing rifle. Standing held attacks face nearby enemies in the same lane; moving retains player direction. Briefly stunned interactions are buffered for 1.2 seconds.

Fleet Career spends settled Bank on permanent carry speed, engine HP and a Handgun starting loadout. Existing saves retain Bank/prep and receive zero career levels. Purchases apply at the next departure and persist across page reloads. See `docs/PLAYABILITY_WEAPONS.md` and `docs/PLAYABILITY_QA.md` for evidence and limits.

For the local candidate: `npm ci --ignore-scripts --cache .npm-cache`, `npm test`, then `node tools/local-server.mjs dist 8779`. Open `http://127.0.0.1:8779/` without DEV/TEST parameters. No push, merge or deployment has been performed.

## Development and validation
Node 22. Run `npm ci --ignore-scripts`, `npm test`, `npm run build`, and `node --test tests/model_roundtrip.test.mjs`. Serve `dist` over HTTP; do not open the source HTML as a local file.

Browser tooling is pinned in the workflows. Run every `tests/browser_*.py` suite with Chromium and WebKit, then `python tools/check_release.py`. The release gate rejects missing, false or skipped evidence and validates `build.json` against the tested commit. Source is never rewritten by release CI. The `master` workflow publishes only its own successfully validated site artifact.

`?dev=1` exposes supported quick controls. `?test=1` exposes test fixtures in an isolated save namespace. Other query values do not expose mutable test controls. Frame acceleration affects simulation only, never audio pitch.

See `docs/V11_CHANGELOG.md`, `docs/V11_RELEASE.md`, `docs/V11_MIGRATIONS.md` and `docs/ASSET_LICENSES.md`. Browser checks are not proof of fun, real-device performance or iPhone speaker output.
