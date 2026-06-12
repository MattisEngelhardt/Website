# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@PLAN.md @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt. **STOP: bevor du irgendetwas baust, lies die oberste Sektion in brain.md — „Das Krisengespräch 12.06.2026".** Die Qualitätsdoktrin gilt für JEDE Szene und JEDEN Fable: Hero-Visuals entstehen als echte Production-Assets in **Blender** (Sets, Bakes, Kamerapfade), laufen durch die bewiesene Pipeline **Blender → GLB → gltf-transform → three.js/WebGPU**, abgenommen wird per **Side-by-side gegen die Referenz + ehrliche FPS** — „0 Console-Errors" reicht nicht.

**Stand der Welten:**
- **Akt II (Stadt) ist seit Tag 4 nach Doktrin REBUILT und abgenommen** (brain.md „Tag 4" — Pflichtlektüre, dort stehen alle Pipeline-Gotchas): echtes Blender-Set `public/assets/city/city.glb` (1,88 MB, ~100k Polys, AO-Vertex-Bake, extrudierte Neon-Glyphen), Kamerafahrt DURCH die Schlucht in Blender choreographiert + per Scroll gescrubbt, Spiegelstadt unter Pfützen-Straße, Pixel-Agenten mit Walk-Cycle, Mosaik/CRT/**Bloom**-Post. Side-by-side gegen Shibuya-Referenz ✓ (verify-out/city-sidebyside.png), verify-city + passage + hero PASS. Offen: FPS-Check auf Mattis' Gerät, Arcade (Tag 10), Record-Routen-Inszenierung.
- **Akt 0 + I**: Rebuild nach Doktrin steht AUS (Tag 4–7: Threshold-Tile-Zoom „durch den Rahmen", Blender-Set Gipfel, IFFT-Ozean + Schiffs-GLB). Wenn du der Akt-0/I-Fable bist: `scripts/blender/city_set.py` + `city_bake_export.py` sind die Vorlage für Set-Generierung, Vertex-AO-Bake und animierten Kamera-Export; `scripts/blender/pipeline_proof.py` für Textur-Bakes.

**Werkzeuge (alle bewiesen):**
1. **Blender steuern**: GUI-Socket läuft auf Port 9876 (N-Panel „BlenderMCP" → Connect; nur EINE Instanz — vermerke hier, wenn du ihn hältst. Aktuell: FREI). Falls die MCP-Tools nicht laden (war bei der Tag-4-Session so): `node scripts/blender/bl.mjs info|exec <py>|shot <png>|cmd` spricht das Protokoll direkt — Payload wird automatisch ASCII-escaped (sonst ECONNRESET, s. brain.md Tag 4). Headless geht parallel ohne Socket-Konflikt.
2. **GLB-Optimierung**: NIE blankes `gltf-transform optimize` — IMMER `--compress meshopt --simplify false --palette false --join false --flatten false` (sonst sterben Material-Namen + Mesh-Identität + ggf. Text-Geometrie).
3. **Look-Abnahme**: Blender-Stills (`city_still.py`-Pattern: Cycles/OPTIX, AgX, Volumen-Haze) → Read-Tool; Browser-Shots per Playwright (`scripts/peek-city.mjs`, `verify-city.mjs`); Side-by-side-Contact-Sheet mit sharp. Web-Grading ≠ Cycles: sRGB hebt dunkle Albedos (~×0.42 kompensieren), THREE.Color(hex) ist linear, Emissive moderat halten (brain.md Tag 4).

**Koordination:** Akt-0/I-Fable besitzt `src/scenes/summit.ts`, `sea.ts`, `painting.ts`, `passage.ts`; Stadt-Fable besitzt `city.ts`, `pixelwork.ts`, `worlds/city.ts`, `/city`-Routen, `Record.astro`. Verträge (Controller-Registry, Veil) nur mit Notiz in brain.md ändern. Integration Welt-in-Welt-Nebelraum ist Tag 8.

**Nicht vergessen:** npm nur mit `$env:NODE_OPTIONS="--use-system-ca"`; NIE Dateien per PowerShell-Replace editieren (UTF-8-Mojibake — immer Edit/Write-Tool); neue Findings sofort in brain.md; nach jedem Commit pushen; am Session-Ende dieses HANDOFF.md neu schreiben.

**Von Mattis einsammeln:** FPS-Eindruck auf seinem Gerät für `/` UND `/city` (scrollen + Maus wedeln — ruckelt es?); Jakobsweg-Fotos (assets/jakobsweg/ ist LEER, blockiert Akt III / Tag 9; Camino-Route + Flyover-Wunsch sind in Memory); Domain-Entscheidung (mattisengelhardt.com?); Cloudflare-Pages-Verbindung im Dashboard; ggf. echte Unterschrift für den Signature-Loader.
