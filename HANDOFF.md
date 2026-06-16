# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@MAINPLAN.md  @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt (Astro 6 + Three.js WebGPU/TSL). **STOP — Start-Ritual zuerst (MAINPLAN §3c):** lies **HANDOFF.md → `MAINPLAN.md` → `brain.md`** (ganz unten **„Tag 13"**) + **`REDESIGN-LOBBY.md`** (der Awwwards-Blueprint, der diese Phase steuert), BEVOR du etwas baust. `MAINPLAN.md` = Master-Plan (Krise #2); `brain.md` = technisches Gedächtnis.

**Wo wir stehen:** Haupt-Wanderung (Akt 0→IV) steht + abgenommen. **Krise #2 / Workstream A (Main-Lobby)** läuft. **17.06.: Mattis hat die Raymarch-Lobby (Tag 12) hart verrissen** („man ist nicht wie im painting, blöcke billig, figur weg, optimiere EXTREM, blender mcp, parallel-agent"). → kompletter doktrin-reiner Rebuild diese Session.

**Diese Session (17.06., Workstream A Rebuild) erledigt + verifiziert:**
- ✅ **Nebelmeer = echte Blender-Geometrie statt TSL-Raymarch** (`scripts/blender/fog_set.py` → `public/assets/lobby/fog.glb`): billowende See, prozedural gebackene Vertex-Luminanz (warme Kämme/kühle Täler), web unlit + day-cycle-tint + aerial fade + Kontrast-Boost. **Löst Look UND Perf**: dramatisches moody Friedrich-Nebelmeer, **4–17fps → 58fps headed-Probe (~80 nativ 4060)**. Geometrie quasi gratis → Kuwahara-Radius zurück auf 4.
- ✅ **Wanderer-Figur entfernt** (explizit). **Outcrop vergrößert** als First-Person-Repoussoir (du BIST der Wanderer). Sky = billiger Gradient-Dome (kein Raymarch).
- ✅ **Carved Gold-Frames** (`scripts/blender/frame_set.py` → `frame.glb`): echtes gefrästes Museumsprofil (ogee/cove/bead) + baked gilt/AO, **4× instanziert in gestaffelter Tiefe** (nicht mehr Reihe), Kunst im Rabbet. Ersetzt die „billige" flache Box-Bevel.
- ✅ **2 parallele Opus-Agenten** (Mattis' Wunsch): #1 → `REDESIGN-LOBBY.md` (gnadenloser Verriss + Blueprint), #2 → `frame_set.py`.
- check 0 / build grün (13 S.) / verify-hub PASS / 0 Errors.

**⚠️ Harte Gotchas dieser Session (brain.md Tag 13):**
- **glTF-Achsen:** Blender +Z → glTF +Y. Ein in Blender nach +Z gebauter Rahmen lädt **flach liegend** → `frame.rotation.x = Math.PI/2` web-seitig. Mapping: glTF(x,y,z)=Blender(x,z,−y).
- **meshopt-Quantisierung frisst die echte Größe** (Dequant-Scale im Node-Transform). Kleine Assets (Frame) **NICHT meshopt-komprimieren → RAW-GLB shippen** (`cp assets-src/lobby/frame.glb public/...`). Größe via bbox ableiten. fog.glb bleibt meshopt (ganze `gltf.scene` einhängen ist ok).
- **Sub-Agenten haben KEINE Shell** (bestätigt) → sie schreiben nur Dateien, DU baust/run/debuggst. Blender-MCP-Socket live auf 9876 (`node scripts/blender/bl.mjs info`), aber Assets headless bauen (`blender.exe --background --factory-startup --python <script>`, bewährt). Blender-OPTIX-Bake fällt auf CPU zurück (HIPEW-Warnung) — egal, AO bäckt trotzdem.

**Nächster Brocken (REDESIGN-LOBBY.md P1.5–P2 + Integration):**
1. **Outcrop/Foreground aufwerten:** der First-Person-Fels ist noch crude low-poly → schöneren Blender-Fels (+ optional Plinth-Ledges für die nahen Tafeln, `plinth_set.py` aus dem Blueprint, noch nicht gebaut).
2. **Kuratierte, painterly-gegradete Stills** (P1.6) statt roher Welt-Screenshots in den Rahmen (City-Tafel liest zu dunkel) — `make-painting-derivatives.mjs`, eine einheitliche Friedrich/Aivazovsky-Palette.
3. **Sky aufwerten** (noch flach-orange) + **Placards an die Frame-Gruppe ankern** (sitzen noch DOM-unten-links).
4. **Integration A5/A6** (raus aus `/dev/hub` in die echte `/`): worlds/summit.ts Hub-Modus nach Threshold, index.astro Welten als echte `<a>`, passage.ts Frame→Navigate-Hook. Dann `verify-hub` auf `/` + Katalog/reduced-motion.
5. Danach Phase 3 **My Vacations** (B) → Camino (C) → Boot (D).

**Wie gearbeitet wird (MAINPLAN §3 — Pflicht):** strengster Senior-Awwwards-Reviewer, **Hero = echte Blender-Geometrie + baked light, Shader/Kuwahara = Finish** (NICHT shader-malen — genau das hat Mattis verrissen). Abnahme = **Side-by-side gegen Friedrich + ehrliche FPS headed** („0 Errors" reicht nie). Zweiter Opus reviewt/parallelisiert (nur Datei-Arbeit, keine Shell). **End-Ritual jede Session:** brain.md → MAINPLAN (+Ledger §0.1) → HANDOFF neu → commit+push.

**Standard-Gotchas:** npm/curl/uv → `$env:NODE_OPTIONS="--use-system-ca"` / `--ssl-no-revoke` / `--native-tls`. **Nie per PowerShell-Replace editieren** (Mojibake) — nur Edit/Write. **Dev-Port checken** (lief auf **4321**). Playwright `chromium.launch({channel:'chrome', args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']})` — **headed Probe ≈ 1.4× unter Mattis' nativem 4060** (Probe /dev/ocean 45–49 vs nativ 66 → Faktor zum Hochrechnen). gltf-transform IMMER `--compress meshopt --simplify false --palette false --join false --flatten false` (außer kleine Assets, s.o.). Commit auf `main`, Author `engelhardt.mattis06@gmail.com` (GCM, kein `gh`), **nach jedem Commit pushen**, Message endet `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Cloudflare-Pages-Limit < 25 MB/Datei.

**Offen an Mattis (`TODO(Mattis)`, nicht blockieren):** ehrliche FPS auf seinem nativen Browser bestätigen; finale 1-Zeilen pro Welt; Jakobsweg-Fotos; LinkedIn/Email/CV-URLs; Bio-/Projekt-Fakten. Mattis nimmt Zwischenstände ab. Permissions: **bypass ist an**.
