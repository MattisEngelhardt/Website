# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@MAINPLAN.md  @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt (Astro 6 + Three.js WebGPU/TSL). **STOP — Start-Ritual zuerst (MAINPLAN §3c):** lies **HANDOFF.md → `MAINPLAN.md` → `brain.md`**, BEVOR du irgendetwas baust. `MAINPLAN.md` ist der übergeordnete Master-Plan (Krise #2); `brain.md` ist das technische Gedächtnis — oben „⚠️ DAS KRISENGESPRÄCH 12.06." + die Tagesabschnitte, ganz unten **„Tag 11"** (diese Phase).

**Wo wir stehen:** Die komplette Haupt-Wanderung (Akt 0→IV) steht End-to-End und ist abgenommen (brain.md Tag 4–10). **Krise #2** (MAINPLAN.md) hat den nächsten großen Bogen definiert: das Nebelmeer wird zur **Main-Lobby** mit edlen Galerie-Tafeln, dazu **My Vacations** (phantom.land-Drag-Galerie), **Camino**-Rebuild als Blender-Kino-Bird's-Eye, **Boot** neu inszenieren, **Text-Purge**. Status-Ledger + Workstreams A–F: **MAINPLAN.md §0.1 / §4–9**.

**Diese Session (16.06., Phase 1 Quick Wins — MAINPLAN §14) erledigt + verifiziert:**
- ✅ **Workstream F · Threshold-Zoom** (`src/scenes/threshold.ts`): `FOCAL_X 0.5→0.32`, `FOCAL_Y→0.5`, `SMAX 7.2→4.3`. Der Push landet jetzt im Nebelmeer/den Nebelbergen der **linken Bildhälfte** statt im Mantel des Wanderers, scharf+sanft. verify-threshold PASS + Deep-Frame-Look-Abnahme (Read).
- 🟧 **Workstream E · Text-Purge** (Copy-Teil): Intro-h2 + 4 `world-line`-Sprüche → ehrliche 1-Zeiler; Frontispiz-h1 (Sea/City/Horizon) entkitscht; **deutscher Leak „begehbares Kunstwerk" raus** (Bug); **„City of Agents" → „The City"** überall user-facing (inkl. `passage.ts` Übergangs-Plakette). `check` 0 / `build` grün (12 Seiten). Details + die **offene Hälfte** (Flavor-Captions strukturell entfernen — braucht Controller-Timeline + verify-Anpassung) stehen in brain.md „Tag 11" + MAINPLAN §0.1-Ledger.

**Nächster Brocken (MAINPLAN §14 Phasing):**
1. **Workstream E abschließen** (klein): die `.c1/.c2/.c3`-Flavor-Captions in `sea/city/horizon` strukturell entfernen ODER auf je 1 reduzieren — dabei `worlds/{sea,city,horizon}.ts`-Scroll-Timeline UND `verify-{sea,city,horizon}.mjs`-Opacity-Checks mitziehen (sonst rot). Aktuell nur in-place entkitscht.
2. **Phase 2 — Workstream A · Die Main-Lobby (Kern, ⭐Herzstück, MAINPLAN §4):** auf `src/scenes/summit.ts` aufbauen (Nebel-Hub-Rohform existiert: Aivazovsky-Himmel, 7 Nebel-Layer, Maus-als-Wind, Kuwahara+Reality-Lens). Erst Spike `src/pages/dev/hub.astro` (Tafeln/Pan/Hover-Lens/Dolly + FPS-Overlay), dann Integration, `scripts/verify-hub.mjs`, Side-by-side gegen Friedrich.
3. Danach Phase 3 **My Vacations** (B) → Phase 4 **Camino** (C) → Phase 5 **Boot** (D) → Phase 6 Politur/Launch.

**Wie gearbeitet wird (MAINPLAN §3 — Pflicht):** Du bist der **strengste Senior-Awwwards-Reviewer** und baust UND prüfst dich selbst auf dem Localhost (headed, echtes WebGPU). **Doktrin:** Hero-Visuals = echte Blender-Assets / gratis top-notch CC0-Daten / physikalisch plausible Sim; Shader = Finish. ⭐ **Gamechanger-Prinzip:** bei JEDEM Hero-Element zuerst gratis top-notch Quelle prüfen. **Abnahme = Side-by-side gegen Referenz + ehrliche FPS auf 4060 (headed)** — „0 Errors" reicht NIE. **End-Ritual jede Session (MAINPLAN §3d):** brain.md-Findings → MAINPLAN.md (+ Ledger §0.1) → HANDOFF.md neu → commit+push.

**Gotchas (alle bewiesen, MAINPLAN §13 / brain.md):** npm/curl/uv brauchen `$env:NODE_OPTIONS="--use-system-ca"` / `--ssl-no-revoke` / `--native-tls`. **Nie per PowerShell-Replace editieren** (UTF-8-Mojibake) — nur Edit/Write. `global.css`: kein `:global()`. gltf-transform NIE blank `optimize` (gelockte Flags). Blender headless: `& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup --python <script>`. Dev-Port checken (**astro nahm 4325**; 4321–4324 oft belegt). Playwright `chromium.launch({ channel: 'chrome' })`. Headless-FPS (ANGLE) ist NICHT ehrlich → nur headed `/dev/*`-Overlays. **verify-passage hat 2 PRE-EXISTING Headless-Remount-Fails** (`.descend` click-timeout + descent-scrub) — KEINE Regression. Commit auf `main`, Author `engelhardt.mattis06@gmail.com` (GCM, kein `gh`), **nach jedem Commit pushen**, Message endet `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Cloudflare-Pages-Limit < 25 MB/Datei.

**Offen an Mattis (`TODO(Mattis)`, nicht blockieren — MAINPLAN §15):** finale 1-Zeilen pro Welt (die gesetzten sind §8-Vorschläge); 1–2 weitere Awwwards-Lieblings-Refs (zusätzlich zu phantom.land); Jakobsweg-Fotos (`assets/jakobsweg` leer); Österreich-Über-den-Wolken-Foto (Horizont-Kontakt); LinkedIn/Email/CV-URLs; Projekt-/Bio-Fakten; finaler „City"-Name. Mattis: „mach weiter ohne meine Meinung", er nimmt Zwischenstände ab.
