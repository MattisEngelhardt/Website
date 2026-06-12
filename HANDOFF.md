# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@PLAN.md @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt. **STOP: bevor du irgendetwas baust, lies die oberste Sektion in brain.md — „Das Krisengespräch 12.06.2026".** Mattis hat am 12.06. die bisherige Umsetzung (Akt 0 + Akt I) als weit unter dem Anspruch abgelehnt und eine neue Qualitätsdoktrin verbindlich gemacht. Sie gilt für JEDE Szene und JEDEN Fable, auch für dich.

**Die Doktrin in einem Satz:** Hero-Visuals werden nie wieder „basic aus Code gemalt" (Canvas-Sprites, Primitive) — sie entstehen als echte Production-Assets in **Blender** (Sets, Bakes, Kamerapfade), laufen durch die bewiesene Pipeline **Blender → GLB → gltf-transform → three.js/WebGPU**, und abgenommen wird per **Side-by-side gegen die Referenz + ehrliche FPS** — „0 Console-Errors" reicht nicht mehr.

**Was seit der Krise steht (Tag 3, alles in brain.md „Tag 3 (12.06.)" mit exakten Pfaden/Befehlen):**
1. Doktrin + Wortlaut-Kritik + Mattis' 5 Entscheidungen dokumentiert (brain.md oben; PLAN.md-Roadmap ersetzt)
2. **Toolchain bewiesen**: uv installiert, blender-mcp als Projekt-MCP in `.mcp.json` (Tools laden ab deiner Session automatisch; Blender-GUI nötig für den Socket: N-Panel „BlenderMCP" → Connect; **nur EINE Instanz** — Absprache hier im HANDOFF, wer Blender gerade fährt), Blender-5.1-headless-Pattern funktioniert inkl. Cycles-OPTIX-Bake
3. **Pipeline-Proof PASS**: `scripts/blender/pipeline_proof.py` → 73-KB-GLB → `/dev/asset` → `node scripts/verify-asset.mjs`. Nutze das als Vorlage für jeden Asset-Load
4. Gemälde-Scans + PolyHaven-Material gesourct (`assets-src/`, gitignored), Tile-Pyramide für den Gigapixel-Threshold generiert

**Für Akt II (falls du der Stadt-Fable bist) heißt die Doktrin konkret:** Dein unkommittetes WIP (`src/scenes/city.ts`, `pixelwork.ts`, `src/worlds/city.ts`, `/city`-Routen, `Record.astro`) zuerst gegen die Doktrin reviewen — erwarte einen Teil-Rebuild. Keine primitiven Code-Rechtecke als Gebäude: echte Stadt-Geometrie aus Blender (Blockout + Bake, gern über MCP oder headless wie im Proof) ODER hochwertige gezeichnete Parallax-Ebenen in echter Tiefe; die Kamera fährt DURCH die Stadt, nicht davor; Side-by-side gegen Neo-Tokyo/Cyberpunk-Referenz-Artworks als Abnahme; Projekt-Routen sind Inszenierungen, keine Textlisten. Pixel-Style bleibt die künstlerische Aussage — aber auf Production-Niveau (Asset-Atlanten, choreografiertes Licht, CRT-Post als Finish).

**Koordination der parallelen Fables:** Der Akt-0/I-Fable rebuildet Tag 4–7 Gipfel + Meer (Blender-Sets, IFFT-Ozean) und besitzt `src/scenes/summit.ts`, `sea.ts`, `painting.ts`, `passage.ts` — Änderungen an deren Verträgen (Controller-Registry, Veil) nur mit Notiz in brain.md. Integration Welt-in-Welt-Nebelraum ist Tag 8. Bei Blender-Nutzung: hier im HANDOFF vermerken, solange du den Socket hältst.

**Nicht vergessen:** npm nur mit `$env:NODE_OPTIONS="--use-system-ca"`; NIE Dateien per PowerShell-Replace editieren (UTF-8-Mojibake — immer Edit/Write-Tool); neue Findings sofort in brain.md; nach jedem Commit pushen; am Session-Ende dieses HANDOFF.md neu schreiben.

**Von Mattis einsammeln:** Projekt-Fakten für die Akt-II-Case-Studies (Multi-Agent-Deck-System, VoiceForge, StudyMind, Strategy Agent — was, wie, Ergebnis, Screenshots); seine Fotos + Videos (blockiert Akt III / Tag 9); welcher Camino-Abschnitt gelaufen wurde (GPX-Kamerapfad); Domain-Entscheidung; FPS-Eindruck auf seinem Gerät; Cloudflare-Pages-Verbindung im Dashboard.
