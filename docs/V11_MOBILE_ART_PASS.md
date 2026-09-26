# V11 mobile controls and visual polish

Baseline: 51c0460a3377f26719e80018b81e2f753a4fcbd5. This pass implements the requested visual/mobile follow-up without changing economy, damage, progression or simulation authority.

## Findings and changes
- **M01 (UX/MOBILE):** the original captured arrow held its initial direction when dragged across to the other arrow. The movement area now acts as one horizontal pad: slide to reverse, center dead zone to neutral, drag well outside to neutral. Each source retains its own pointer ID; release/cancel clears only that source, even after the direction changes. Keyboard and independent attack input remain intact. This is an intentional usability improvement, not a claim that conventional press-only arrows violated a rule.
- **M02 (UX):** at a Depot with no crate in pickup radius, the old button still read PICKUP, while the actual interaction attempted RETURN. The visible label now uses the same crate eligibility predicate as Game.interact. No proximity, travel or cargo rules change.
- Engine durability and player HP have distinct labelled meters instead of a combined percentage/value. Charge remains separate in the route/console readout.
- Mobile footer has dedicated steering, utility and combat groups, plus one full-width contextual hint lane. All eight game control targets must remain >=44 CSS pixels in both dimensions at the four supported viewports. Input captions distinguish tap from hold; no new auto-aim, auto-repair, toggled attacks or automatic departure.
- Render-only low-poly polish: role-color carriage trims, roof hatch rails, window highlights, a player contact ring/beacon and trackside distance posts. Shared geometry/materials and instanced meshes; no new dynamic lights, postprocessing or external assets. Rebuilt livery instance buffers are disposed; stable frame geometry is reused.

## Evidence boundaries
Local direct Chromium navigation returns ERR_BLOCKED_BY_ADMINISTRATOR. A fresh TinyFish normal-URL attempt selected Freight/Cargo, moved/interacted and encountered death, but exported no images and mixed keyboard legends with buttons, charge with Engine durability, and causation with timing. Treat those as low-confidence observations; do not register the reported "14 buttons", "brake locked", "ladder kills" or "passive NPCs" as bugs. Do not call it complete normal gameplay.

27 local tests cover actual production-handler slices, geometry calculations, contextual label/rule agreement and HUD values. Browser suite is independently executed in CI with actual rendered WebGL scenes, native pointer capture/taps, plus Chromium CDP multi-touch (including trusted/non-primary event evidence). WebKit is not credited with CDP multi-touch. Fixtures explicitly set state for targeted checks. Screenshots must be inspected before acceptance.

CI FPS is not device performance. Audible quality, physical iPhone multi-touch/OS interruption and complete first-time A-H acceptance remain open in Issue #3. No audio changes in this pass.

## Regression contract
All existing release suites remain required. New mobile-art reports require 49 common named checks per browser, plus 5 Chromium-specific touch checks. Source/build SHA and new module/CSS files are required in deployment verification. Check repeated rebuild resource counts, tunnel visibility, life-layer markers, orientation cancellation, steering-release ownership, and Depot pickup/return/load before accepting a release.

## First CI regression retained
Run 36242483477 rejected the candidate because cosmetic `app.dataset.route` added a fourth element to the existing route-choice selector. Renamed that render-only attribute to `data-world-route`, added a namespace regression, and kept every original route-choice assertion unchanged. No failed test was bypassed. Initial images and report are archived separately.
