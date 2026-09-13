# ROUNDHOUSE V9R1 — real WebGL 2.5D route prototype

Real model files, lights, depth and shadows; side-view gameplay in a cutaway train.

Node 22+: npm ci && npm run build. Serve with python -m http.server 8765 --directory dist. Use the Pages HTTPS URL on a phone. All runtime dependencies are local to the published site.

Controls: A/D or touch arrows; W/layer button near yellow ladder; J/attack; E/repair; F/contextual interaction. Hold touch attack or repair. Engine interaction temporarily boosts travel, Cargo lets you carry a box, Workshop heals for current-run funds. Background/portrait pauses. Press Continue to resume.

npm test runs rules. The Pages workflow additionally runs actual Chromium and WebKit WebGL tests over HTTP and saves screenshots/JSON before allowing deployment. Test mutation API requires ?test=1. docs/AUDIT_V9R1.md contains findings, fixes and boundaries. docs/ASSET_LICENSES.md is the actual license inventory.

Single-player browser prototype only. No S&box runtime, networking or parallel train. Preserves roundhouse_bank and leaves other old save keys untouched. The previous garage is not expanded in this repair. Auto telemetry is opt-in via the start-screen checkbox; the temporary channel is PUBLIC and must contain no private data.
