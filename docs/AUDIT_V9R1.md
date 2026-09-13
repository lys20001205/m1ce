# ROUNDHOUSE V9R1 implementation audit

Baseline: d93b3702a6ee507f76afa5d93d148c480506b5da. Scope: browser only; no S&box runtime, multiplayer or parallel train.

## Findings and repairs

- Critical: V9 used Canvas getContext('2d'), rectangles and paths, with no actual model assets/loader. Replaced with Three.js WebGL2, OrthographicCamera, depth testing, lit meshes and projected shadows. The near wall is removed in authored mesh geometry.
- High: smoke tests only checked state, not rendering. Added real context/model/triangle/depth checks, occlusion rays, changed-angle screenshot differences, mobile layouts and saved evidence.
- High: drawCar was passed the forEach array as height and patched by a wrapper in app-init. Deleted the old renderer and override entirely. World units are metres, not screen pixels.
- High: attacks ignored roof/interior lane. Added same-lane hit logic, enemy windup, cooldown, knockback, actual animated arm and model muzzle socket.
- High: timed crane damage did not match visible crane position. Shared craneX now drives both model and collision, with advance warnings.
- High: departing and continuing skipped the Roundhouse segment. Route now starts at zero and rotates the real platform/train during departure.
- High: engine health duplicated independently of car health. Engine car HP is now the single authority; unattended systems take damage; defeat wins over arrival.
- Medium: Gun Car/Battery/Workshop descriptions exceeded their implementation. Removed unsupported Gun Car choice. Battery changes tunnel lighting; Workshop provides improved repair and local paid healing.
- Medium: terminal runs had no restart; cashout lacked robust settlement state. Added explicit states, guarded cashout, restart, retained damage and existing roundhouse_bank save key. No unrelated save keys are deleted.
- Medium: mouse/touch/pointer event duplication and stuck movement. Pointer Events only, capture, per-pointer state and clearing on blur/hidden/pause. Portrait pauses.
- Medium: screen-pixel geometry and transforms caused unreliable PWA views. One WebGL canvas, viewport measurement and a camera independent of train length.
- Medium: telemetry cursor indexed a trimmed log array; overlapping sends. Sequence IDs, serialized batches, receipt checking, backoff, payload cap and explicit consent. Local logs remain when remote service fails.
- High: deployment ran independently of smoke tests. New build -> unit tests -> Chromium/WebKit -> Pages dependency; broken builds cannot publish. Removed old duplicate smoke workflow; telemetry no longer runs on every source edit.

## Real model files

Build emits assets/train-cutaway.json, assets/crew-robot.json and assets/cargo-crate.json. These contain vertex positions, normals, materials and articulated nodes and are fetched by ObjectLoader at runtime. Scene-critical architecture is authored in tools/build.mjs and src/view.js. Camera-angle control shows actual depth. Renderer dependency is pinned to Three.js 0.180.0 and published locally, not fetched from a CDN by players.

## Verification boundary

17 deterministic tests cover route start, pause, health, ladders, carrying, same-lane combat, telegraphing, spatial crane hit, tunnel, projectiles, cargo recovery, boost, cashout, defeat and persistence. Browser suite runs the built site over HTTP in Chromium and WebKit, with screenshots and JSON at mobile sizes 812x332, 844x390 and 932x430. Actual iPhone/PWA GPU behavior still needs device testing; emulated WebKit is not an iPhone.

The development container could not create a WebGL context. Local rules were executed; real rendering acceptance is performed on the GitHub validation runner and is not inferred from local state flags.

## Temporary telemetry

Inherited ntfy channel is public and unauthenticated. Never log credentials, names, arbitrary user text or full page URLs. Delivery receipt proves server acceptance, not authorship. Received data is untrusted. Upload is opt-in and can be disabled. Availability on mainland-China networks is not guaranteed. No paid service is introduced.
