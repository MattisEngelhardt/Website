# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@MAINPLAN.md  @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt (Astro 6 + Three.js WebGPU/TSL). **STOP — Start-Ritual zuerst (MAINPLAN §3c):** lies **HANDOFF.md → `MAINPLAN.md` → `brain.md`**, BEVOR du etwas baust. `MAINPLAN.md` = übergeordneter Master-Plan (Krise #2); `brain.md` = technisches Gedächtnis — oben „⚠️ KRISENGESPRÄCH 12.06." + Tagesabschnitte, ganz unten **„Tag 12"** (diese Phase).

**Wo wir stehen:** Haupt-Wanderung (Akt 0→IV) steht End-to-End + abgenommen (brain.md Tag 4–10). **Krise #2** (MAINPLAN) definiert den nächsten Bogen: Nebelmeer→**Main-Lobby** mit Galerie-Tafeln (A), **My Vacations** (B), **Camino**-Rebuild (C), **Boot** (D), **Text-Purge** (E), Threshold-Zoom (F ✅). Status-Ledger: MAINPLAN §0.1.

**Diese Session (16.06., Phase 2 — Workstream A „Die Main-Lobby", Mattis: „direkt die Lobby") erledigt + verifiziert:**
- ✅ **Spike `/dev/hub` steht** — das Nebelmeer als begehbare Galerie. `src/scenes/hub.ts` (baut auf Akt-0-Rezepten auf; `summit.ts` exportiert jetzt `lerpPalette/fbm/drawWanderer/SkyPalette`): Maus = Wind + **Blick-Pan** (Yaw-Clamp), 4 gerahmte Tafeln mit **echten Welt-Renders**, **Hover wischt die Malerei klar** (geteilte Painting-Lens) + lesbare DOM-Placards, **Klick dollyt durch den Rahmen** (Money-Shot: die Welt füllt den Screen). + `src/pages/dev/hub.astro` (FPS-Overlay, `?hour ?fov ?yaw ?nav`), `scripts/capture-plates.mjs` (backt echte Renders→`public/assets/plates/*.webp`), `scripts/verify-hub.mjs` (PASS). check 0 / build grün (13 S.) / 0 Errors.
- ✅ **Quick-Fix Sonne** (`horizon.ts`): entschärft, glüht bei t=0.5 warm statt auszubrennen (t=0.9 ist gewollter Gold-out).
- ✅ **Zwei gnadenlose Review-Runden** (zweiter Opus): alle P0/P1 adressiert — echte Plates statt Platzhalter, Nebel kühler/dichter (Friedrich-Blaugrau), breiter bevelter Goldrahmen + Soft-Shadow, Wanderer fest auf dem Fels, Placards mit Backplate. ⚠️ **Sub-Agenten bekommen KEINE Shell (Bypass vererbt sich nicht)** → Reviewer-Scripts selbst laufen lassen ODER vorher frische Screenshots erzeugen und ihn nur als Bild-Gutachter einsetzen.

**Nächster Brocken (MAINPLAN §14, Phase 2-Rest → 3):**
1. **Nebelmeer dramatischer** (ehrlich der schwächste Punkt): liest jetzt als luminöse Bank, aber flache Billboard-Planes haben Grenzen → entweder ein volumetrischer/raymarched Nebel-Layer (Muster `horizon.ts`) ODER mehr/größere überlappende Banks. Side-by-side gegen `assets-src/paintings/...Sea_of_Fog.jpeg`.
2. **Integration A5/A6** (aus dem Spike in die echte Seite): `worlds/summit.ts` → Hub-Interaktionsmodus NACH dem Threshold-Push statt Frontispiz+Descent; `index.astro` → Welten als echte `<a>` (SEO/Katalog/Klick-Ziel), Frontispiz minimal; `passage.ts` → additiver Frame→Navigate-Hook (Klick-Dolly löst echte Astro-Nav aus → abgenommener Veil). Lenis/Cleanup wie gehabt. Dann `verify-hub` auf die echte `/` erweitern + Katalog/reduced-motion-Pfad.
3. **Workstream E** strukturellen Caption-Cut abschließen (klein, war diese Session bewusst nicht angefasst — Reviewer screenshotte parallel die Welt-Seiten): `.c1/.c2/.c3` in `worlds/{sea,city,horizon}.ts`-Timeline + `verify-{sea,city,horizon}.mjs`-Opacity-Checks synchron ziehen.
4. Danach Phase 3 **My Vacations** (B) → 4 **Camino** (C) → 5 **Boot** (D) → 6 Politur/Launch.

**Wie gearbeitet wird (MAINPLAN §3 — Pflicht):** strengster Senior-Awwwards-Reviewer, baust UND prüfst dich auf Localhost (headed, echtes WebGPU). Doktrin: Hero = echte Blender-Assets / gratis top-notch CC0 / physikalische Sim; Shader = Finish. ⭐ Gamechanger: bei JEDEM Hero-Element zuerst gratis top-notch Quelle prüfen. **Abnahme = Side-by-side + ehrliche FPS auf 4060 (headed)** — „0 Errors" reicht nie. **Mattis will, dass ein zweiter Opus jede große Änderung gnadenlos auf Localhost reviewt** (nicht nur Code). **End-Ritual jede Session:** brain.md → MAINPLAN (+Ledger §0.1) → HANDOFF neu → commit+push.

**Gotchas (alle bewiesen, MAINPLAN §13 / brain.md):** npm/curl/uv → `$env:NODE_OPTIONS="--use-system-ca"` / `--ssl-no-revoke` / `--native-tls`. **Nie per PowerShell-Replace editieren** (Mojibake) — nur Edit/Write. Fonts: `@fontsource-variable/fraunces` (Family `'Fraunces Variable'`), Import im JS-`<script>`, NICHT als CSS-`@import` im rohen `<style>`. Nach neuen Imports liefert Vite 1× **504 „Outdated Optimize Dep"** → Dev-Server-Neustart. **Dev-Port checken** (diese Session lief auf **4321** nach Kill aller node-Prozesse; sonst oft 4325). Playwright `chromium.launch({channel:'chrome', args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']})`. Headless-FPS (ANGLE) NICHT ehrlich → nur headed `/dev/*`-Overlays. `capture-plates.mjs`: `addInitScript` `sessionStorage 'seen-signature'='1'` VOR goto (sonst Loader im Screenshot). **verify-passage hat 2 PRE-EXISTING Headless-Remount-Fails** — keine Regression. Commit auf `main`, Author `engelhardt.mattis06@gmail.com` (GCM, kein `gh`), **nach jedem Commit pushen**, Message endet `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Cloudflare-Pages-Limit < 25 MB/Datei.

**Offen an Mattis (`TODO(Mattis)`, nicht blockieren — MAINPLAN §15):** finale 1-Zeilen pro Welt; 1–2 weitere Awwwards-Refs; Jakobsweg-Fotos (`assets/jakobsweg` leer); LinkedIn/Email/CV-URLs; Projekt-/Bio-Fakten; finaler „City"-Name. Mattis: „mach weiter ohne meine Meinung", er nimmt Zwischenstände ab. Permissions: **bypass ist an**.
