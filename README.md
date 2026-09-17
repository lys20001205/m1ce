# ROUNDHOUSE V11 — Train Route / Loot / Combat Progression

Single-player Three.js / WebGL2 browser prototype. A stable 2.5D cutaway train travels through three continuous ring worlds. No S&box migration, multiplayer, parallel enemy trains or permanent damage tree.

Play: https://lys20001205.github.io/m1ce/

DEV: https://lys20001205.github.io/m1ce/?dev=1

## Play loop
Choose Industrial, Freight or Tunnel **before** choosing a car. The Roundhouse turntable aligns with the selected gate. Move to the Engine Console to set STOP, SLOW, CRUISE or FAST. Emergency brake works from anywhere on the train; acceleration still requires the Engine. FAST drains charge.

On STOP or SLOW, cross from the roof onto a Depot behind the cutaway. Each Cargo car has three slots. Load crates through a Cargo car roof hatch. STOP never departs on its own; SLOW can leave you behind. TRAIN LOST destroys carried cargo. An intact/recoverable Engine permits respawn after five simulation seconds, at 60% HP with two seconds of **player-only** protection. The Engine rescue clock does not pause during death.

Kills give run-only Scrap. Buy Knife and Axe at the live Engine Armory, then Handgun, SMG and Rifle. Scrap and equipment persist between rounds and ordinary deaths; Cash Out and failure reset them. Cargo value is separate and cashes into Bank. Prep Shop offers Reroll Tokens, an Emergency Repair Kit and Route Intel. Workshop and Battery cars change repair, fault-service, FAST and lighting behavior.

The desktop keyboard legend is generated from `INPUT_BINDINGS_SSOT`. Touch controls provide independent melee/ranged buttons. Bank and preferences persist locally; DEV and test URLs use separate storage. Use a landscape browser or add the online-first app to the home screen. Audio starts from a real gesture. Telemetry uploads require explicit consent; the channel is labelled public. Detailed renderer diagnostics and free-form errors stay local.

## Development and validation
Node 22. Run `npm ci --ignore-scripts`, `npm test`, `npm run build`, and `node --test tests/model_roundtrip.test.mjs`. Serve `dist` over HTTP; do not open the source HTML as a local file.

Browser tooling is pinned in the workflows. Run every `tests/browser_*.py` suite with Chromium and WebKit, then `python tools/check_release.py`. The release gate rejects missing, false or skipped evidence and validates `build.json` against the tested commit. Source is never rewritten by release CI. The `master` workflow publishes only its own successfully validated site artifact.

`?dev=1` exposes supported quick controls. `?test=1` exposes test fixtures in an isolated save namespace. Other query values do not expose mutable test controls. Frame acceleration affects simulation only, never audio pitch.

See `docs/V11_CHANGELOG.md`, `docs/V11_RELEASE.md`, `docs/V11_MIGRATIONS.md` and `docs/ASSET_LICENSES.md`. Browser checks are not proof of fun, real-device performance or iPhone speaker output.
