# brain.md — Projektgedächtnis „Der Wanderer"

> Persistentes Wissen über Sessions hinweg. Präzise, knapp, immer aktuell halten.
> Regel: Jede Session liest dieses File zuerst und schreibt neue Findings sofort rein.

## Session-Workflow (fest, von Mattis gewünscht)

1. **Session-Start:** brain.md lesen (dieses File), dann HANDOFF.md
2. **Während der Session:** neue Findings sofort hier eintragen
3. **Session-Ende (großer Sessions):** `HANDOFF.md` aktualisieren — perfekter Handoff-Prompt an den nächsten Fable, beginnt mit `@PLAN.md @brain.md`; knapp, verweist auf brain.md statt zu duplizieren

## ⚠️ DAS KRISENGESPRÄCH 12.06.2026 — DIE QUALITÄTSDOKTRIN (überschreibt alles Bisherige; JEDER Fable liest das zuerst)

Mattis hat Akt 0 + Akt I im Browser abgenommen und für **weit unter dem Anspruch** erklärt. Der Kern von PLAN.md (Konzept, Welten, Geschichte) bleibt bestätigt — **die Umsetzungsweise wird fundamental geändert**. Voller genehmigter Plan: `C:\Users\engel\.claude\plans\ok-krisengespr-ch-das-was-bubbly-ullman.md`

### Die Kritik im Wortlaut (12.06.2026, exakt festgehalten)

> „Das was ich hier sehe als erste Landingpage ist keinesfalls die Qualität, die wir nicht nur anstreben, sondern auch **erreichen müssen**. Es ist alles extrem basic und sehr wenig kreativ — wie eine einfache Landingpage mit mehreren Seiten, die einfach nur reinen Text auflisten. Das Boot ist viel zu einfach, der Wanderer ist viel zu einfach."

> „Ich will ein **extremes High-Class-3D-Experience**, ultra-realistisch und wirklich ereignisreich. Wirkliche Motion. Wirklich ultra-realistisch **im Caspar-David-Friedrich-Gemälde bei höchster Auflösung SEIN** — nicht in einem billigen Klon auf der Oberfläche entlangstreichen. Ich will wirklich im **lebendigen ‚Ship at Sunset off Cap Martin' von Aivazovsky** sein: das Meer soll extrem realistisch und **physisch korrekt strömen**, das Schiff soll **darauf schwimmen**, die Sonne soll **langsam setten** — und das alles, wenn man scrollt."

> „Wo ist die Kreativität? (Referenz: phantom.land — dreidimensionale Galerie als Startseite.) Für den Start wäre Wanderer over the Sea of Fog schon sehr stark — aber **komplett realistisch, in höchster Auflösung, man muss IM Gemälde sein**, die Kameraführung läuft weiter geradeaus, und dann kann man wie in einer Galerie genauer auf die einzelnen Parts."

> „**Auf keinen Fall** den Wanderer und das Boot **selber basic coden** — sondern **mit den richtigen Tools**: ein ultra-high-quality, extreme-high-resolution **Blender-Projekt**, wo man sich selber drin befindet und alles lebendig abläuft. Ich glaube, du hast noch nicht verstanden, was es wirklich bedeutet, eine Website in **Awwwards-Qualität** zu bauen."

> „Final will ich, dass der Nutzer sich **komplett realistisch in Friedrichs und Aivazovskys Bild befindet**, sich in **meinen Bildern und Videos** befindet (oder diese perfekt und elegant eingebunden sind) und **extrem realistisch Teile des Jakobswegs** nach Santiago de Compostela **läuft**."

### Die Diagnose (was falsch lief)

Alles war **prozedural aus Code gemalt**: Wanderer = Canvas-Alphamaske auf einer Plane, Schiff = 2D-Canvas-Sprite, Nebel = 8 Noise-Layer, Fels = Silhouette. **Kein einziges geladenes 3D-Asset, keine echte Tiefe, keine Kamerafahrt DURCH einen Raum**, darunter Text-„Buchseiten". Der Kern-Irrtum: „alles in Code, kein Asset" als handwerkliches Statement zu behandeln. **Awwwards-Niveau entsteht aus Production-Assets** (echte Geometrie, Texturen, gebackenes Licht, choreographierte Kamera) aus einem DCC-Tool — **Shader sind das Finish, nicht der Inhalt.**

### Die Doktrin (gilt für JEDE Szene, JEDEN Fable, ab sofort)

1. **Echte 3D-Sets aus Blender** (5.1 ist installiert: `C:\Program Files\Blender Foundation\Blender 5.1`) — PolyHaven (CC0), Sketchfab, Hyper3D Rodin (Free-Tier), Sculpts; Licht in Cycles gebacken. Maschine schafft das: RTX 4060 Laptop, i9-13980HX, 32 GB RAM
2. **Kinoreife Kamerapfade**, in Blender choreographiert, per Scroll gescrubbt — Kamera bewegt sich DURCH den Raum
3. **Physikalisch plausible Simulation**: IFFT-Ozean (JONSWAP; Referenz MIT: Spiri0/Threejs-WebGPU-IFFT-Ocean), Raymarch-Volumetrik, ehrliche Multi-Punkt-Buoyancy
4. **Painterly-Grade (Kuwahara) bleibt als Finish** — jetzt auf echter Tiefe
5. **Verifikation = Side-by-side mit dem Originalgemälde + ehrliche FPS auf echter GPU** (headed, nicht headless) — „läuft ohne Errors" reicht NICHT mehr
6. **Eleganz vor Effekt-Spam, kein Lag** (60 fps Mittelklasse bleibt Budget)
7. **Asset-Pipeline**: Blender → GLB → gltf-transform (meshopt/Draco + KTX2: UASTC für Normals/Hero, ETC1S sekundär) → three.js r184; je Welt ≤ 15 MB progressiv, Initial-JS ≤ 150 KB

### Entscheidungen von Mattis (12.06.)

1. **Einstieg „Durch den Rahmen"**: Museum-Auftakt, Gemälde mit **IIIF-artigem Gigapixel-Tile-Zoom** (Kunsthalle-Scans ~60k px existieren), man tritt durch die Leinwand ins echte 3D-Set
2. **Welt-in-Welt**: die Wanderer-Welt ist die HAUPTWELT, alle anderen Welten leben IN ihr (lebende Gemälde-Rahmen im Nebelmeer, Drift-Navigation mit Trägheit, Threshold-Flug durch Rahmen = Site-Signatur). Nicht bloß Klick/Scroll — phantom.land als Kreativitäts-Messlatte, nicht als Kopie
3. **Tiefe zuerst**: Akt 0 + Akt I auf Weltklasse (Tag 4–7), dann Rest
4. **Strikt kostenlos**: kein World Labs Marble; Blender + CC0 + Free-Tier
5. **Camino = Satelliten-3D-Flug** über die echte Route nach Santiago (BlenderGIS: SRTM-DEM + Sentinel-2/Esri), GPX-Kamerapfad, seine Fotos als Stationen — kein Boden-Detail

### Für Akt II (Parallel-Fable) heißt das konkret

Gleiche Doktrin in Pixel-Übersetzung: echte Stadt-Geometrie aus Blender (Blockout + Bake) oder hochwertige gezeichnete Parallax-Ebenen — **keine primitiven Code-Rechtecke**; Kamerafahrt DURCH die Stadt statt statischer Ansicht; Side-by-side gegen Referenz-Artworks (Cyberpunk/Neo-Tokyo) als Abnahme. Koordination: nur EINE Blender-MCP-Instanz gleichzeitig (Socket-Konflikt) — Absprache via HANDOFF.md.

## Tag 3 (12.06.) — Krisen-Umsetzung: Toolchain steht, Pipeline bewiesen

- ✅ Krise dokumentiert: brain.md (oben), PLAN.md (Krisen-Verweis + neue Roadmap), Memory; genehmigter Plan: `C:\Users\engel\.claude\plans\ok-krisengespr-ch-das-was-bubbly-ullman.md`
- ✅ **uv 0.11.21** via winget (`--source winget` nötig, msstore-TLS kaputt); uvx: `C:\Users\engel\AppData\Local\Microsoft\WinGet\Packages\astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe\uvx.exe`
- ✅ **blender-mcp als Projekt-MCP** in `.mcp.json` (committed; Tools laden ab NÄCHSTER Session). Addon installiert+aktiviert in Blender 5.1 (`tools/blender/addon.py`); **Socket-Server braucht Blender-GUI**: N-Panel „BlenderMCP" → Connect; **nur EINE Instanz gleichzeitig** (Fable-Absprache via HANDOFF!)
- ✅ **Pipeline-Proof PASS** (`node scripts/verify-asset.mjs`): `scripts/blender/pipeline_proof.py` headless (Cycles-**OPTIX-GPU**-Bake funktioniert!) → `assets-src/proof/rock_raw.glb` 1,12 MB → `npx gltf-transform optimize --compress meshopt --texture-compress webp` → `public/assets/proof/rock.glb` **73 KB** → `/dev/asset` (WebGPU, GLTFLoader+MeshoptDecoder via `three/addons/...`) → Screenshot grün. Blender headless: `& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup --python <script>`
- ✅ **Tile-Pyramide** für den Threshold-Zoom: `node scripts/make-tiles.mjs <img> public/assets/paintings wanderer` (sharp, DeepZoom 512er/2px-Overlap; Output-Name MUSS ohne Endung übergeben werden — Script regelt das via `.dz`) → `wanderer.dzi` + `wanderer_files/` (54 Tiles, 1,2 MB) aus Commons-Scan 2327×2980 als **Baseline**. ⏳ **Gigapixel-Jagd Tag 4**: Google Arts & Culture (dezoomify-rs), Kunsthalle `online-sammlung.hamburger-kunsthalle.de` (Kunsthalle hat ~60k-px-Scans, „ZOOM IN"); Tiles-Rerun ist ein Einzeiler
- ✅ **Sourcing** (alles in `assets-src/`, gitignored, nur lokal/OneDrive): Wanderer 2327×2980 (Commons), **Aivazovsky Cap Martin 3882×2623** (Sotheby's-S3 direkt, post-restoration: `sothebys-brightspot.s3.amazonaws.com/media-desk/a0/cc/70e0a1204dbb9eeb5f958a720b6a/207l19112-b5q8t-post-restoration.jpg`), PolyHaven 2k-Sets `cliff_side` + `rock_face` (diff/nor/rough/disp) + 4k-HDRIs `qwantani_dawn_puresky` (Akt 0) / `qwantani_sunset_puresky` (Akt I). PolyHaven-REST: `api.polyhaven.com/assets?t=…` + `api.polyhaven.com/files/<id>`
- **Entscheidung Schiff**: die Brigg wird **in Blender selbst modelliert** (Sketchfab-API braucht Account/Key; Gegenlicht-Silhouette im Gemälde → Eigenbau nach Referenz ist exakter und CC0-sauber). Alternative: Hyper3D Rodin via MCP (Free-Tier)
- ⏳ **KTX2 offen**: toktx (KhronosGroup KTX-Software) nicht installiert — Proof nutzt WebP (ok bis VRAM drückt); vor Akt-0-Build entscheiden
- Neue Dateien: `scripts/blender/pipeline_proof.py`, `scripts/make-tiles.mjs`, `scripts/verify-asset.mjs`, `src/pages/dev/asset.astro` (noindex, sitemap-gefiltert in astro.config), `.mcp.json`, `tools/blender/addon.py`

## Tag 4 (12./13.06., Stadt-Fable) — Akt II REBUILT nach Doktrin: echtes Blender-Set

- **Doktrin-Review des alten City-WIP**: Gebäude waren BoxGeometry + Shader-Fenster (genau die verbotenen Code-Rechtecke), Billboards/Agenten Canvas-Sprites → Hero komplett neu gebaut. BEHALTEN: `pixelwork.ts` (Post = Finish, doktrin-konform), `worlds/city.ts`-Scrolltimeline, Record-Routen (porter/amadeus/papers — echte Projekt-Fakten), Same-World-Veil in passage.ts
- **Blender-Socket direkt statt MCP**: Die MCP-Tools luden in der Session NICHT (trotz `.mcp.json`) → `scripts/blender/bl.mjs` spricht das Addon-Protokoll roh über Port 9876 (`info | exec <py> | shot <png> | cmd <type>`). ⚠️ **Payload MUSS pure ASCII sein**: das Addon dekodiert seinen TCP-Buffer chunkweise als UTF-8 — ein Multibyte-Zeichen auf einer Chunk-Grenze wirft einen unbehandelten UnicodeDecodeError und killt die Verbindung (ECONNRESET). bl.mjs escapet deshalb automatisch zu `\uXXXX`
- **Das Set** (`scripts/blender/city_set.py`, deterministisch geseedet, ~100k Polys): 3 Gebäudereihen (vorn Punched-Windows mit ECHTEN Laibungs-Vertiefungen + Shopfronts, Mitte/hinten Band-Tower als Skyline), Hero-Türme PORTER/AMADEUS/PAPERS mit Rücksprung-Silhouette + Billboards aus **extrudierten Text-Glyphen**, 6 vertikale Wort-Schilder (AGENTS/LOCAL/BUILD/SHIP/OPEN/ARCADE), ~35 Lightbox-Schilder (**warm-dominant** — Lehre aus dem Referenz-Abgleich), Vending-Machines, AC-Boxen, Wassertanks, Antennen, Stromleitungen (Catenary-Kurven→Mesh), Beacons, Straße mit Bordstein/Zebrastreifen/Mittellinie. Fenster-Watt+Tint in Vertexfarben — **Werte ≤ 1 halten** (meshopt quantisiert COLOR_0 zu u8, >1 clippt)
- **Kamerafahrt in Blender choreographiert** (Catmull-Rom über 5 Stationen, 61 Quaternion-Keys mit Flip-Guard, 241 Frames/24fps = 10 s): über den Dächern → Sturzflug in die Schlucht → Straßen-Glide → Blick hoch zum Porter-Screen. Als GLB-Animation exportiert, web-seitig via `AnimationMixer` + `action.time` gescrubbt
- **Bake/Export** (`city_bake_export.py`): Cycles/OPTIX **AO → VERTEX_COLORS** (Ziel-Attribut „AO" aktiv setzen, `bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')`), numpy-combine Col×AO mit Material-Maske (win_lit-Loops unberührt — Licht kriegt kein AO), AO-Distanz 10 m via `world.light_settings.distance`. Look-Dev: `city_still.py` (Cycles, AgX, Volumen-Haze 0.004) → `verify-out/city-blender-f*.png`
- ⚠️ **gltf-transform `optimize` zerstört per Default Material-Namen und Mesh-Identität** (palette→PaletteMaterial001…, join fusioniert Street/BBs weg) → IMMER: `--compress meshopt --simplify false --palette false --join false --flatten false`. Ergebnis: **city.glb 1,88 MB** (aus 15,6 MB raw), Material-Namen + COLOR_0 + Kamera-Animation überleben
- **Web-Rebuild** (`src/scenes/city.ts`): GLB via GLTFLoader+MeshoptDecoder, Materialien **per NAME in TSL neu aufgebaut** (unlit, Vertexfarben via `attribute('color')` — als any typisieren), Spiegelstadt = geklonte City+Neon-Meshes mit `scale.y=-1` UNTER der transparenten Pfützen-Straße (`opacity = 1 − puddle·(1−dashMask)`; renderOrder Spiegel-Agenten 5 → Street 10 → Regen 20), Regen instanced (GPU-hash), **Pixel-Agenten handgesetzt** (12×18-Maps, 2-Frame-Walk, Schirm-Varianten, je Agent uFrame-Uniform), `pixelwork.ts` + **Bloom** (`three/addons/tsl/display/BloomNode`: `bloom(sceneTex)` ÜBER dem Mosaik = CRT-Phosphor-Bleed)
- ⚠️ **Web-Grading-Findings**: (1) sRGB-Encoding hebt dunkle Linear-Albedos massiv (0.05 → ~25 % Grau) — Cycles hatte AgX, das Web nicht → Fassaden-Albedo im Shader ×0.42; (2) `THREE.Color(hex)` landet als Linear im Shader → Haze-/Stimmungsfarben direkt als Linear-Tripel angeben, sonst Milch-Lila; (3) Emissive-Multiplikator moderat halten (1.9) — Weiß-Ausbrennen frisst die Neon-Sättigung
- **Abnahme nach Doktrin**: Side-by-side gegen Shibuya-Nacht-Referenz (`verify-out/ref-neotokyo.jpg` + `city-sidebyside.png`): Schlucht-Komposition, Schilder-Dichte, Warm-Palette ✓. `node scripts/verify-city.mjs` **PASS** (Approach-Stationen, Captions, Collapse, Records, Remount, Katalog), danach verify-passage + verify-hero erneut **PASS**, 0 Console-Errors, Build grün
- ⏳ Offen Akt II: **ehrliche FPS auf Mattis' Gerät** (auf `/city` scrollen + Maus wedeln), Arcade (Tag 10), Record-Routen-Inszenierung (CRT-Header-Idee), evtl. mehr Walk-Frames

## Tag 5–6 (14.06., Akt-0-Fable) — Die Eröffnung „Durch den Rahmen" + Signature-Loader (Doktrin-Entscheidung #1 umgesetzt)

Die komplette **Eröffnungssequenz** gebaut, verifiziert (verify-threshold PASS + verify-hero PASS, 0 Console-Errors, Build grün) und per Frame-für-Frame-Look-Abnahme (Read-Tool) bestätigt. Das ist Doktrin-Entscheidung #1 („Museum-Auftakt, durch die Leinwand ins 3D-Set") + zwei von Mattis' drei HANDOFF-Wünschen.

- **Neues 35-MP-Gemälde genutzt** (Mattis' dringender Wunsch): `assets-src/paintings/Caspar_David_Friedrich_-_Wanderer_above_the_Sea_of_Fog.jpeg` (5256×6742). Tile-Pyramide neu (`make-tiles.mjs`, 13 Level, 223 Tiles) UND **progressive WebP-Derivate** via neuem `scripts/make-painting-derivatives.mjs`: `wanderer_overview.webp` (1600w, 0,48 MB, instant + LCP) + `wanderer_full.webp` (4400w, 4,6 MB, Deep-Texture lazy). Entscheidung: der Threshold zoomt per **CSS-transform auf ein decodiertes `<img>`** (GPU-composited, gestochen scharf bis ~6× weil Quelle echt Gigapixel) statt fragilem Tile-Renderer; die .dzi bleibt für einen späteren OSD-Grade-Viewer.
- **Threshold** (`src/scenes/threshold.ts`, DOM in index.astro = SEO/LCP/Katalog-Plate): Museumswand mit Goldrahmen + Plakette → Scroll schiebt die Kamera DURCH die Leinwand auf die Figur+Nebel (Fokus normiert 0.50/0.455), Rahmen wächst aus dem Frame, dann **Cross-Dissolve (opacity+blur) auf die LEBENDE summit-Szene dahinter** (kein Bild-zu-Bild, das Ziel ist das echte WebGPU-Set). `setProgress(p)`: p 0..0.84 Zoom (transform-origin=Fokus, translate zentriert Fokus, smootherstep), p 0.84..1 Dissolve. Mathe: aus untransformiertem Layout-Rect messen (transform clearen→messen→restaurieren), `translate3d(dx·k, dy·k) scale(s)`.
- **Signature-Loader „Mattis E."** (`src/lib/signature.ts` + DOM in World.astro, `@fontsource/allura`): Wort zeichnet sich per `clip-path:inset` L→R (warmer Creme-Gradient via background-clip:text + Glow), dann **Flourish-Unterstreichung** als SVG-Stroke (`pathLength="1"`, dashoffset 1→0) die vom E zurück unter den ganzen Namen schwingt — genau Mattis' Wunsch („das E geil geschwungen dass es alles unterstreicht, geschriebener Teil bleibt"). Reine CSS-Animation (kein GSAP im Initial-Bundle), JS timed nur den Lift. **Gearmt nur 1× pro Session** (Inline-Head-Script setzt `html[data-loading]`, gated auf reduced-motion/save-data; sessionStorage-Guard; 6s-Failsafe-Timeout gegen Hänger). No-JS/Katalog sehen den Loader NIE → Content nie blockiert.
- **Lifecycle**: summit-Controller (`src/worlds/summit.ts`) ist jetzt EINE durchgehende scroll-Timeline über `#descent-track` (full mode **460svh**, runway ~3240px): [0→0.5] threshold.setProgress(push) · [0.40→0.52] Frontispiz+Descend fade-in · [0.6→1.0] setDescent (bestehender White-out unverändert). `gsap.set(['.frontispiece','.descend'],{autoAlpha:0})` + CSS `[data-mode='full'] .frontispiece{opacity:0}` verhindern Flash (Loader deckt eh ab). Threshold full-mode = `position:fixed; z-index:50; pointer-events:none` (0 Flow-Höhe → descent-track ist die einzige Runway, Hero bleibt dahinter gepinnt → nahtlose Enthüllung).
- **Gotcha bestätigt**: in `global.css` (reines Stylesheet, NICHT scoped) ist `:global(...)` ungültig → nur platte Selektoren (`[data-mode='full'] .x`). Verwechslung mit Astro-`<style>`-scoped vermeiden.
- **Neue/geänderte Dateien**: `src/scenes/threshold.ts`, `src/lib/signature.ts`, `scripts/make-painting-derivatives.mjs`, `scripts/verify-threshold.mjs`; geändert: `index.astro` (threshold-Markup + 460svh + frontispiece-hide), `World.astro` (allura-import, arm-script, loader-DOM, playSignature-call), `worlds/summit.ts` (merged Timeline), `global.css` (Threshold- + Loader-Grammatik), `astro.config` unverändert (Domain stand schon auf mattisengelhardt.com ✓).
- ✅ **Akt-0-Doktrin-3D-Kern: echter Blender-Summit-Set gebaut + integriert** (verify-threshold + verify-hero PASS, Build grün, Look-Abnahme per Frame). `scripts/blender/summit_set.py` (headless, deterministische Python-fBm value-noise, KEINE Blender-Kamera — die Web-Szene fährt selbst): **Outcrop** (zerklüfteter Friedrich-Fels, flat-shaded Facetten, AO→Vertex gebacken), **Crags** (durch den Nebel stoßend), **Peaks** (runder Massiv links + scharfer Pinnacle rechts, hazed). `summit_still.py` = Look-Dev-Render (AgX, Sunset-HDRI). Export GEOMETRY-ONLY → `gltf-transform optimize` (gelockte Flags) → `public/assets/summit/summit.glb` **140 KB** (4900 Polys). **Integration in `scenes/summit.ts`** ADDITIV: GLTFLoader+MeshoptDecoder, unlit `attribute('color')`-Material pro Mesh (per Name: Peaks/Crags/Outcrop) mit aerial-haze (`mix(col, uHaze, smoothstep(dist))`, uHaze=fogFar pro Tageszeit), `renderOrder=-1` (opak vor transparentem Nebel), TSL-Himmel/Nebel/Painterly-Post/Linse/Descent UNVERÄNDERT. **Wanderer-Figur jetzt auf echtem Fels**: `drawWanderer(false)` (Canvas-Fels weg), Figur = festes 3D-Objekt (`figure.scale/position` fix, aus `fit()` entkoppelt), Füße auf Gipfel ≈ world (2,-3,-4). Platzierung: `TERRAIN_SCALE=0.62`, `TERRAIN_POS=[0.45,-7.96,-1.21]` (gltf-Mapping Blender (x,y,z)→(x,z,-y), per Screenshot getunt).
- ⏳ Feinschliff Akt 0 (optional): Crags wirken etwas zweighaft/blass (Haze runter / runder modellieren); Outcrop könnte minimal höher ins untere Drittel; echte Side-by-side gegen das Originalgemälde als formale Abnahme. FPS-Check auf Mattis' Gerät weiterhin offen (Threshold = nur CSS-transform → 60fps; Terrain +4900 Polys vernachlässigbar; Kuwahara unverändert der Kostentreiber).
- ⏳ **Akt I (Meer) Rebuild nach Doktrin** weiterhin offen (IFFT-Ozean + Schiffs-GLB) — `summit_set.py` ist jetzt eine zweite Vorlage für headless Set-Generierung neben `city_set.py`.

## Status (Stand: 11.06.2026 Abend, Tag 2 von 12 — Tag-4-Werk vorgezogen; ⚠️ 12.06. KRISENGESPRÄCH: Akt 0 + I werden nach neuer Doktrin neu gebaut, s. oben)

- ✅ Tag 1 komplett (Skeleton, Art-Direction, 5 Routen, Hero erster Pass)
- ✅ **Akt-0-Meisterstück (Tag 2–3-Kern) gebaut UND im Browser verifiziert** (Playwright + System-Chrome, echtes WebGPU, 0 Console-Errors, `VERDICT: PASS`):
  - **Kuwahara-Painterly-Post** (TSL RenderPipeline, Radius 4): die ganze Welt ist ein Gemälde; Paper-Grain + Vignette nur auf der Malerei-Seite
  - **Realitäts-Linse**: Mausbewegung öffnet scharfes Fenster um den Cursor (uReality × radiale Maske), Stillstand lässt die Malerei zurückkehren. Debug: **`?lens`** zeigt die Maske
  - **Wanderer-Rückenfigur**: prozedural in Code gemalt (Canvas-Alphamaske, kein Asset!), Fels läuft aus dem Frame, Figur im goldenen Schnitt rechts, blickt zur Sonne; atmet mit dem Wind
  - **White-out-Descent**: 280svh-Runway, sticky Hero, ScrollTrigger scrubbt `setDescent(t)` (Nebel verdichtet + steigt, Kamera sinkt) + Veil → löst nahtlos in **Paper-Sektion** auf (Canvas-Papier, Tinten-Text — „das Gemälde wird zur Buchseite")
  - Scroll-Reveals der Erzähl-Beats, Lenis `anchors: true` für den Descend-Link
  - Tag-Kontrast-Fix: `[data-daypart='day']` → Frontispiz in Tinte (--c-deep)
  - `?hour` steuert jetzt AUCH das CSS-Fallback-daypart (inline Script liest Query)
- ✅ Katalog-Modus verifiziert (reduced-motion → `catalog`, keine Szene, kein Runway, voller Text)
- ✅ `npm run check` 0 Fehler; Build grün; Einstiegs-JS ~18 KB raw (World-Script 4,5 + ClientRouter 13,3), summit-Chunk 789 KB raw lazy (~200 KB gzip), journey-Chunk (gsap+lenis, 129 KB) lazy
- ✅ **Erster Commit existiert jetzt wirklich** (`39c7d28` Tag 1 + Folge-Commit Tag 2) — Achtung: brain.md hatte fälschlich „Commit liegt vor" behauptet
- ✅ **„Die Passage" — Welt-Übergangs-Framework (Rest Tag 2–3) gebaut UND runtime-verifiziert** (verify-passage.mjs `PASS`, verify-hero.mjs danach erneut `PASS`, 0 Errors):
  - ClientRouter (`fallback="swap"`) in World.astro, Default-Crossfade via `transition:animate="none"` auf `<html>` aus — der Veil IST die Transition
  - `src/lib/passage.ts` = EIN Layout-Script (läuft 1×/Session): Quality-Gate, Daypart, World-Controller-Registry (mount/cleanup), Veil-Choreografie. Per-Page-Scripts sind abgeschafft!
  - Welt-Controller in `src/worlds/` (summit.ts = Szene+Descent+Reveals mit gsap.context-Revert; common.ts = Default-Reveals für Text-Welten)
  - Veil: 3 gestaffelte Pinselstrich-Bahnen (CSS-only, kein gsap im Initial-Bundle) in Ziel-Welt-Palette + Kapitel-Tafel („Act I — The Sea"), Element überlebt Swap via `transition:persist`; Richtung folgt Akt-Index (vor/zurück). Swap passiert erst bei voller Deckung (Loader-Extend in `astro:before-preparation`) → verdeckt WebGPU-Init beim Remount
- ✅ **Akt I — Das Meer (Tag-4-Werk) gebaut UND runtime-verifiziert** (verify-sea.mjs `PASS`, danach hero+passage erneut `PASS`, Build grün, 0 Errors):
  - **Gerstner-Ozean** in TSL (6 Wellenzüge, positionNode-Displacement, analytische Normalen via varying), Tiefwasser-Dispersion, gesamt-Amplitude ~0,85 (Kamera reitet ÜBER der See, y 5,2)
  - **Aivazovsky-Licht von Hand**: Sonnenstraße = Reflexionsvektor `pow(18)` + Sparkle `pow(140)` exakt unter der Sonnenscheibe (Azimut-Match!), Glas-Kämme, Aerial-Fade gedeckelt auf 0,88 (sonst Milchsee), Paletten-Lerp GOLDEN_SEA→DUSK_SEA über `setVoyage(t)`
  - **Schiff prozedural** (drawShip, Brigg): Alpha-Kanal kodiert Material — Segel ~0,5 → sonnendurchleuchtetes Tuch (uSail), Rumpf/Masten/Rigg 1,0 → Tinte; CPU-Wellen-Spiegel lässt es ehrlich stampfen (gemeinsames uTime statt TSL-`time` → GPU/CPU-Sync!)
  - **Cursor = Lichtpinsel**: Pointer-Ray auf Wasserebene projiziert, Spur in 256²-Canvas (lighten/fade), als CanvasTexture (flipY=false!) in Welt-XZ gesampelt — Licht bleibt liegen, wo die Hand war
  - **Voyage-Scroll** (320svh): Schiff segelt aus dem fernen Licht heran, Dämmerung vertieft sich, Kamera sinkt; 3 Log-Captions (aria-hidden Flavor) tauchen in Scroll-Fenstern auf; **Goldblende in zwei Atemzügen** (gold-veil → page-veil/Canvas) löst auf die Buchseite; echte Bio im „Ship's Log" (paper, SEO)
- ⏳ Noch offen aus Tag 2–3: Sound-Layer (kann auch in Tag-11-Polish)
- ✅ GitHub-Repo live: `MattisEngelhardt/Website`, alle Commits gepusht (GCM-Auth, kein gh nötig)
- ⏳ Cloudflare-Pages-Verbindung (Mattis im Dashboard) + **FPS-Check auf echtem Gerät** (Kuwahara = ~100 Taps/Pixel; Headless kann keine ehrliche FPS messen — Mattis soll auf `/` und `/sea` scrollen/wedeln und auf Ruckeln achten)
- Deadline: **22.06.2026** (Roadmap in PLAN.md; Tag 4 = Akt I Meer)

## Tech-Entscheidungen (locked)

| Was | Entscheidung | Warum |
|---|---|---|
| Framework | **Astro 6.4** (nicht 5 — Plan war veraltet) | Juni 2026 aktuell; statisch, Islands, SEO |
| 3D | **Three.js 0.184, WebGPURenderer + TSL** | WebGPU ist 2026 Baseline (Safari 26 ✓); TSL = ein Shader-Code → WGSL + GLSL-Fallback automatisch |
| Scroll | **Lenis 1.3 + GSAP 3.15 ScrollTrigger** | GSAP ist komplett gratis (inkl. aller Plugins); Sync-Pattern: lenis.raf auf gsap.ticker, lagSmoothing(0) |
| Fonts | **Fraunces Variable** (Display, opsz+SOFT+WONK) + **IBM Plex Mono** | self-hosted via @fontsource; painterly bei Display-Größen (`WONK 1`), nüchtern im Fließtext |
| Video-Strategie | Echtzeit-Shader > vorgerendertes Video für Übergänge; Scroll-Scrubbing = Frame-Sequenzen, nie `<video>`-Scrubbing; Mattis' echte Fotos/Videos als „Fenster der Realität" (Akt III); **keine KI-Videos** (untergräbt Authentizitäts-Statement) | Recherche 10.06. |
| Modi | `full` (WebGPU/WebGL2) vs. `catalog` (reduced-motion/saveData/kein GPU) — Gate in `src/lib/quality.ts`, setzt `data-mode` auf `<html>` | Accessibility + Mobile + SEO in einem |

## Architektur-Karte

- `src/styles/tokens.css` — **Art-Direction-Lock** (Quintett-Palette, Neon-Shift, Motion-DNA: ease-journey/arrive/lift, t-flick/step/breath/setpiece). Keine neuen Hues erfinden, nur mischen!
- `src/layouts/World.astro` — SEO-Frame (OG, Canonical, JSON-LD Person auf `/`), Props: title/description/world/withPerson
- `src/components/PathNav.astro` — „Der Pfad", persistente Pilger-Nav, 5 Stationen
- `src/lib/quality.ts` — Erlebnis-Gate; `src/lib/journey.ts` — Lenis+GSAP-Singleton (`anchors: true`)
- `src/scenes/summit.ts` — Akt 0 komplett: 7+1 Fog-Layer (fbm, TSL; Layer 8 = Wisp VOR der Figur), Tageszeit-Paletten (CPU-lerp → Uniforms), Maus = Wind + Kamera-Parallax, **Wanderer-Figur** (`drawWanderer()`, prozedurale Canvas-Alphamaske, tintbar via uFigure), **Kuwahara-RenderPipeline + Realitäts-Linse** (uReality/uPointerUv), **`setDescent(t)`** im Handle für den White-out. Dev-Tools: **`?hour=19.5`** (Tageszeit), **`?lens`** (Linsen-Maske)
- `src/scenes/painting.ts` — **geteilte Painting-Pipeline** (Kuwahara + Grain + Vignette, optional Linse): `createPainting(renderer, scene, camera, { radius, lens })` → beide Szenen nutzen sie; three/webgpu-Kern liegt dadurch in EINEM lazy Chunk (783 KB), Szenen-Code je ~8 KB
- `src/scenes/sea.ts` — Akt I komplett: Gerstner-Wasser, Sky mit Sonnenscheibe+Band, Schiff (`drawShip()`), Lichtspur-Canvas, `setVoyage(t)` im Handle. Wellen-Konstanten in `WAVE_CONSTS` (GPU+CPU)
- `src/worlds/sea.ts` — Voyage-Timeline (scrub → setVoyage, Captions-Fenster, Goldblende 2-stufig), Log-Reveals
- Act-Hero-Grammatik (`.hero`, `.frontispiece`, `.descend`, `.paper`) ist GLOBAL (global.css) — Seiten liefern nur noch eigene Hintergründe/Specials
- `src/lib/passage.ts` — **Die Passage**: ClientRouter-Lifecycle, Veil-Choreografie (closeVeil/openVeil über `transitionend`), World-Registry (`CONTROLLERS`-Map → dynamic imports; summit+sea registriert), restauriert `data-mode`/`data-daypart` in `astro:after-swap` (Router wischt ALLE `<html>`-Attribute!), Lenis stop/sync/start um Swaps herum
- `src/lib/daypart.ts` — Daypart-Logik (synchron halten mit Inline-Script in index.astro!)
- `src/worlds/summit.ts` + `src/worlds/common.ts` — Welt-Controller: `mount(ctx) → cleanup`; neue Welten hier registrieren (passage.ts `CONTROLLERS`)
- `src/scenes/city.ts` — Akt II: lädt `public/assets/city/city.glb` (Blender-Set, s. Tag 4), scrubbt die Blender-Kamerafahrt (`setApproach(t)`), Material-Rebuild per Namen, Spiegelstadt+Pfützen, Regen, Pixel-Agenten; `src/scenes/pixelwork.ts` — Mosaik/CRT/Bloom-Post (uSignal/uPointerUv/uCollapse)
- `src/worlds/city.ts` — Approach-Timeline (Captions-Fenster, Glitch→Page-Veil ab t=0.86), Records fallen auf common-Reveals zurück; `src/layouts/Record.astro` — Dossier-Frame der Projekt-Routen `/city/porter|amadeus|papers`
- `src/pages/index.astro` — descent-track (280svh, nur `[data-mode='full']`), sticky Hero, `.fog-veil`, Paper-Sektion `#descent`; KEIN eigenes Script mehr (Logik im Controller)
- Veil-Styles + Welt-Paletten am Ende von `src/styles/global.css` (`.passage…`)
- index setzt `data-daypart` inline (First-Paint-Fallback, respektiert `?hour`)

## Umgebungs-Gotchas (Windows, wichtig!)

- **npm braucht `$env:NODE_OPTIONS="--use-system-ca"`** — sonst `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (lokaler Proxy/AV bricht TLS auf). Gilt für JEDEN npm-Befehl!
- **Push funktioniert**: Remote `https://github.com/MattisEngelhardt/Website.git`, Auth via Git Credential Manager (gh CLI bleibt uneingeloggt — egal). Nach jedem Commit auf main pushen!
- Pfad enthält Leerzeichen + OneDrive — Befehle immer quoten; OneDrive kann I/O verlangsamen
- PowerShell 5.1: kein `&&` — `;` oder `if ($?)` nutzen
- **NIE Datei-Edits per PowerShell `-replace`** — Get-Content/Set-Content verhunzt UTF-8 (Mojibake bei —, →, ──). Immer Edit/Write-Tool nutzen (Fehler vom 11.06., verify-passage.mjs musste neu geschrieben werden)

## Runtime-Verifikation (etabliert 11.06., immer nutzen!)

- **`node scripts/verify-hero.mjs`** (Dev-Server muss laufen): fährt System-Chrome headless (echtes WebGPU!), prüft Paletten/`?hour`, Linsen-Maske (`?lens`), Descent-Scroll, Katalog-Gate; Screenshots nach `verify-out/` (gitignored) → mit Read-Tool ansehen
- **`node scripts/verify-passage.mjs`**: echte Navigationen (summit↔sea ×3, History back/forward, Anker-Link, Katalog-Modus) — prüft Szenen-REMOUNT beider WebGPU-Szenen, Attribut-Restore, Veil-Zyklus, 0 Errors
- **`node scripts/verify-sea.mjs`**: Voyage-Scroll (Captions-Fenster, Goldblende, Logbuch), Katalog-Gate auf /sea, Screenshots `sea-*.png`
- Playwright als devDep installiert mit `$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="1"` (nutzt `channel: 'chrome'`, kein Browser-Download)
- Playwright-Gotcha: Veil im Idle ist `visibility:hidden` → `waitForSelector(…, { state: 'attached' })`, sonst Timeout
- Astro **devToolbar deaktiviert** (504 „Outdated Optimize Dep"-Rauschen in Dev; wir nutzen sie nicht)
- Headless misst keine ehrliche FPS — Perf-Eindruck braucht echtes Gerät

## three 0.184 / TSL-Findings (Runtime-bestätigt)

- `THREE.PostProcessing` ist **deprecated seit r183** → `THREE.RenderPipeline` (identische API: `outputNode`, `render()`, `dispose()`)
- TSL `Loop`: `{ start, end, condition: '<=', type: 'float' }` nutzen — Float-Loop-Var ist direkt in `vec2()` verwendbar, Int-Var kollidiert mit den TS-Typen von `float()`
- **`screenUV` hat Ursprung OBEN-links** (WebGPU-Konvention) → Pointer-UV NICHT y-flippen (klassischer GL-Reflex wäre falsch — war ein echter Bug, via `?lens`-Screenshot gefunden)
- `pass(scene, camera).getTextureNode().sample(uvNode)` funktioniert für Offset-Sampling im Kuwahara
- Kuwahara Radius 4 = ~100 Taps/Pixel → pixelRatio auf 1.5 gedeckelt
- **TSL-Akkumulator-Reassignment** (`let x = float(0); x = x.add(...)`) gibt ts(2322) (VarNode vs Node) → Akkumulatoren als `any` typisieren; `varying(float(x))` stellt Typen wieder her
- **CPU/GPU-Sync**: TSL-`time` hat eigenen Ursprung — wenn CPU dieselbe Animation spiegeln muss (Schiff auf Wellen), eigenes `uTime`-Uniform aus dem Loop füttern
- **CanvasTexture als Daten-Map**: `flipY = false` setzen, sonst ist die Welt-UV-Zuordnung gespiegelt (Default flipY=true!)
- **Alpha-Kanal als Material-Encoder**: eine Silhouetten-Textur, Alpha-Stufen unterscheiden Stoffe (Segel 0,5 / Rumpf 1,0) → `mix(colorA, colorB, smoothstep(a))` — ein Draw, zwei Materialien

## Inspirations-Referenzen (von Mattis, 11.06. — orientieren, NIE kopieren)

| Site | Was Mattis daran liebt | Was wir mitnehmen |
|---|---|---|
| phantom.land | Soundeffekte + Hintergrundmusik, Three.js-Gallery-Wall | Audio-Layer ernst nehmen (Howler, Welt-Klangfarben + UI-Sounds). Aber: Mattis will mehr — durch eine eigene 3D-Welt *laufen*, nicht nur Gallery |
| landonorris.com | Krasse Effekte, eigener Stil | War schon Interaktions-Referenz (Helm-Morph → unser Painterly↔Real-Morph) |
| pacomepertant.com | Kunstgalerie-Feeling, Sounds | Museums-/Frontispiz-Typo, kuratierte Inszenierung der Fotos (Akt III) |
| juliencalot.com | **Unterschrift als Loading-Screen** | Mattis will das explizit auch: animierte Signatur „Mattis Engelhardt" als Loader (SVG stroke-draw). TODO(Mattis): echte Unterschrift als Vorlage? Sonst Fraunces-basierte Signatur |

## Assets-Inventar (`/assets`, hochgeladen 11.06.)

- `bayern/` — 2 Fotos (goldene Morgenwiese mit Kühen, sehr warm) + 1 Video (40 MB)
- `italien/` — 3 Fotos (u. a. Florenz-Dom bei Nacht!) + 4 Videos (38–143 MB) — **neu, war nicht im Plan**
- `montenegro/` — 9 Fotos (Gebirge/Kotor, Nacht-Shot) + 9 Videos (65–485 MB!) — größter Fundus
- `österreich/` — 3 Fotos (Winter-Gipfelpanorama, perfekt für Akt-0/Gipfel-Bezug) + 1 Video — **neu**
- `jakobsweg/` — **LEER!** Akt III braucht Camino-Fotos → von Mattis nachfordern
- Alle Videos sind Roh-Material (Pixel-Handy, teils >100 MB) → niemals direkt shippen; Auswahl + ffmpeg-Kompression (AV1/H.265 + Poster) nötig. Fotos 2–10 MB → Astro Image/WebP-Pipeline.

## Offene Inputs von Mattis (Tag-1-Liste aus PLAN.md)

1. ~~Reisefotos + Videos~~ ✅ in `/assets` (aber: **Jakobsweg-Ordner leer** — nachliefern!); ggf. echte Unterschrift für Signature-Loader
2. Projekt-Fakten: Multi-Agent-Deck-System, VoiceForge, StudyMind, Strategy Agent
3. Bio-Eckpunkte (was öffentlich sein darf), berufliche Stationen
4. GitHub/LinkedIn-URLs, CV ja/nein, Rückenfigur-Silhouette ja/nein
5. **Domain-Entscheidung** (Empfehlung: mattisengelhardt.com, ~10 €/Jahr) — `site` in astro.config.mjs danach anpassen
6. ~~`gh auth login` / Repo~~ ✅ Repo läuft (`MattisEngelhardt/Website`) — offen nur noch: Cloudflare-Pages im Dashboard mit dem Repo verbinden (Build: `npm run build`, Output `dist`, env `NODE_OPTIONS=--use-system-ca` NICHT nötig in CF)

## Design-Prinzipien (aus Recherche, nie vergessen)

- Awwwards-Gewinner 2026: Zurückhaltung > Spektakel; Effekte nur, wo sie die Geschichte tragen; Performance wird mitbewertet (Budget: LCP < 2s, initiales JS < 150 KB, 60fps)
- Kein Awwwards-Kopieren — Mattis' Stil-DNA (Aivazovsky/Friedrich → Pixel-Neo-Tokyo → Realismus) IST das Differenzierungsmerkmal
- Alles HTML zuerst (SEO), Living Layer streamt nach (Progressive Enhancement)
- TODO-Marker im Code: `TODO(Mattis)` = braucht seinen Input, `TODO(content interview)` = Bio-Fakten

## Offene technische Punkte / Risiken

- Fraunces: `full.css` + `full-italic.css` importieren (NICHT bare import — Standard-css hat nur wght-Achse, wir brauchen opsz/SOFT/WONK; bare import gibt zudem ts(2882))
- ClientRouter-Regeln (seit 11.06. aktiv): Per-Page-Scripts VERBOTEN — alles über Welt-Controller in `src/worlds/` + Registrierung in passage.ts. `<html>`-Attribute, die der Client setzt, müssen in `astro:after-swap` restauriert werden. `?hour`-Override geht bei SPA-Nav verloren (Links tragen keine Query) — Dev-only, bewusst
- FPS auf echtem Mittelklasse-Gerät ungemessen (Kuwahara-Kosten); Fallback-Idee falls nötig: Radius 3 oder Post nur auf `full` mit gutem GPU-Tier
- Wanderer ist prozedural — falls Mattis eine echte Silhouette (Foto) will, ist `drawWanderer()` einfach austauschbar (gleiche Alphamasken-Schnittstelle)
- `?hour=19.5`: WebGL-Szene mischt golden→dusk kontinuierlich, CSS-Fallback springt diskret bei 19h auf dusk — bewusste Vereinfachung, fällt nur ohne WebGL auf
