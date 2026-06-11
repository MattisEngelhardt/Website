# brain.md — Projektgedächtnis „Der Wanderer"

> Persistentes Wissen über Sessions hinweg. Präzise, knapp, immer aktuell halten.
> Regel: Jede Session liest dieses File zuerst und schreibt neue Findings sofort rein.

## Session-Workflow (fest, von Mattis gewünscht)

1. **Session-Start:** brain.md lesen (dieses File), dann HANDOFF.md
2. **Während der Session:** neue Findings sofort hier eintragen
3. **Session-Ende (großer Sessions):** `HANDOFF.md` aktualisieren — perfekter Handoff-Prompt an den nächsten Fable, beginnt mit `@PLAN.md @brain.md`; knapp, verweist auf brain.md statt zu duplizieren

## Status (Stand: 11.06.2026 Nachmittag, Tag 2 von 12)

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
- ⏳ Noch offen aus Tag 2–3: Sound-Layer (kann auch in Tag-11-Polish)
- ⏳ GitHub-Repo + Deploy (braucht `gh auth login` von Mattis); **FPS-Check auf echtem Gerät** (Kuwahara = ~100 Taps/Pixel; Headless kann keine ehrliche FPS messen — Mattis soll einmal scrollen/wedeln und auf Ruckeln achten)
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
- `src/lib/passage.ts` — **Die Passage**: ClientRouter-Lifecycle, Veil-Choreografie (closeVeil/openVeil über `transitionend`), World-Registry (`CONTROLLERS`-Map → dynamic imports), restauriert `data-mode`/`data-daypart` in `astro:after-swap` (Router wischt ALLE `<html>`-Attribute!), Lenis stop/sync/start um Swaps herum
- `src/lib/daypart.ts` — Daypart-Logik (synchron halten mit Inline-Script in index.astro!)
- `src/worlds/summit.ts` + `src/worlds/common.ts` — Welt-Controller: `mount(ctx) → cleanup`; neue Welten hier registrieren (passage.ts `CONTROLLERS`)
- `src/pages/index.astro` — descent-track (280svh, nur `[data-mode='full']`), sticky Hero, `.fog-veil`, Paper-Sektion `#descent`; KEIN eigenes Script mehr (Logik im Controller)
- Veil-Styles + Welt-Paletten am Ende von `src/styles/global.css` (`.passage…`)
- index setzt `data-daypart` inline (First-Paint-Fallback, respektiert `?hour`)

## Umgebungs-Gotchas (Windows, wichtig!)

- **npm braucht `$env:NODE_OPTIONS="--use-system-ca"`** — sonst `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (lokaler Proxy/AV bricht TLS auf). Gilt für JEDEN npm-Befehl!
- `gh` CLI ist NICHT eingeloggt → GitHub-Push braucht Mattis (`gh auth login`)
- Pfad enthält Leerzeichen + OneDrive — Befehle immer quoten; OneDrive kann I/O verlangsamen
- PowerShell 5.1: kein `&&` — `;` oder `if ($?)` nutzen
- **NIE Datei-Edits per PowerShell `-replace`** — Get-Content/Set-Content verhunzt UTF-8 (Mojibake bei —, →, ──). Immer Edit/Write-Tool nutzen (Fehler vom 11.06., verify-passage.mjs musste neu geschrieben werden)

## Runtime-Verifikation (etabliert 11.06., immer nutzen!)

- **`node scripts/verify-hero.mjs`** (Dev-Server muss laufen): fährt System-Chrome headless (echtes WebGPU!), prüft Paletten/`?hour`, Linsen-Maske (`?lens`), Descent-Scroll, Katalog-Gate; Screenshots nach `verify-out/` (gitignored) → mit Read-Tool ansehen
- **`node scripts/verify-passage.mjs`**: echte Navigationen (summit↔sea ×3, History back/forward, Anker-Link, Katalog-Modus) — prüft Szenen-REMOUNT, Attribut-Restore, Veil-Zyklus, 0 Errors
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
6. `gh auth login` für öffentliches Repo + Cloudflare-Pages-Verbindung

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
