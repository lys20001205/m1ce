# V12 R5b: normal-input experience pass

The previous public R4d release was replayed for 12 continuous minutes from a fresh save, using keyboard/DOM controls and read-only snapshots. This was an informed AI play session, not a human blind playtest. It exposed an unattended 900 cargo loss in the first run and a later handgun strategy that defended the engine with little movement. Independent QA also reproduced taking damage while reading the live shop for 12 seconds, weak shipment feedback, and weak first carrying progression.

Changes:

- Opening the admitted Engine Armory freezes route, enemies, health, cargo deadlines and reload time. Buttons remain usable; closing the menu resumes play. F/Escape also close it. A separate manual pause remains intact. Attacks and held controls cannot leak through the menu; audio resumes on close.
- Shipment receipts distinguish loading, recovery and actual loss. Both the receipt and persistent ledger retain the difference between unsettled value and Bank. Loading the same crate or recovering it does not create another reward. A pooled cargo value pop makes the action legible in the playfield.
- Permanent purchases show the actual before/after effect and next-departure loadout. First carrying boots now change 2.8 to 3.6 m/s; later tiers are 4.0/4.4. Old save levels and Bank are retained. The existing small seven-level career still completes quickly; this pass does not invent a long progression tree or claim that issue solved.
- Handgun: 6 rounds, 1.15s automatic reload, 8.5m range. SMG: 24/1.55s. Rifle: 3/1.4s with its existing 24m three-target piercing. Shotgun: 2/1.3s with its existing five-pellet close burst. Moving and melee remain available while reloading; swapping, pausing, reading the shop or going to another route cannot refill a magazine. No ammunition purchase or extra input key was added. Enemy admission, attack damage and shotgun/rifle hit behavior are unchanged.
- Startup, HUD, manifest and cache-qualified release graph identify V12 R5b. Existing licensed models and frozen prior candidates are unchanged.

Validation and remaining limits are recorded in the local `artifacts/EXPERIENCE-DELIVERY.md`. A browser fixture is diagnostic evidence and is never counted as ordinary play. Existing Windows Chromium touch detection and WebKit audio capability failures remain environment-specific release limitations; applicable CI and independent candidate QA must be checked before publishing. Physical gestures, heat and subjective audio are unverified.
