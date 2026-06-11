# brain.md — Projektgedächtnis „Der Wanderer"

> Persistentes Wissen über Sessions hinweg. Präzise, knapp, immer aktuell halten.
> Regel: Jede Session liest dieses File zuerst und schreibt neue Findings sofort rein.

## Session-Workflow (fest, von Mattis gewünscht)

1. **Session-Start:** brain.md lesen (dieses File), dann HANDOFF.md
2. **Während der Session:** neue Findings sofort hier eintragen
3. **Session-Ende (großer Sessions):** `HANDOFF.md` aktualisieren — perfekter Handoff-Prompt an den nächsten Fable, beginnt mit `@PLAN.md @brain.md`; knapp, verweist auf brain.md statt zu duplizieren

## Status (Stand: 10.06.2026 Abend, Tag 1 von 12)

- ✅ Tag 1 komplett: Recherche, Repo (git, branch `main`), Astro-6-Skeleton, Art-Direction-Lock, 5 Welt-Routen mit SEO-Text, Akt-0-Hero erster Pass (Nebelmeer + Tageszeit-Himmel + Maus-Wind), README, brain.md
- ✅ `npm run check` 0 Fehler, `npm run build` grün (5 Routen + Sitemap)
- ✅ Perf-Budget eingehalten: Einstiegsroute ~4 KB initiales JS; journey-Chunk (GSAP+Lenis) 129 KB lazy; summit-Chunk 783 KB raw (~200 KB gzip, three/webgpu) streamt nach First Paint → Optimierungskandidat, beobachten
- ⏳ Hero noch NICHT im Browser verifiziert (TSL-Runtime!) → erster Schritt nächste Session: `npm run dev` + visuell prüfen
- ⏳ Dann: GitHub-Repo (braucht `gh auth login` von Mattis) → Deploy-Pipeline → Tag 2–3: Akt 0 Meisterstück (Kuwahara-Morph, Wanderer-Figur, White-out-Descent, Scroll-Journey)
- Deadline: **22.06.2026** (12 Tage, Roadmap in PLAN.md)

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
- `src/lib/quality.ts` — Erlebnis-Gate; `src/lib/journey.ts` — Lenis+GSAP-Singleton
- `src/scenes/summit.ts` — Akt 0: 7 Fog-Layer (fbm via mx_noise_float, TSL), Tageszeit-Paletten-Keyframes (CPU-lerp → Uniforms), Maus = Wind (akkumulierender Drift) + Kamera-Parallax. Dev-Tool: **`?hour=19.5`** überschreibt Tageszeit!
- Seiten setzen `data-daypart` inline (CSS-Fallback-Himmel passt zur Uhrzeit, auch ohne WebGL)

## Umgebungs-Gotchas (Windows, wichtig!)

- **npm braucht `$env:NODE_OPTIONS="--use-system-ca"`** — sonst `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (lokaler Proxy/AV bricht TLS auf). Gilt für JEDEN npm-Befehl!
- `gh` CLI ist NICHT eingeloggt → GitHub-Push braucht Mattis (`gh auth login`)
- Pfad enthält Leerzeichen + OneDrive — Befehle immer quoten; OneDrive kann I/O verlangsamen
- PowerShell 5.1: kein `&&` — `;` oder `if ($?)` nutzen

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

- TSL-API: `mx_noise_float`, `time`, Node-Uniforms — Build + Typecheck grün gegen three 0.184, aber **Runtime im Browser noch ungetestet** (TSL-Fehler zeigen sich erst dort)
- Fraunces: `full.css` + `full-italic.css` importieren (NICHT bare import — Standard-css hat nur wght-Achse, wir brauchen opsz/SOFT/WONK; bare import gibt zudem ts(2882))
- Kuwahara-Painterly↔Real-Morph (Signature-Moment) noch nicht gebaut → Tag 2–3
- View Transitions (ClientRouter) bewusst NOCH nicht drin — kommt mit dem Übergangs-Framework Tag 2–3
- Wanderer-Rückenfigur fehlt im Hero (wartet auf Asset-Entscheidung)
