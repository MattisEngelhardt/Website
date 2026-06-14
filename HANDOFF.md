# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@PLAN.md  @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt. **STOP: bevor du irgendetwas baust, lies in brain.md die oberste Sektion „Das Krisengespräch 12.06.2026" + die Tagesabschnitte „Tag 4", „Tag 5–6", „Tag 6–7".** Die Qualitätsdoktrin gilt für JEDE Szene: Hero-Visuals sind echte Production-Assets aus **Blender** (Sets, Bakes, Kamerapfade) ODER (NEU, „gamechanging") **top-notch GRATIS Production-Assets/Tools** (CC0/MIT, pipeline-passend) — selbst bauen nur, wenn nichts Passendes existiert oder es Mattis' eigenen Stil tragen muss. Alles läuft durch **Blender → GLB → gltf-transform → three.js/WebGPU/TSL**, Abnahme per **Side-by-side gegen die Referenz + ehrliche FPS** — „0 Console-Errors" reicht NICHT.

**Stand der Welten:**
- **Akt 0 (Gipfel `/`) — REBUILT + abgenommen** (brain.md „Tag 5–6"): Eröffnung „Durch den Rahmen" (Signature-Loader „Mattis E.", Museums-Threshold mit 35-MP-Gigapixel-Zoom durch die Leinwand, echter Blender-Summit-Set). verify-threshold + verify-hero PASS.
- **Akt I (Meer `/sea`) — REBUILT + abgenommen** (brain.md „Tag 6–7", frisch): **echter Tessendorf-IFFT-Ozean auf WebGPU-Compute** (`src/scenes/ocean.ts`, JONSWAP + Stockham-FFT, gegen DFT validiert), Dual-Cascade, physisch korrektes Wasser-Shading (Fresnel/Reflexion/Subsurface/Schaum), exakte Aivazovsky-Palette, **Blender-Brigg + Skiff** (`scripts/blender/sea_set.py` → `public/assets/sea/sea_assets.glb` 26 KB) die per ehrlicher Buoyancy schwimmen, Kuwahara-Painterly-Finish. verify-sea/hero/ocean PASS, Build grün, FPS=66 (N=128) auf Mattis' Gerät. Spike: `/dev/ocean`. ⏳ optional: Segel-Wölbung, 3. Kaskade, Gesamt-Szenen-FPS mit Kuwahara.
- **Akt II (Stadt `/city`) — REBUILT + abgenommen** (brain.md „Tag 4"): echtes Blender-Set, Kamerafahrt, Spiegelstadt, Pixel-Agenten, Bloom/CRT.
- **Akt III (Camino `/camino`) — STEHT AUS, nächster großer Brocken.** Mattis' klarer Wunsch: **3D-Satellitenflug** über den Camino Portugués, „extrem ultra realistic, krasseres Google-Maps-Feeling", echte Topografie, 7–10s kinoreifer Flyover von oben über die genannten Stationen (Porto→Santiago). **NEUE DOKTRIN ANWENDEN: zuerst gratis top-notch Quelle recherchieren** — Google Photorealistic 3D Tiles (Kosten prüfen!), Cesium ion (Free-Tier?), BlenderGIS (SRTM-DEM + Sentinel-2/Esri, gratis). GPX-Kamerapfad. Stationen + Wunsch: Memory `camino-portugues-flyover.md`. Jakobsweg-Fotos zweitrangig (Ordner war leer → ggf. nachfordern).

**Werkzeuge (alle bewiesen):**
1. **Blender headless** (kein Socket/GUI, kein Konflikt, läuft parallel): `& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup --python <script>`. Cycles/OPTIX-GPU-Bake ok. Vorlagen: `scripts/blender/{summit,city,sea}_set.py` (deterministische Python-fBm/Lofts, Geometry-only, AO→Vertex) + `*_still.py` (Look-Dev-Render).
2. **GLB-Optimierung**: NIE blankes `optimize` — IMMER `--compress meshopt --simplify false --palette false --join false --flatten false`.
3. **WebGPU-IFFT / TSL-Compute** (neu, `ocean.ts`): `StorageTexture` · `textureStore(...).toWriteOnly()` · `textureLoad(tex, ivec2)` · `int(instanceIndex)` (uint→int casten!) · `kernel().compute(N*N)` · `renderer.computeAsync([nodes])` (Batch!). `Fn(([d]:any)=>)` → const als `: any`. Details: brain.md „Tag 6–7".
4. **Verifikation** (Dev-Server muss laufen; Port checken — astro nimmt oft **4323**): `node scripts/verify-{threshold,hero,city,sea,ocean,passage}.mjs <baseUrl>`. Screenshots in `verify-out/` per Read-Tool ansehen = die Look-Abnahme. ⚠️ verify-passage hat 2 PRE-EXISTING headless-Remount-Fails (keine Regression).

**Koordination:** Falls parallel ein zweiter Fable läuft: Akt-0/I-Fable besitzt `summit.ts`, `sea.ts`, `ocean.ts`, `threshold.ts`, `painting.ts`, `passage.ts`, `signature.ts`; Stadt-Fable besitzt `city.ts`, `pixelwork.ts`. Blender headless läuft parallel; nur EINE Blender-GUI-Socket-Instanz gleichzeitig.

**Nicht vergessen:** npm nur mit `$env:NODE_OPTIONS="--use-system-ca"`; NIE Dateien per PowerShell-Replace editieren (UTF-8-Mojibake — immer Edit/Write); in `global.css` kein `:global()` (reines Stylesheet); nach jedem Commit pushen (main, GCM-Auth); am Session-Ende dieses HANDOFF.md + brain.md neu schreiben; neue Findings sofort in brain.md.

kommentar von mattis (Stand 15.06.):
- ✅ Akt I Meer: IFFT-Wasser physisch korrekt, Aivazovsky-Palette exakt, Brigg+Skiff aus Blender. Letzter Look-Check auf Mattis' Full-Res-Screen offen (er hat Zwischenstände abgenommen, sagte „mach weiter ohne meine Meinung").
- ⭐ **Gamechanger-Prinzip:** top-notch gratis Blender/Asset-Lösungen elegant nutzen statt alles selbst code-malen (Memory `use-free-topnotch-assets.md`). Bei Akt III (Camino) ZUERST anwenden!
- ⏳ Camino = 3D-Satellitenflug, ultra realistic, echte Topografie, 7–10s. Quelle recherchieren (Google 3D Tiles / Cesium / BlenderGIS — Kosten/Gratis!).
- ✅ domain mattisengelhardt.com (astro.config). ✅ Unterschrift-Loader gebaut.
