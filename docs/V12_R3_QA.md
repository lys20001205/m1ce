# V12 R3 — local candidate, targeted correction

Build: V12-KENNEY-REVERSE-R3-20260930. R2 frozen copies are unchanged. No push, deploy or upload.

## Existing-enemy docking pressure
R2's no-new-spawn window did not protect the player from enemies already aboard. R3 grants a single 25-second player ward on first braking/auto-docking/entry near each depot during lap 1. It blocks enemy damage, not crane/tunnel damage, and never heals or removes enemies. The 35-second equipment guard remains 75% mitigation. Absolute expiry and station Set prevent re-entry, braking, direction changes and cargo reload from refreshing either timer. Later laps do not receive the player ward.

The HUD shows the player timer, a floor ring, a final-five-second warning, and explicit expiry/remaining old-enemy danger. Player tags retain interior/roof/depot layer information.

Diagnostic comparison: identical FREIGHT station placement and three seeds, with one pre-existing boarder and no defence. At 20 s R2: HP 0 / one death; R3: HP 100 / zero deaths. At 30 s R3: HP 64 / zero deaths; at 60 s R3: HP 0 / two deaths, one natural new spawn. This demonstrates a finite observation window, not indefinite safe stopping. Existing and newly born enemies are counted separately in artifacts/v12-r3/old-enemy-pressure.json.

## Scope and outstanding verification
Wheel geometry, roof presentation and normal-input checks are recorded separately below after their runs. Prior independent R2 passes (direction, reverse, cargo economics) are retained as R2 evidence and are not relabelled as R3. Full release gate remains unpassed because of the previously recorded Chromium touch/keyboard combat fixture and Windows WebKit AudioContext limitations. Real phone gestures, heating, subjective sound and human visual preference are not verified.

## Wheels and visual hierarchy
The imported wheels-front/back objects are merged bogie meshes, not axle-centred single wheels. R3 splits their actual indexed tyre/hub triangles into four independent axle-centred rotating meshes per bogie, preserves every original bogie transform, and leaves suspension static. Three selected train GLBs are tested directly, retaining every triangle. This adds four draw calls per bogie without more triangles or downloaded bytes.

The roof now has a continuous tread deck at exactly y=4.12, with the imported catwalk set behind the character lane and scaled from its actual deck height. Nearby overhead crane material is independently cloned and fades to 45% for roof players only, retaining the red danger plane; interior view restores opaque material. It does not change collision.

## Normal input result
Fresh normal URL and empty browser profile, keyboard and visible UI only (read-only snapshots): first F requests approach docking; automatic STOP at progress .26; single F at the connected bridge enters depot; next F picks 450; next F returns/loads. Entry HP was 73 from damage during the preceding moving approach, not a full-health fixture. On the roof with the existing boarder and thief, HP stayed 73 after 10 and 20 seconds without defence. At 30 seconds it was 37; at 60 seconds HP was 0, two deaths, engine 172. The theft completed during the deliberate long idle and removed 450 from pending proceeds. No defence or repair was used during this observation.

Evidence: artifacts/v12-r3-normal/report.json plus requested/docked/single-F-entry/held/loaded/roof-idle-10/20/30/60.png. Initial harness attempt timed out after its default 30-second wait before the first depot; report-attempt1.json is preserved. The explicit 60-second arrival wait then completed with zero errors.

## Local validation
374/374 npm tests pass, including new old-enemy ward, expiry, non-enemy hazard, later-lap and anti-refresh checks, and three actual GLB wheel geometry tests. The 16 model round-trip tests also pass (19/19 when run together with the three wheel tests). Browser wheel frames and short landscape results: artifacts/v12-r3-wheels/report.json. R3 targeted normal play is complete with zero errors; no repeat of the prior 10-minute R1 session or passed R2 cases was necessary. Independent R3 verification is pending the parent QA. The previously failed complete release gate has not been reclassified as passed.

Wheel browser diagnostics completed: 8 scenes, zero errors, 8 fixed bogies and 32 rolling tyres. Ordinary frames measured 118–119 draw calls and about 20k triangles. 812×332 game canvas height 162.4px, all nine control targets at least 44px. Hazard composition is diagnostic placement, distinct from ordinary forward/STOP/reverse inputs. The hazard screenshot fixture explicitly uses the FREIGHT sweep midpoint with player at craneX; the first diagnostic framing attempt is preserved.

Final visibility correction: the near-roof crane also disables depth testing while translucent so background buildings cannot hide it; the red hazard plane is rendered over the deck. Both return to normal crane depth testing in the interior view. This last rendering-only correction passed the same eight targeted scenes and final 374 unit + 16 round-trip tests. Normal-input gameplay results predate this material-only correction; simulation is identical.
