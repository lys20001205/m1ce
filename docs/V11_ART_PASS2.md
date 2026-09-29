# V11 art direction pass 2

Baseline: `32d393b43f8d97a983a8c9fc3d43901768d3b087`.

This pass is deliberately visual. Simulation, damage, economy, progression, save data and audio rules are unchanged.

## Goals
- Replace the flat single-depth backdrop with three route-colored parallax layers while retaining the continuous ring world.
- Ground the train with a contact shadow and denser underframe/panel detailing, while keeping the cutaway side readable.
- Improve player/enemy silhouettes through physical geometry rather than persistent floating labels.
- Give melee/ranged combat stronger visual timing via a pooled swing arc, muzzle flash and enemy windup ground telegraph.
- Tighten route mood: industrial = warm foundry, freight = teal/amber yard, tunnel = cold dark conduit.
- Preserve mobile readability with subtle route-specific viewport grading and no new gameplay buttons.

## Performance boundaries
All repeated train detail remains instanced and is disposed on rebuild. Atmospheric layers use three fixed InstancedMesh batches and the windup telegraph uses one pooled InstancedMesh capped by the existing enemy limit. No new dynamic lights, post-processing pipeline, textures or external assets are introduced.

## Acceptance
The release gate requires 339 unit tests and 58 common mobile-art browser checks per browser, plus existing Chromium multi-touch checks. Public verification includes the changed view/actor/feedback/route presentation files so stale art code cannot pass deployment verification.

## Completion review (continuation)
Before publishing, ten tests using the actual built Three.js objects were added. On the inherited candidate, two passed and eight failed. They exposed windup progress counting in the opposite direction, scenery recenter/modulo jumps, redundant stationary matrix uploads, insufficient shadow coverage, camera-side decorative bars and incomplete disposal. These are corrected with the same gameplay values. Reduced-motion mode now freezes the extra warning pulse.

The full-canvas CSS filter and animated-background blur were removed to avoid extra mobile compositing. Color remains authored through materials, lighting and the existing inexpensive gradient overlays. Shared geometry is retained; owned meshes, buffers and materials are released idempotently.

The inherited browser script contained literal backslash-n text in an inserted instruction; it is fixed and all Python scripts are syntax-checked. A historical 160ms movement assertion had no guarantee that simulation/render frames advanced; the updated test waits at most 2.5 seconds for actual frame/simulation progress, records timing, and still requires the original movement distance. No input or gameplay rule is modified to pass it.

Final requirements: 339 unit tests, 16 model/presentation-runtime tests, and all existing browser assertions. The full art script still requires 58 common mobile-art checks plus five Chromium native multi-touch checks. Desktop compositions are labelled fixtures, not new blind gameplay.
