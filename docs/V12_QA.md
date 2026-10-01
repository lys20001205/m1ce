# V12 local engineering candidate — 2026-09-30

Branch `improve/roundhouse-v12-20260930`, from clean `a9288127`. No push, merge, public
deployment, Library upload or global configuration/credential changes. R8 preserved.
Public build.json actually fetched: V11-RELEASE-20260917 / 1c1506f. User's played build unknown.

## Implementation

21 selected official Kenney CC0 GLBs replace locomotive, flatbed/cargo consist, near rails,
roof/depot catwalks, boxes, crane, industrial surroundings and animated robot bodies.
21/21 load; original weapon sockets/role kits remain. Robots deliberately remain blocky.
See ASSET_LICENSES.md and assets/kenney/manifest.json; 1,240,516bytes selected assets/license/manifest.
No whole packs/CDN. A failed model raises a visible persistent warning, not a silent total fallback.

Train, rail tangent and environment share the selected route's world frame. Stationary
turntable rotation ends before progress; moving train no longer unwinds across straight rails.
Wheels match -X forward. R2 keeps rendered local turntable angle separate from global state.
Crane originally swept toward -X, same as forward; R2 uses -3→length+3 for rendering,
collision and warning. STOP static, reverse negative sweep. Actual walkway floor fits game floor.

B/STOP → 0.5s dwell → V/touch reverse at28%; F arms reverse automatic docking. It stops
when crossing the station marker, without teleporting from the far side. Brake and V to
switch to slow forward; Engine controls CRUISE/FAST. Missed-bridge F explains this route.
V12 revision, direction and speed are visible. Package/build/manifest/cache keys advance
to12.0.0; legacy save/telemetry schema identities remain compatible.

First-loop STOP/reverse admission uses cumulative per-location ages: no new spawns during
20s; one-enemy admission before35s; warning25–35s, then normal cap/specials. Existing enemies
remain dangerous. Throttle/direction changes don't refresh ages. Entry guard35s and crate
seal18s remain once per station/lap; reverse never replenishes stock or repeats cargo credits.

## Evidence and limits

`artifacts/v12-normal/report.json`: fresh profile, ordinary inputs, no mutable API. Freight
missed at28.071% → B/dwell/V/F → auto docks26% after about10.15s → F enters. Idle entry20/30s
retains180HP;60s leaves52HP/2boarders. The “first pickup” event label was inaccurate: entry
only, held no crate. It is not counted as cargo coverage.

`artifacts/v12-long/normal-play.json`: frozen R1,600.431s continuous ordinary AI play,
47key events, four random seeds2949853120/8571410/1897438191/945830278, no errors. Controller
missed first freight station; not counted as pickup success. Industrial held300 through20s
reading, loaded two600 at119.3s/pending1600; cashout Bank550→3550. Tunnel held275 through20s
reading, engine238→214, loaded two550 and later cashout Bank2600→5550. First2400 cashout bought
boots/hull/kit; next start210HP+Handgun, later240/270HP. No normal theft/recovery in this run.
Long run is explicitly R1; R2 direction/diagnostic/floor fixes are separately tested.

`artifacts/v12-baseline/pressure.json` vs `artifacts/v12-r1/pressure.json`: identical diagnostic
depot placement,3routes×3fixedseeds/no attacks.20s R8:1spawn, V12:0;30s R8:2spawns/140–180HP,
V12:0/180;60s both2spawns, R8engine0(all stalled, one lost), V12engine80–132. This is simulation
evidence, not normal entry. Counts distinguish admission from existing enemies' repeated damage.

`artifacts/v12-r2-targets/report.json`: ordinary Industrial/Tunnel2/5/8s opening, moving
railAlignment=1. Diagnostic crane forward/STOP/reverse, busy812×332/844×390/desktop world≥160px,
targets≥44px/within viewport, one blocked diesel clearly warned with20others loaded.15checks
passed. First attempt omitted returned layout in screenshot helper; preserved, then corrected.

Node `artifacts/v12-final-unit.txt`:369/369;6new reverse/stock/guard/version/crane cases.
Python19actual commands (2selftests+17browser suites) are preserved in `artifacts/v12-gates/`.
R1 smoke/depot/enemies/life/prep/release/train/QA/muzzle/mobile-art passed both engines.
R1 route-angle diagnostics/obsolete shipping V11 assertions were fixed for R2. Design report
write hit GBK U+2212; corrected process-local PYTHONUTF8=1. R2 routes/design/ship rerun logs
are `artifacts/v12-r2-{routes,design,ship}.log`. Final outcomes in local gate matrix.

Full release approval remains fail-closed: Chromium desktop fixture exposes native touch10
despite has_touch=false, hiding keyboard legend; Windows WebKit lacks AudioContext, blocking
audio/dev/lifecycle. No assertions waived. Actual phone gestures/heating, subjective sound,
human aesthetics/fun and independent V12 QA remain pending; parent coordinates independent QA.
