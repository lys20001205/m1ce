# V11 QA continuation — C05 / C06 / C07 / C08

Baseline: `b12ab97e288248f865c8fc1a6ec0939e8bc04876` (C01–C04 already merged). This change does not redesign gameplay, adjust tuning, or change save formats.

## Problems and fixes

### C05 — same-action input ownership (BUG / MOBILE, S2)
Reproduce with D held, then press/release the on-screen right button while keeping D held; alternatively hold one action with two pointers and release the first. `lostpointercapture` previously deleted every input mapped to that action, including other pointers and keyboard keys. The final release of one pointer could stop movement, attacks or a repair channel that another source still held.

Release now removes only its own pointer ID and ignores duplicate release notifications. Button highlights are derived from the same held-input set, so the final keyboard release also clears the highlight. All-input clearing on death/blur/pause remains unchanged. Scope: input bindings in `src/main.js`. Main regression risks: multi-source repair interruption, late capture-loss events, and stale highlights. No movement or combat numbers change.

### C06 — actionable Stall instruction (UX, S2)
A player directly above the Engine console, on a Depot, carrying Cargo, or dead could receive the same instruction as a living empty-handed player beside the console. The previous hint compared only horizontal distance.

The Stall hint now prioritizes: waiting for respawn (explicitly stating that the Engine countdown continues), walking back to the Depot center bridge with a left/right arrow before RETURN when outside bridge range, putting Cargo back in a cargo car (LOAD before any ladder action when carrying on the roof), a yellow ladder down from the roof, horizontal direction to the console, then the existing exact repair duration. The generic center hint is hidden while dead. Scope: HUD text in `src/main.js`; Engine authority, life transitions, deadlines, repair eligibility and duration are unchanged. Main regression risks: mobile text truncation, incorrect priority, and loss of the kit-speed hint.

### C07 — AudioContext recreation clock (BUG / AUDIO, S2)
Closing a long-lived context and recovering with a new user gesture created a fresh audio graph, but periodic rail/repair/alarm deadlines remained on the previous context's clock. This can delay periodic cues for the duration of the old session even though the new context runs and the engine hum works. It is not a claim that the entire game is silent.

Graph creation resets periodic deadlines to the new context time, clears old voices/pending cues and stale output evidence, and disconnects the old context's state callback. It retains the user's mute setting. Ordinary suspend/resume still reuses the graph and its clock. Scope: `AudioCues.createGraph` in `src/audio.js`; no cue design, mix levels, bus gain or pitch changes. Main regression risks: unwanted replay, mute persistence, and repeated graph creation.

### C08 — stable native button targets (BUG / UX, S2 candidate)
The browser follow-up recorded an intermittent WebKit RETURN click with no resulting layer change. The page rewrites the pause/layer/interact button text on every render even when the label is unchanged, replacing the native text nodes during a click. WebKit has a matching upstream report (https://bugs.webkit.org/show_bug.cgi?id=252810); that report alone does not establish physical-iPhone impact.

The three click-activated labels now update only when their text changes, preserving native targets while the pointer is held. Native click handlers and keyboard accessibility remain intact; no pointer-down shortcut replaces them. Three DOM-double regressions fail on the prior source and pass after the change. Browser coverage checks actual native node identity across rendered frames and uses 120ms trusted clicks spanning frames for pause/RETURN, including exact rejected/successful interaction call records. Investigation evidence and any remaining uncertainty must be retained in the final receipt.

## Evidence requirements

- `tests/lifecycle_followup.test.mjs`: 28 production-rule/HUD/audio tests; the initial 23 have baseline 2 pass / 21 fail, with two further left/right Depot bridge regressions and three native-label stability regressions. Input/HUD tests use DOM doubles; they do not constitute browser or device evidence.
- `tests/browser_v11_lifecycle.py`: 44 required checks per Chromium/WebKit using actual pages, trusted keyboard/mouse capture-loss input, screenshots, resized viewports and real Web Audio context close/recovery. Context closure and state setup are deliberate fixtures; no claim about actual OS interruption or real-phone behavior.
- The release gate requires both new reports, at least 240 passing unit tests, and all existing gates. No existing check is relaxed or bypassed.
- Initial delivery was local-only because a source-upload request was blocked. Upload succeeded on the subsequent authorized attempt. At PR submission the new browser suite is still pending its first CI execution; no browser pass or deployment is claimed in this document. Exact-commit CI and artifact verification are required before merging or deploying. See the PR and workflow artifacts for final execution status.

## Manual acceptance still open

Issue #3 remains the queue for unassisted first-time A–H play, gameplay/balance decisions, blind enemy/route readability, audible review, physical iPhone Safari gestures/lifecycle, and measured hardware performance. These items must not be closed based on fixture checks. Original normal-route scripts used read-only state for navigation and are not blind play.

Targeted manual spot checks: hold keyboard plus a same-action touch, release one and then the other; die or climb onto the roof while the Engine is stalled and follow the displayed instruction; verify periodic rail/repair/alarm cues immediately after an actual audio interruption, including while muted. Capture device/browser, inputs, times and screenshots or recordings.
