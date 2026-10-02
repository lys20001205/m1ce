# ROUNDHOUSE V13 R1

R6c devoted separate screen rows to HUD, route, cargo accounting, guidance and every control. At812×332 the WebGL world occupied49%; at844×390 it occupied50%. The V13 layout uses the entire viewport, with semi-transparent controls at its edges. Primary health, engine, pending proceeds and Scrap are compact numbers; held/stored/stolen values stay distinct. Detailed accounting, current guidance, keyboard/touch help, sound, camera and logs live in a44px disclosure. Reading that disclosure pauses the simulation and clears held input; closing resumes only a pause caused by that disclosure. Existing manual pause survives.

All nine action buttons retain their original input nodes, keyboard bindings and game authorities. No economy, save format, collision, combat or stop-window changes. Physical phone gestures and heat remain unverified; simulated trusted touch is reported separately.

The detached Factory catwalk sections above each Kenney chassis have been removed. An integrated side-cut car shell connects its back wall/end supports to the existing4.12m walk deck. Engine windows, freight ribs, power vents and service cabinets distinguish types. The camera-facing side remains open; Kenney chassis and wheel assemblies keep their original transforms. Static shell meshes are shared per car type to bound GPU rebuild cost. The original21 CC0 models and source/license manifest remain bundled.

Version metadata, start URL and authored build identity are V13. Former footer-position assertions now require a world-first canvas and center-point hit testing for real edge controls;44px targets, non-overlap,160px canvas minimum and all gameplay/accounting assertions remain. Tests read detailed text as disclosure content and separately verify rendered compact state-sensitive danger instructions. The release guard compares build version against the exact package version; identity parsing still rejects missing, ambiguous or malformed BUILD.

Local evidence is retained under artifacts/ui-v13-before, ui-v13-after, normal-v13 and v13-gates. These are local diagnostics, not claims of human blind play. Independent QA and exact-commit CI must finish before publication.
