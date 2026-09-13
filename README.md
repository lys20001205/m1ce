# ROUNDHOUSE — V10 WebGL playtest

A single-player 2.5D cutaway train prototype: real Three.js models, two movement layers, a depot/industrial/tunnel loop, cargo and opt-in telemetry. V10 focuses on rescue, feedback and fair failure, not new content volume.

Live: https://lys20001205.github.io/m1ce/?build=v10

Phone: landscape, start from Safari or the home-screen app. Confirm `V10 / WEBGL 3D`. A labelled rescue practice mode is available; it never writes bank credits.

- Hold left/right to move. Roof travel is faster, with clearance hazards.
- At a yellow ladder, switch interior/roof.
- Hold attack. Near a station, stand still and hold repair for a full channel.
- At engine zero HP, use the displayed last-chance deadline to restart it.
- At the depot, read condition and risk before continuing/cashing out.
- Audio is optional. Logs upload only after explicit consent to the temporary public endpoint.

## Develop

Node 22; `npm ci --ignore-scripts`; `npm test`; `npm run build`; `node --test tests/model_roundtrip.test.mjs`.
Serve `dist` over HTTP. Do not preview `index.html` as a local iOS file.
Browser checks: pinned Python Playwright and Pillow as in `.github/workflows/pages.yml`, then `xvfb-run -a python tests/browser_smoke.py`.

Documentation: `docs/V10_CHANGELOG.md`, `docs/AUDIT_V9R1.md`, `docs/ASSET_LICENSES.md`.
No S&box build or multiplayer implementation is included. Browser test success is not real iPhone or fun/balance acceptance.
