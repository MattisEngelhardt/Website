# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@PLAN.md  @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt. **STOP: bevor du irgendetwas baust, lies in brain.md die oberste Sektion „Das Krisengespräch 12.06.2026" + die Tagesabschnitte „Tag 4", „Tag 5–6", „Tag 6–7", „Tag 8", „Tag 9–10".** Die Qualitätsdoktrin gilt für JEDE Szene: Hero-Visuals sind echte Production-Assets aus **Blender** (Sets, Bakes), **top-notch GRATIS Production-Assets/Daten** (CC0/MIT/CC-BY, pipeline-passend, keyless) ODER **physikalisch plausible Echtzeit-Simulation** (IFFT-Ozean, volumetrischer Wolken-Raymarch) — selbst code-malen nur, wenn nichts Passendes existiert oder es Mattis' eigenen Stil tragen muss. Abnahme per **Side-by-side-Screenshots gegen die Referenz + ehrliche FPS** — „0 Console-Errors" reicht NICHT.

**Stand der Welten (Akt 0–IV ALLE REBUILT nach Doktrin + verifiziert — die Haupt-Wanderung steht End-to-End):**
- **Akt 0 (Gipfel `/`)** (brain.md „Tag 5–6"): Eröffnung „Durch den Rahmen" (Signature-Loader, Museums-Threshold mit 35-MP-Gigapixel-Zoom durch die Leinwand, echter Blender-Summit-Set). verify-threshold/hero PASS.
- **Akt I (Meer `/sea`)** (brain.md „Tag 6–7"): Tessendorf-IFFT-Ozean auf WebGPU-Compute (`ocean.ts`), Dual-Cascade, physisch korrektes Wasser, exakte Aivazovsky-Palette, Blender-Brigg+Skiff mit ehrlicher Buoyancy, Kuwahara-Finish. verify-sea/hero/ocean PASS, FPS=66 (N=128). Spike `/dev/ocean`.
- **Akt II (Stadt `/city`)** (brain.md „Tag 4"): echtes Blender-Set, Blender-Kamerafahrt gescrubbt, Spiegelstadt, Pixel-Agenten, Bloom/CRT.
- **Akt III (Camino `/camino`)** (brain.md „Tag 8"): echter Satelliten-3D-Flyover Porto→Santiago — Copernicus GLO-30 DEM + Sentinel-2 cloudless (gratis/keyless) → Blender-Terrain → `scenes/camino.ts` (Relief-Shading, gelände-huggende Pilgerroute, analytischer Chase-Cam, Realismus → KEIN Kuwahara). verify-camino PASS. Spike `/dev/camino`.
- **Akt IV (Horizont `/horizon`) — FRISCH FERTIG** (brain.md „Tag 9–10"): **physikalisch beleuchtetes volumetrisches Wolkenmeer, goldene Stunde** — schließt den Friedrich-Loop (Nebelmeer vom Anfang → goldenes Wolkenmeer am Ende, First-Person). Raymarch mit Beer-Lambert + Henyey-Greenstein-Phase + Powder + Sonnen-Lichtmarsch (`scenes/horizon.ts`, Realismus → KEIN Kuwahara, Light-Post). `setHorizon(t)` driftet zur Sonne, Wolken öffnen sich am Ende → Gold-out → Kontakt-Seite. `worlds/horizon.ts` + neu gebaute `pages/horizon.astro` (Kontakt: **GitHub live**, LinkedIn/Email/CV `TODO(Mattis)`). verify-horizon PASS, Build grün (12 Seiten), hero/sea/camino-Regression PASS. Spike `/dev/horizon` (`?t=0..1 ?play` + Knobs `?steps ?pr ?cut ?den ?g ?bloom …`). ⏳ optional: Österreich-Über-den-Wolken-Foto als „Fenster der Realität" einbinden; **ehrliche FPS auf Mattis' RTX 4060 (Raymarch ist fragment-schwer — wichtigster offener Check; Hebel `?steps`/`?pr`/`?lsteps`)**.

**Nächster großer Brocken (Roadmap Tag 10–12) — jetzt: Spiele + lebendige Schicht + Launch:**
1. **Arcade-Pflichtspiele** (`/city/arcade`, Canvas/Vanilla-TS, laufen auch im Katalog): **Tic-Tac-Toe vs. The Algorithm** (Minimax, unschlagbar; Pflicht-Wandtext s. PLAN: „You can't beat it. That's why I build with them, not against them.") + **Swarm** (Boids-Schwarm malt ein Bild). Highscores localStorage. (`/city/arcade` existiert noch NICHT.)
2. **Der Wanderpass** (localStorage-Pilgerstempel; Welten besucht / Games gewonnen / Geheimnisse → alle Stempel = verborgene letzte Welt). Easter Eggs (Terminal-Mode `~`, Konami).
3. **Polish/Launch (Tag 11–12):** Sound-Layer (Howler, opt-in), Motion/Performance-Budget, Katalog-Modus/Mobile/Reduced-Motion-Pass, OG-Images, Search Console, finaler Deploy (Cloudflare Pages — Mattis verbindet Repo im Dashboard), README, optional Awwwards-Submission.
4. **Asset-Integration (sobald Mattis liefert):** Jakobsweg-Fotos (Akt III „Fenster"), Österreich-Foto (Akt IV Kontakt), LinkedIn/Email/CV-URLs, Projekt-/Bio-Fakten.

**Werkzeuge (alle bewiesen):**
1. **Blender headless**: `& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup --python <script>`. Vorlagen: `scripts/blender/{summit,city,sea,camino}_set.py`.
2. **GLB-Optimierung**: NIE blankes `optimize` — IMMER `--compress meshopt --simplify false --palette false --join false --flatten false`.
3. **GIS-Daten (Tag 8)**: Copernicus-DEM via S3 (curl `--ssl-no-revoke`!), Sentinel-2 via EOX-WMS, rasterio in uv-venv (`uv … --native-tls`!), Node-fetch (`NODE_OPTIONS=--use-system-ca`). Pipeline `scripts/camino/`.
4. **WebGPU/TSL** (`ocean.ts`, `camino.ts`, `horizon.ts`): `Fn(([d]:any)=>)` → const als `:any`; eigene RenderPipeline mit `pass(scene,cam).getTextureNode()` + `bloom(tex,…)`; `screenUV` Ursprung OBEN-links. **Raymarch-Idiom (neu, Tag 9–10):** `.toVar()` + `.addAssign/.mulAssign`, `Loop(N,()=>…)`, `If(cond,()=>…)`, `Break()`, `exp`/`step`/`mx_noise_float` — alles aus `three/tsl`; fragment-schwer → pixelRatio≤1.0 + Step-Budget.
5. **Verifikation** (Dev-Server muss laufen; **Port checken — astro nahm hier 4325**, 4321–4324 oft von Parallel-Fable belegt): `node scripts/verify-{threshold,hero,city,sea,ocean,camino,horizon,passage}.mjs <baseUrl>`. Screenshots in `verify-out/` per Read-Tool ansehen = Look-Abnahme. ⚠️ verify-passage hat 2 PRE-EXISTING headless-Remount-Fails (keine Regression). Headless-FPS (ANGLE) ist NICHT ehrlich.

**Koordination:** Falls parallel ein zweiter Fable läuft: Akt-0/I/III/IV-Fable besitzt `summit.ts`, `sea.ts`, `ocean.ts`, `camino.ts`, `horizon.ts`, `threshold.ts`, `painting.ts`, `passage.ts`, `signature.ts`; Stadt-Fable besitzt `city.ts`, `pixelwork.ts`. Arcade/Wanderpass sind neue, isolierte Module (Canvas/localStorage) — kollidieren mit keiner Szene. Blender headless läuft parallel; nur EINE Blender-GUI-Socket-Instanz gleichzeitig.

**Nicht vergessen:** npm nur mit `$env:NODE_OPTIONS="--use-system-ca"`; curl mit `--ssl-no-revoke`, uv mit `--native-tls`; NIE Dateien per PowerShell-Replace editieren (UTF-8-Mojibake — immer Edit/Write); in `global.css` kein `:global()`; nach jedem Commit pushen (main, GCM-Auth); am Session-Ende dieses HANDOFF.md + brain.md neu schreiben; neue Findings sofort in brain.md.

kommentar von mattis (Stand 15.06.):
- ⭐ **Gamechanger-Prinzip** (Memory `use-free-topnotch-assets.md`): bei JEDEM Hero-Element ZUERST gratis top-notch Quelle prüfen. Bei Akt IV geprüft (kein gratis TSL-Wolken-Node) → ehrlicher physikalischer Raymarch (wie der Ozean).
- ✅ **Die ganze Wanderung steht End-to-End (Akt 0→IV).** Mattis nimmt Zwischenstände ab, „mach weiter ohne meine Meinung" — nächster autonomer Brocken sind die Arcade-Pflichtspiele + Wanderpass, dann Polish/Launch.
- ⏳ Ehrliche FPS-Checks auf Mattis' Gerät (besonders Horizont-Raymarch + Kuwahara-Seen). Jakobsweg-/Österreich-Fotos + LinkedIn/CV/Email + Projekt-/Bio-Fakten weiterhin nachzuliefern.
- ✅ domain mattisengelhardt.com (astro.config). ✅ Unterschrift-Loader gebaut.
