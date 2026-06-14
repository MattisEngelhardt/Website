# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@PLAN.md @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt. **STOP: bevor du irgendetwas baust, lies in brain.md die oberste Sektion „Das Krisengespräch 12.06.2026" + die Tagesabschnitte „Tag 4", „Tag 5–6".** Die Qualitätsdoktrin gilt für JEDE Szene: Hero-Visuals sind echte Production-Assets aus **Blender** (Sets, Bakes, Kamerapfade), laufen durch **Blender → GLB → gltf-transform → three.js/WebGPU**, Abnahme per **Side-by-side gegen die Referenz + ehrliche FPS** — „0 Console-Errors" reicht nicht.

**Stand der Welten:**
- **Akt 0 (Gipfel `/`) ist nach Doktrin REBUILT + abgenommen** (brain.md „Tag 5–6", Pflichtlektüre): Die komplette **Eröffnung „Durch den Rahmen"** steht — (1) **Signature-Loader „Mattis E."** schreibt sich von Hand, das E schwingt aus und unterstreicht alles (`src/lib/signature.ts` + Loader-DOM/arm-Script in `World.astro`, `@fontsource/allura`); (2) **Museums-Threshold** mit dem neuen 35-MP-Gemälde im Goldrahmen → Scroll schiebt die Kamera per Gigapixel-Zoom DURCH die Leinwand → Cross-Dissolve in die LEBENDE Szene (`src/scenes/threshold.ts`, DOM in `index.astro`); (3) **echter Blender-Summit-Set** `public/assets/summit/summit.glb` (zerklüfteter Friedrich-Fels mit AO-Bake, Krags, ferne Gipfel), der Wanderer steht auf echtem 3D-Fels; TSL-Himmel/Nebel + Kuwahara-Painterly + Realitäts-Linse + White-out-Descent unverändert. verify-threshold + verify-hero PASS, Build grün.
- **Akt II (Stadt `/city`) ist seit Tag 4 REBUILT + abgenommen** (brain.md „Tag 4"): echtes Blender-Set, Kamerafahrt durch die Schlucht, Spiegelstadt, Pixel-Agenten, Bloom/CRT-Post.
- **Akt I (Meer `/sea`) Rebuild steht AUS** — das ist der nächste große Doktrin-Brocken: IFFT-Ozean (JONSWAP, Referenz MIT Spiri0/Threejs-WebGPU-IFFT-Ocean) + ehrliche Buoyancy + Schiffs-GLB + Scroll-Sonnenuntergang; Side-by-side gegen `assets-src/paintings/aivazovsky_capmartin_3882.jpg`. Aktuell läuft `/sea` noch auf der prozeduralen Gerstner-Version (brain.md Status).
- **Akt III (Camino `/camino`)** — Mattis' klarer Wunsch (s.u.): **3D-Satellitenflug** über den Camino Portugués, „extrem ultra realistic, krasseres Google-Maps-Feeling", echte Topografie. Recherchiere die beste Quelle (BlenderGIS SRTM+Sentinel-2, oder Cesium/Google Photorealistic 3D Tiles — prüfe Kosten/Gratis!), GPX-Kamerapfad. Jakobsweg-Fotos zweitrangig.

**Werkzeuge (alle bewiesen):**
1. **Blender headless** (kein Socket/GUI nötig, kein Konflikt): `& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup --python <script>`. Cycles/OPTIX-GPU-Bake funktioniert. Vorlagen für Set-Generierung + AO-Bake→Vertex + Export: **`scripts/blender/summit_set.py`** (deterministische Python-fBm, Geometry-only) und `city_set.py`+`city_bake_export.py`. GUI-Socket (Port 9876) nur falls interaktiv nötig — **aktuell FREI**.
2. **GLB-Optimierung**: NIE blankes `optimize` — IMMER `--compress meshopt --simplify false --palette false --join false --flatten false`.
3. **Painting-Assets**: `scripts/make-tiles.mjs` (DeepZoom .dzi) + `scripts/make-painting-derivatives.mjs` (overview/full webp für den Threshold-Zoom).
4. **Verifikation** (Dev-Server muss laufen; Port checken — 4321/4322 oft belegt → astro nimmt 4323): `node scripts/verify-threshold.mjs <baseUrl>` (Loader→Museum→Durchstoß→Dissolve→Descent, Contact-Sheet), `verify-hero.mjs`, `verify-city.mjs`, `verify-sea.mjs`, `verify-passage.mjs`. Screenshots in `verify-out/` per Read-Tool ansehen = die Look-Abnahme.

**Koordination:** Falls parallel ein zweiter Fable läuft: Akt-0/I-Fable besitzt `summit.ts`, `sea.ts`, `threshold.ts`, `painting.ts`, `passage.ts`, `signature.ts`; Stadt-Fable besitzt `city.ts`, `pixelwork.ts`. Nur EINE Blender-GUI-Instanz (Socket) gleichzeitig — headless geht parallel.

**Nicht vergessen:** npm nur mit `$env:NODE_OPTIONS="--use-system-ca"`; NIE Dateien per PowerShell-Replace editieren (UTF-8-Mojibake — immer Edit/Write); in `global.css` kein `:global()` (reines Stylesheet, nur platte Selektoren); neue Findings sofort in brain.md; nach jedem Commit pushen; am Session-Ende dieses HANDOFF.md neu schreiben.

**Von Mattis einsammeln / offen:** FPS-Eindruck auf seinem Gerät (`/` UND `/city` scrollen + Maus wedeln — ruckelt es?); Cloudflare-Pages im Dashboard mit dem Repo verbinden; Akt-0-Feinschliff (brain.md: Crags weniger zweighaft, formale Side-by-side gegen das Gemälde).

kommentar von mattis (Stand 14.06. — erledigt markiert):
- ✅ neue ~30-MB-Version „der wanderer über dem nebelmeer" unter /assets/assets-src/paintings — JETZT im Deep-Zoom-Threshold verbaut (35 MP, 13-Level-Tiles + webp-Derivate).
- ⏳ jakobswegfotos nicht so wichtig — der Kern: **3D animiert die komplette map wie satelliten animation extrem ultra realistic (krasseres google maps feeling) über den camino portugues** drübergleiten, topographie genau wie in realität. (weiß nicht ob blender hier das beste ist oder du woanders genau das entnehmen kannst → recherchieren: Google Photorealistic 3D Tiles / Cesium ion / BlenderGIS). Stationen hat er schon genannt.
- ✅ domain: mattisengelhardt.com (steht in astro.config.mjs).
- ✅ Unterschrift „Mattis E." mit ausschwingendem E als Loadingscreen — gebaut (Allura-Script, clean/elegant, der geschriebene Teil bleibt).
