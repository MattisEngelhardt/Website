# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@MAINPLAN.md  @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt (Astro 6 + Three.js WebGPU/TSL). **STOP — Start-Ritual zuerst (MAINPLAN §3c):** lies **HANDOFF.md → `MAINPLAN.md` (§0.1 Ledger) → `brain.md`** (ganz unten **„Tag 14"**) + bei Lobby-Arbeit **`REDESIGN-LOBBY.md`**, BEVOR du etwas baust.

**Wo wir stehen — ALLE Workstreams A–F sind ✅ gebaut + verifiziert + committed/gepusht** (Krise #2 komplett). Die große 19.06.-Session lief **massiv parallel: 8 Opus-Subagenten** (Mattis' Wunsch „alles ideal parallel"), Modell = **Agenten autoren EXKLUSIVE Dateien, ICH baue/run/verifiziere/integriere/committe** (Sub-Agent-Shell ist intermittent → headless bauen bleibt mein Job; Permissions stehen auf `bypassPermissions`). Siehe Memory [[parallel-subagent-workflow]].

**Diese Session (19.06.) erledigt + verifiziert (je eigener Commit auf `main`):**
- ✅ **A · Hub auf `/` integriert (A5/A6) + Look-Pass + Mattis-Verriss #2 gefixt.** Einheitliche painterly Stills (`plate-grade.mjs`), leuchtendes Nebelmeer (hellste Masse), Aivazovsky-Himmel, **ForeRock** (`plinths.glb`) statt crude Outcrop, **echte Blender-Berge** (`peaks.glb`, 5 Ridges) hinter dem Nebel, **Blöcke entzerrt** (weiter Azimut-Bogen, KEINE Überlappung), `/` pusht durch Friedrichs echtes Gemälde → dissolvt in den Hub (Figur weg, 4 Placard-`<a>`). 56-57fps headless.
- ✅ **B · My Vacations** — `/vacations` phantom.land-Drag-Wall + Lightbox, 19 Fotos + 16 Videos (ffmpeg-static-Pipeline), Manifest 35 Items. verify-vacations PASS.
- ✅ **C · Camino** — kinoreife 7s-Blender-Bird's-Eye (`camino_set.py` CaminoFlight-Clip, AnimationMixer-Scrub), keine Floating-Marker. verify-camino PASS, 85-120fps.
- ✅ **D · Das Boot** — detaillierter Dreimaster (1.7k→21.6k tris, dichte Takelage/Ratlines/Segel) kreuzt als Aivazovsky-Silhouette vor der Sonne. verify-sea PASS.
- ✅ **E · Text-Purge** — Kitsch-Captions in sea/city/horizon gestrichen.

**⚠️ Harte Gotchas dieser Session (brain.md Tag 14 — LIES SIE):**
- **meshopt-Dequant frisst die Größe bei `getObjectByName`+`setScalar`** (Schiff lud winzig). Regel: solche Assets RAW shippen (`cp …_raw.glb public/…`), NICHT meshopt. Ganze-`gltf.scene`-mit-Node-Matrix-Assets (fog/peaks/plinths/camino) dürfen meshopt.
- **Blender 5.1: `action.fcurves` entfernt** (slotted Action) → `keyframe_new_interpolation_type` vor Insert.
- **ffmpeg fehlt + winget scheitert am Cert** → `npm i -D ffmpeg-static @ffprobe-installer/ffprobe`, Pfade via `FFMPEG_PATH`/`FFPROBE_PATH`. Lightbox-Videos `-t 30 -maxrate 3.5M` (< 25MB Cloudflare).
- **Achsen:** Boden-Geometrie up=+Z → glTF +Y → lädt aufrecht (keine Rotation); nur nach +Z gebaute Frontalflächen brauchen `rotation.x=π/2`.
- **Überlappende Hub-Blöcke = zu enger Azimut** → über weiten Bogen + Tiefe staffeln.
- **Lenis-Voyage nicht per Playwright-`scrollTo` scrubbar** → Szenen exponieren `window.__sea`/`__hub` zum direkten Treiben.

**Nächster Brocken (Phase 6 — Politur & Launch-Prep, MAINPLAN §14):**
1. **Mattis-Review einholen** auf seinem nativen 4060-Browser (`/`, `/sea`, `/city`, `/camino`, `/vacations`, `/horizon`) — ehrliche FPS + Look-Abnahme. Er reviewt live und gibt scharfes Feedback; danach gezielt nachtunen.
2. **Feinschliff offen:** Schiff-Silhouette evtl. noch dunkler + Money-Shot-Timing genau auf die Sonne; Hub-Placards Look auf `/`; Camino-Endcard wenn Jakobsweg-Fotos kommen; verwaiste `.c1/.c2/.c3`-CSS aufräumen.
3. **Launch-Prep:** kompletter Hard-Check §11 (alle Welten + Rückwege + Katalog/reduced-motion + Mobile), 0-Errors-Sweep, OG/Sitemap/Sound-Pass. Cloudflare-Pages-Deploy (Mattis verbindet im Dashboard, Domain `mattisengelhardt.com`).
4. Danach finale Welt-1-Zeilen + Bio-/Projekt-Fakten von Mattis einsetzen (`TODO(Mattis)`-Marker grep).

**Wie gearbeitet wird (MAINPLAN §3 — Pflicht):** strengster Senior-Awwwards-Reviewer, **Hero = echte Blender-Geometrie + baked light, Shader/Kuwahara = Finish**. Abnahme = **Side-by-side + ehrliche FPS headed** („0 Errors" reicht nie). Bei großen unabhängigen Brocken **parallele Opus-Agenten** (exklusive Dateien, ich integriere). **End-Ritual jede Session:** brain.md → MAINPLAN (+Ledger §0.1) → HANDOFF neu → commit+push.

**Standard-Gotchas:** npm/curl/uv → `$env:NODE_OPTIONS="--use-system-ca"` / `--ssl-no-revoke` / `--native-tls`. **Nie per PowerShell-Replace editieren** (Mojibake) — nur Edit/Write. **Dev-Port checken** (lief auf **4325**). Playwright `chromium.launch({channel:'chrome', args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']})` — headed Probe ≈ 1.4× unter nativem 4060. gltf-transform IMMER `--compress meshopt --simplify false --palette false --join false --flatten false` (außer RAW-Assets s.o.). Commit auf `main`, Author `engelhardt.mattis06@gmail.com` (GCM, kein `gh`), **nach jedem Commit pushen**, Message endet `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Cloudflare-Pages-Limit < 25 MB/Datei.

**Offen an Mattis (`TODO(Mattis)`, nicht blockieren):** ehrliche FPS nativ bestätigen + Look-Abnahme aller 5 Welten; finale 1-Zeilen pro Welt; Jakobsweg-Fotos; LinkedIn/Email/CV-URLs; Bio-/Projekt-Fakten. Permissions: **bypass ist an**.
