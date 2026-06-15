# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@PLAN.md  @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt. **STOP: bevor du irgendetwas baust, lies in brain.md die oberste Sektion „Das Krisengespräch 12.06.2026" + die Tagesabschnitte „Tag 4", „Tag 5–6", „Tag 6–7", „Tag 8".** Die Qualitätsdoktrin gilt für JEDE Szene: Hero-Visuals sind echte Production-Assets aus **Blender** (Sets, Bakes) ODER **top-notch GRATIS Production-Assets/Daten** (CC0/MIT/CC-BY, pipeline-passend, keyless) — selbst code-malen nur, wenn nichts Passendes existiert oder es Mattis' eigenen Stil tragen muss. Alles läuft durch **Blender/Daten → GLB → gltf-transform → three.js/WebGPU/TSL**, Abnahme per **Side-by-side-Screenshots gegen die Referenz + ehrliche FPS** — „0 Console-Errors" reicht NICHT.

**Stand der Welten (Akt 0–III alle REBUILT nach Doktrin + verifiziert):**
- **Akt 0 (Gipfel `/`)** (brain.md „Tag 5–6"): Eröffnung „Durch den Rahmen" (Signature-Loader, Museums-Threshold mit 35-MP-Gigapixel-Zoom durch die Leinwand, echter Blender-Summit-Set). verify-threshold/hero PASS.
- **Akt I (Meer `/sea`)** (brain.md „Tag 6–7"): Tessendorf-IFFT-Ozean auf WebGPU-Compute (`ocean.ts`), Dual-Cascade, physisch korrektes Wasser, exakte Aivazovsky-Palette, Blender-Brigg+Skiff mit ehrlicher Buoyancy, Kuwahara-Finish. verify-sea/hero/ocean PASS, FPS=66 (N=128). Spike `/dev/ocean`.
- **Akt II (Stadt `/city`)** (brain.md „Tag 4"): echtes Blender-Set, Blender-Kamerafahrt gescrubbt, Spiegelstadt, Pixel-Agenten, Bloom/CRT.
- **Akt III (Camino `/camino`) — FRISCH FERTIG** (brain.md „Tag 8"): **echter Satelliten-3D-Flyover Porto→Santiago** — **Copernicus GLO-30 DEM** + **Sentinel-2 cloudless** (beide gratis/keyless/lizenzsauber; Google 3D Tiles wegen Key+Kosten verworfen) → Blender-Terrain-Mesh (`scripts/blender/camino_set.py`, GIS-Prep in `scripts/camino/`) → `public/assets/camino/{camino.glb 696KB, camino_sat.webp 3MB, camino_meta.json}`. `scenes/camino.ts`: Relief-Shading, aerial perspective, gelände-huggende gold-glühende Pilgerroute, analytischer Chase-Cam über die 15 echten Stationen, Gold-out; Realismus-Akt → KEIN Kuwahara, nur Light-Post (bloom+grade). `worlds/camino.ts` mit Live-Wegmarke (aktueller Ortsname). verify-camino PASS, Build grün, hero/sea-Regression PASS. Spike `/dev/camino` (`?t=0..1 ?play`). ⏳ optional: Mattis' echte Camino-Fotos als „Fenster der Realität" einbinden (Ordner `assets/jakobsweg/` noch LEER → nachfordern); tiefer Atlantik sehr dunkel; ehrliche FPS auf Mattis' Gerät.

**Nächster großer Brocken (Roadmap Tag 10–12):**
1. **Akt IV — Der Horizont (`/horizon`)** = Kontakt/Finale: über den Wolken, goldene Stunde, GitHub/LinkedIn/CV-Links, „The next world is unwritten." (aktuell nur Basic-Platzhalter).
2. **Arcade-Pflichtspiele** (`/city/arcade`, Canvas/Vanilla-TS, laufen auch im Katalog): **Tic-Tac-Toe vs. The Algorithm** (Minimax, unschlagbar; Pflicht-Wandtext s. PLAN) + **Swarm** (Boids malen ein Bild). Highscores localStorage.
3. **Der Wanderpass** (localStorage-Pilgerstempel; alle Stempel → verborgene letzte Welt). Easter Eggs (Terminal-Mode `~`, Konami).
4. **Polish/Launch (Tag 11–12):** Sound-Layer (Howler, opt-in), Motion/Performance-Budget, Katalog-Modus/Mobile/Reduced-Motion-Pass, OG-Images, Search Console, finaler Deploy (Cloudflare Pages — Mattis verbindet Repo im Dashboard), README, optional Awwwards-Submission.

**Werkzeuge (alle bewiesen):**
1. **Blender headless**: `& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup --python <script>`. Vorlagen: `scripts/blender/{summit,city,sea,camino}_set.py`.
2. **GLB-Optimierung**: NIE blankes `optimize` — IMMER `--compress meshopt --simplify false --palette false --join false --flatten false`.
3. **GIS-Daten (neu, Tag 8)**: Copernicus-DEM via S3 (curl `--ssl-no-revoke`!), Sentinel-2 via EOX-WMS, rasterio in uv-venv (`uv … --native-tls`!), Node-fetch (`NODE_OPTIONS=--use-system-ca`). Pipeline `scripts/camino/{geo.json,prep_dem.py,fetch_satellite.mjs,shot.mjs}`. Details: brain.md „Tag 8".
4. **WebGPU/TSL** (`ocean.ts`, `camino.ts`): `Fn(([d]:any)=>)` → const als `:any`; `attribute('color')`/`normalWorld` als any swizzlen; eigene RenderPipeline mit `pass(scene,cam).getTextureNode()` + `bloom(tex,…)`; `screenUV` Ursprung OBEN-links.
5. **Verifikation** (Dev-Server muss laufen; **Port checken — astro nahm hier 4324**, 4321–4323 oft von Parallel-Fable belegt): `node scripts/verify-{threshold,hero,city,sea,ocean,camino,passage}.mjs <baseUrl>`. Screenshots in `verify-out/` per Read-Tool ansehen = Look-Abnahme. ⚠️ verify-passage hat 2 PRE-EXISTING headless-Remount-Fails (keine Regression).

**Koordination:** Falls parallel ein zweiter Fable läuft: Akt-0/I/III-Fable besitzt `summit.ts`, `sea.ts`, `ocean.ts`, `camino.ts`, `threshold.ts`, `painting.ts`, `passage.ts`, `signature.ts`; Stadt-Fable besitzt `city.ts`, `pixelwork.ts`. Blender headless läuft parallel; nur EINE Blender-GUI-Socket-Instanz gleichzeitig.

**Nicht vergessen:** npm nur mit `$env:NODE_OPTIONS="--use-system-ca"`; curl mit `--ssl-no-revoke`, uv mit `--native-tls`; NIE Dateien per PowerShell-Replace editieren (UTF-8-Mojibake — immer Edit/Write); in `global.css` kein `:global()`; nach jedem Commit pushen (main, GCM-Auth); am Session-Ende dieses HANDOFF.md + brain.md neu schreiben; neue Findings sofort in brain.md.

kommentar von mattis (Stand 15.06.):
- ⭐ **Gamechanger-Prinzip** (Memory `use-free-topnotch-assets.md`): bei JEDEM Hero-Element ZUERST gratis top-notch Quelle prüfen. Bei Akt III angewandt → Copernicus+Sentinel statt teurer Google-Tiles.
- ✅ Akt III Camino: ultra-realistischer Satelliten-Flyover steht. Letzter Look-Check auf Mattis' Full-Res-Screen offen (er nimmt Zwischenstände ab, „mach weiter ohne meine Meinung").
- ⏳ Jakobsweg-Fotos + restliche Projekt-/Bio-Fakten weiterhin von Mattis nachzuliefern.
- ✅ domain mattisengelhardt.com (astro.config). ✅ Unterschrift-Loader gebaut.
