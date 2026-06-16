# MAIN PLAN — „Der Wanderer" auf Awwwards-Niveau (Krise #2 → Lobby · Vacations · Camino · Boot · Text)

> **Dies ist der übergeordnete MAIN PLAN.** Er ist NICHT für einen einzigen Chat — er ist die persistente Referenz für das ganze Riesenprojekt. Jeder neue Chat startet mit einem **Handoff-Prompt, der auf genau dieses Dokument verweist**, sagt **wo wir stehen**, **was zu tun ist** und **wie gearbeitet wird** (siehe §3). Erste Amtshandlung des Implementers: diesen Plan + `brain.md` + `HANDOFF.md` lesen. Dieser Plan (`MAINPLAN.md`) ist im Repo getrackt und wird ab hier gepflegt.

---

## 0 · An den nächsten Opus + Pflichtlektüre

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt (Astro 6 + Three.js WebGPU/TSL). Mattis hat den Stand im Browser abgenommen und **Krisengespräch #2** geführt: die Basis ist solide (Wasser, Rahmen-Ästhetik, City-3D, Übergänge — alles abgenommen), aber **UX/Navigation/Inhalt sind noch nicht award-reif**. Du bist ab jetzt der **strengste Senior-Awwwards-Coder/Reviewer** (§3) — du baust UND prüfst dich gnadenlos selbst auf dem Localhost.

**Pflichtlektüre, in dieser Reihenfolge, BEVOR du etwas anfasst:**
1. `brain.md` → oberste Sektion **„⚠️ DAS KRISENGESPRÄCH 12.06.2026 — DIE QUALITÄTSDOKTRIN"** komplett, dann **„Tag 4"** (City), **„Tag 5–6"** (Threshold/Signature), **„Tag 6–7"** (IFFT-Ozean+Boot), **„Tag 8"** (Camino-GIS), **„Tag 9–10"** (Horizont).
2. `PLAN.md` (Konzept/Welten/Art-Direction) · `HANDOFF.md` (Gesamtstand) · Krisen-Plan #1: `C:\Users\engel\.claude\plans\ok-krisengespr-ch-das-was-bubbly-ullman.md`.

**Doktrin (unverändert, gilt für JEDE Szene):** Hero-Visuals = echte **Blender**-Production-Assets / gratis top-notch **CC0**-Daten / **physikalisch plausible Echtzeit-Sim**. Shader = Finish, nicht Inhalt. **Abnahme = Side-by-side gegen Referenz + ehrliche FPS auf echter GPU (headed)** — „0 Console-Errors" reicht NIE. ⭐ **Gamechanger-Prinzip** (Memory `use-free-topnotch-assets.md`): bei JEDEM Hero-Element zuerst gratis top-notch Quelle prüfen, sonst Eigenbau. **Eleganz vor Effekt-Spam, kein Lag** (≥60 fps Mittelklasse).

### 0.1 · Status-Ledger (pro Session pflegen — was steht, was fehlt)

> Pflege diese Tabelle bei jedem End-Ritual (§3d/e). `⬜ offen · 🟧 in Arbeit · ✅ verifiziert`. „Verifiziert wie" = Verify-Script + Side-by-side + ehrliche FPS.

| Workstream | Status | Verifiziert wie | Datum |
|---|---|---|---|
| A · Main-Lobby (Nebelmeer-Hub) | 🟧 | **Spike `/dev/hub` steht** (`src/scenes/hub.ts` + Spike-Page): Pan (Yaw-Clamp), 4 gerahmte Galerie-Tafeln mit **echten Welt-Renders** (Pipeline `scripts/capture-plates.mjs`), Hover-Lens wischt klar + lesbare Placards, **Klick-Dolly durch den Rahmen** (Money-Shot). `verify-hub.mjs` PASS, check 0, build grün (13 S.), 0 Errors. **2 Review-Runden** (zweiter Opus, gnadenlos): alle P0/P1 adressiert (echte Plates statt Platzhalter, Nebel kühler/dichter, breiter Goldrahmen+Shadow, Wanderer auf Fels verankert). **Offen:** Nebelmeer noch nicht voll dramatisch (flache Planes → ggf. volumetrisch); **Integration A5/A6** (worlds/summit.ts Hub-Modus + index.astro `<a>` + passage.ts Frame→Nav) steht aus; ehrliche FPS nur headed. | 16.06. |
| B · My Vacations (Galerie + Pipeline) | ⬜ | — | — |
| C · Camino Blender-Bird's-Eye | ⬜ | — | — |
| D · Das Boot (The Sea) | ⬜ | — | — |
| E · Text-Purge | 🟧 | Copy gepurged + dt. Leak-Bug raus + „City" statt „City of Agents" (alle user-facing Stellen + passage-Plakette); check 0 / build grün; verify-passage Katalog-Check auf neuen Sea-h1 angepasst & grün. **Offen:** Flavor-Captions strukturell entfernen (braucht worlds/{sea,city,horizon}.ts-Timeline + verify-{sea,city,horizon}.mjs) — final 1-Zeilen `TODO(Mattis)`. | 16.06. |
| F · Threshold-Zoom | ✅ | `FOCAL_X 0.5→0.32`, `FOCAL_Y 0.455→0.5`, `SMAX 7.2→4.3`. verify-threshold PASS, 0 Errors; Side-by-side-Deep-Frame (Read) bestätigt: Push landet im Nebelmeer + Nebelbergen der linken Hälfte (Wanderer als Repoussoir rechts), scharf, sanft — nicht „in die Borsten". Threshold = reine CSS-Transform → 60fps. | 16.06. |

---

## 1 · Kontext: Was Mattis in Krise #2 verlangt (verbindlich)

Wörtlich-nahe Kern-Kritik + die in dieser Planungs-Session getroffenen Entscheidungen:

- **Das Nebelmeer ist die MAIN-LOBBY der ganzen Seite.** „Du startest rein, trittst ins Gemälde ein, alles lebendig, der Nebel zieht an dir vorbei, du bist am Charakter vorbeigelaufen und jetzt komplett IM Nebel drin — und kannst mit der Maus leicht links↔rechts pannen, in so einem Bereich." → Die Wanderer-Welt trägt ALLES; man entscheidet von DRIN (Krisen-Entscheidung #2, die zur Text-Liste descoped wurde — jetzt richtig bauen).
- **Die anderen Welten = eine elegante Kunstgalerie IM Friedrich-Nebel.** „Jeweils Bild + ganz kurzer Text, geil gemacht, schwebt in der Luft, richtig gut lesbar je nach Blickwinkel — fast wie eine Kunstgalerie, aber in der Caspar-David-Friedrich-Welt." ⚠️ **Schweben nur, wenn ‚über nice'** — Mattis HASST billiges Schweben (siehe Camino). Die Latte: edle, gerahmte, perfekt lesbare Tafeln — KEINE Game-HUD-Marker.
- **„My Vacations" ist das fehlende Main-Ding.** Seine echten Reise-Fotos/-Videos (Montenegro/Italien/Bayern/Österreich) kommen aktuell NIRGENDS vor. Entscheidung: **eigene Welt „Vacations"** = **Premium-Galerie, fast leinwand-like**, in der man **alle Videos+Bilder direkt durchklickt** (Mattis: „fresher als nach Ort sortiert" → **unsortiert/kuratiert, nicht nach Ort gruppiert**). Referenz geliefert: **phantom.land/work** (siehe §5 + §15).
- **Camino de Santiago bleibt ein EIGENER 3D-Block** (raus aus Vacations). Der jetzige Flyover ist „übertrieben scheiße / wie ein billiges Videogame" (schwebende Marker/Beacons in der Map). Entscheidung: **Blender-Kino-Bird's-Eye** — eine **~7-sekündige, vor-animierte Kamerafahrt über die ganze Strecke** Porto→Santiago, „Google-Maps, aber crazy viel besser", **ohne** schwebende Game-Marker.
- **The City** (3D-Pixelstadt) **gefällt Mattis** → behalten, nur als Galerie-Tafel ein geiles Bild nehmen.
- **The Sea:** Wasser solid, aber das **Boot fliegt billig drüber** → neu inszenieren + integrieren (vor der Sonne kreuzen, Mehrpunkt-Buoyancy, Kielwasser/Spritzer).
- **Text:** die kitschigen, unpersönlichen Sätze raus („City of Agents", schwülstige Captions) → **wenig Text, nur was Sinn macht.**
- **Zoom ins Gemälde:** in die **linke Hälfte**, **sanfter** (nicht in die Borsten).
- **Prozess:** Riesenprojekt über viele Chats → **Main Plan + immer ein top Handoff-Prompt + gnadenlos strenger Senior-Awwwards-Review** (§3).

**In dieser Session verbindlich entschieden:** Hub = „Drift & durchtreten" (immersiv) · „Durch-den-Rahmen"-Signatur NUR im Hub (Welt-zu-Welt-Übergänge bleiben der abgenommene Veil) · Boot = neu inszenieren+integrieren · Vacations = eigene Premium-Galerie-Welt, Medien unsortiert direkt klickbar · Camino = Blender-Kino-Bird's-Eye 7 s.

---

## 2 · Ziel-Architektur: Die Main-Lobby & ihre Welten

```
Loader „Mattis E." → THRESHOLD (linke Bildhälfte, sanft) → ✦ DIE MAIN-LOBBY ✦
                                                            (das lebende Nebelmeer)
   Du bist DRIN. Nebel zieht vorbei. Maus = Wind + Blick-Pan (links↔rechts Bereich).
   In der Tiefe schweben — edel gerahmt, gallerie-grade, lesbar — die Welten:

     ┌────────┐   ┌────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────┐
     │The Sea │   │The City│   │Camino de S.  │   │My Vacations│   │The Horizon│
     │(Aivaz.)│   │(3D pic)│   │(3D flyover)  │   │(premium gal)│   │(contact) │
     └────────┘   └────────┘   └──────────────┘   └────────────┘   └──────────┘
   Hover → Malerei wischt klar + Titel/1 Zeile · Klick → Kamera dollyt DURCH den
   Rahmen → gemalter Veil → Zielwelt.  Zurück auf „/" → man taucht wieder im Nebel auf.
        │
        ▼ (Scroll unter der Lobby, optional)  kurze ehrliche BIO (SEO/„Sinn")
```

- **The Sea** (`/sea`): IFFT-Ozean (abgenommen) + Brigg, die vor der Sonne kreuzt (Workstream D).
- **The City** (`/city`): bleibt (abgenommen). Galerie-Tafel = geiles City-Still.
- **Camino de Santiago** (`/camino`): Blender-Kino-Bird's-Eye-Rebuild, 7 s (Workstream C).
- **My Vacations** (`/vacations`, NEU): Premium-Galerie aller Reise-Medien (Workstream B).
- **The Horizon** (`/horizon`): goldenes Wolkenmeer + Kontakt (abgenommen; nur Text-Purge).

**Katalog-Modus** (reduced-motion / saveData / kein GPU): voller HTML-Text, alle Welten als echte `<a>`-Liste, Vacations als statische Foto-Galerie, keine Szene. SEO unangetastet.

---

## 3 · Arbeitsweise: vollautomatisierter Workflow — Main Plan · Handoff · gnadenloser Senior-Awwwards-Review

Mattis' ausdrücklicher Wunsch: ein **perfekt vollautomatisierter Workflow, bei dem KEINESFALLS Wissen oder Kontext verloren geht.** Drei persistente Artefakte + ein festes Start- und End-Ritual + eine Review-Gate. **Nichts ist „fertig" ohne das End-Ritual.**

**(a) Der Main Plan = `MAINPLAN.md` (dieses Dokument, im Repo getrackt).** Der operative Master, persistente Single-Source-of-Truth. Bei jeder neuen Architektur-/Scope-Entscheidung **hier** aktualisieren (inkl. der Status-Tabelle (e)). `PLAN.md` = Ur-Konzept (eingefroren), `brain.md` = technisches Gedächtnis/Findings, `MAINPLAN.md` = was zu tun ist & Stand.

**(b) Der Handoff-Prompt = `HANDOFF.md` (automatisch am Ende JEDER Session).** Ein top-notch „Krisengespräch-Style"-Prompt für die nächste Session, der **immer** mit `@MAINPLAN.md @brain.md` beginnt und **immer auf den übergeordneten Main Plan verweist**. Enthält: **(1)** exakt **was schon implementiert + wie verifiziert** wurde, **(2)** was **noch zu tun** ist (verweist auf MAINPLAN-Phasen/Workstreams), **(3)** **wie gearbeitet** wird (Doktrin + Gotchas §13 + dieser Workflow), **(4)** offene `TODO(Mattis)`. Knapp, verweist statt zu duplizieren — die Tiefe lebt in MAINPLAN.md + brain.md.

**(c) Start-Ritual (jede Session, erste Handlung):** `HANDOFF.md` → `MAINPLAN.md` → `brain.md` lesen, BEVOR irgendetwas gebaut wird. So startet jeder Chat mit vollem Kontext.

**(d) End-Ritual (jede Session, Pflicht — die Kontinuitäts-Garantie):** in dieser Reihenfolge — **(1)** neue technische Findings sofort in `brain.md`; **(2)** `MAINPLAN.md` updaten (Entscheidungen + Status-Tabelle (e)); **(3)** `HANDOFF.md` neu schreiben (b); **(4)** committen + pushen (§13). **Kein Session-Ende ohne diese vier Schritte** — das ist der Mechanismus gegen Wissens-/Kontextverlust.

**(e) Die Status-Tabelle (lebt in `MAINPLAN.md`, oben als §0.1 gepflegt).** Pro Workstream A–F: Status `⬜ offen / 🟧 in Arbeit / ✅ verifiziert`, plus „verifiziert wie" + Datum. So sieht jeder Chat in 5 Sekunden, **was schon implementiert wurde und was noch zu tun ist.**

**(f) Der strenge Senior-Awwwards-Review (pro Chunk, Pflicht-Gate).** Bevor irgendetwas „fertig" heißt, prüfst du wie ein **Awwwards-Jury-Senior, der jede SOTD kennt und gnadenlos hart ist**:
- **Methode:** Seite real auf dem Localhost (headed, echtes WebGPU) starten und **ALLES durchklicken/scrollen wie ein Verrückter** — Desktop + Mobile-Breite + Katalog/reduced-motion. Jeden Übergang, jeden Hover, jeden Klick, jede Welt, Rückwege. Playwright-Scripts (`scripts/verify-*.mjs`) als automatisierter Beweis + Screenshots, die du per Read-Tool **selbst anschaust** = Look-Abnahme.
- **Bewertung, maximal streng, je Kategorie (0–10, Pass-Bar ≥ 8):** Design/Ästhetik · Usability/UX · Kreativität · Content/Sinn · **Bugs/Stabilität** · **Performance (ehrliche FPS auf 4060)** · **Mattis-DNA-Fit** (Friedrich/Aivazovsky, persönlich, lebendig, kein Kitsch). Side-by-side gegen die jeweilige Referenz ist Teil der Wertung.
- **Output:** ein **konkreter, priorisierter** Fix-Report (P0 = Blocker / P1 / P2) mit „so implementierst/verbesserst du es ideal" — keine vagen Lobeshymnen. Erst wenn alle Kategorien ≥ 8 und 0 P0/P1 offen sind, ist der Chunk fertig.
- **Companion-Tool:** Mattis kann zusätzlich `/code-review ultra` (Multi-Agent-Cloud-Review) auf den Branch werfen; das ist der Code-Level-Begleiter zum manuellen UX/Design-Review.

**Die Schleife pro Chat:** Handoff lesen → Workstream bauen → Spike/Verify → **strenger Review + Fixes bis Pass** → committen+pushen → `MAINPLAN.md`/`brain.md`/`HANDOFF.md` updaten.

---

## 4 · Workstream A — Die Main-Lobby (Nebelmeer-Hub)  ⭐ Herzstück

**Auf der bestehenden Summit-Szene aufbauen** (`src/scenes/summit.ts`) — sie ist der Nebel-Hub in Rohform: Aivazovsky-Himmel mit Tageszeit-Palette (`lerpPalette`/`DAY_CYCLE`), 7 Nebel-Layer + Wisp (`addFogLayer`), Wanderer-Rückenfigur, Blender-Outcrop (`summit.glb`), **Maus-als-Wind** (`windVel`/`pointer`), **Kuwahara-Malerei mit Reality-Lens** via `createPainting(...,{lens:true})` → `uPointerUv`+`uReality`. Nicht neu erfinden — erweitern.

- **A1 · Lebendig + Pan-Bereich.** Verstärke das „Du bist DRIN"-Gefühl: Nebel-Drift sichtbar an der Kamera vorbei, Maus pant den Blick **links↔rechts** in einem begrenzten Bereich (Yaw-Clamp), sanftes Parallax der Tiefe. Die Wanderer-Figur steht im Vordergrund (man ist an ihm vorbei „nach drin" getreten). Tageszeit-Sync bleibt.
- **A2 · Die Galerie-Tafeln (edel, NICHT billig).** 4–5 gerahmte „Gemälde/Tafeln" (texturiertes Plane + schlanker Goldrahmen, wie die abgenommene Museums-Plakette) in unterschiedlicher Tiefe, leicht bobbend, Wind-Parallax. **Art-Direction gegen „billiges Schweben":** großzügige, ruhige Anordnung; Rahmen mit echtem Material/Tiefe; Tafel + kurzer Text **immer optisch zur Kamera ausgerichtet & top lesbar** (Billboard-Yaw zum Betrachter, Schrift mit Lesbarkeits-Hintergrund/Schatten); sanftes Lebenslicht; **keine** harten Game-Marker, keine zappelnden Icons. Die Rahmen werden vom Kuwahara-Pass mitgemalt → Gemälde in einer gemalten Welt.
- **A3 · Hover wischt klar + Titel.** Raycaste den Pointer gegen die Tafeln (Muster `sea.ts` `onPointerMove`→`ray.setFromCamera`). Bei Hover: `uReality` hoch + `uPointerUv` auf die projizierte **Screen-Position der Tafel** → die Lens-Maske in `painting.ts` (Z. 110–113) klärt **genau dort** die Malerei; Titel + 1 ehrliche Zeile als DOM-Overlay, Position pro Frame aus der projizierten Tafel-Position (`transform`, kein Reflow).
- **A4 · Klick = durch den Rahmen.** Kurze GSAP-Kamera-Dolly in die Tafel (füllt Viewport, ~0.6–0.9 s, `--ease-journey`), dann **echte Astro-Navigation auslösen** (programmatischer Klick auf den SEO-`<a href>`), damit `passage.ts` den abgenommenen gemalten Veil in der Ziel-Palette übernimmt (Entscheidung „nur Hub"). Rückkehr auf `/` → optional kurze „aus dem Rahmen auftauchen"-Intro.
- **A5 · Controller-Umbau** (`src/worlds/summit.ts`): nach dem Threshold-Push **Hub-Interaktionsmodus** statt Frontispiz+Descent. Pan/Picking aktiv. Dezente „scroll for the story"-Affordance → Bio-Paper unten (`#descent`, Text gepurged). Lenis bleibt. Cleanup wie gehabt.
- **A6 · DOM/SEO** (`src/pages/index.astro`): Welten als echte `<a>`+Titel im HTML (SEO + Katalog + Klick-Ziel). Full-Mode blendet die sichtbare `<ol>` aus (3D ist die Navi); Katalog zeigt sie. Frontispiz minimal.
- **A7 · Spike + Verify:** `src/pages/dev/hub.astro` (Muster `dev/ocean.astro`: noindex, FPS-Overlay, Knobs für Tafel-Anzahl/Tiefe/Dolly) + `scripts/verify-hub.mjs` (Threshold→Hub→Hover→Klick→Welt, Screenshots).

**Dateien:** `src/scenes/summit.ts`, `src/worlds/summit.ts`, `src/pages/index.astro`, `src/lib/passage.ts` (additiver Frame→Navigate-Hook), **neu** `src/pages/dev/hub.astro`, `scripts/verify-hub.mjs`. Reuse: `src/scenes/painting.ts`, `src/lib/journey.ts`.

---

## 5 · Workstream B — „My Vacations" (NEU): die phantom.land-Leinwand-Galerie  ⭐ Main-Ding

Mattis' wichtigstes Feature. Eine **eigene Welt** `/vacations`, erreichbar über die Lobby-Tafel „My Vacations". **Visueller Nordstern = phantom.land/work** (Mattis' Referenz-Screenshot): eine **leicht gekrümmte Leinwand (gecurved)**, voll mit Medien-Kacheln (Foto/Video), durch die man navigiert. **Übernimm das Prinzip, NICHT kopieren — übersetze es in Mattis' Friedrich/Leinwand-Idiom** (warme Palette, gemalte/gerahmte Anmutung). Medien **unsortiert/kuratiert gemischt, NICHT nach Ort gruppiert** (Mattis: „fresher").

**B1 · Interaktion (exakt nach Mattis' Vorgabe):**
- **Leicht gekrümmte Leinwand-Wand** aus Kacheln (Foto + Video gemischt), edel gerahmt, viel Luft. Die Krümmung = subtile 3D-Perspektive.
- **Maustaste gedrückt halten + ziehen = durch die Leinwand „wischen"** → weitere Bilder/Videos kommen zur Erscheinung (das phantom.land-Drag-Wall-Gefühl, mit Momentum/Trägheit). Auch Touch-Drag.
- **Preview pro Kachel:** Hover (Desktop) bzw. In-View (Mobile) → das Video spielt **stumm als Loop** an / Foto hebt sanft. Sofort sichtbarer **Poster** darunter, damit nie eine Lücke/Wartezeit entsteht.
- **Klick auf eine Kachel → immersive Lightbox** (großes Bild / Video mit Ton-Toggle, Pfeil-Navigation, ESC). Winziges dezentes Label (Ort/Jahr) optional.

**B2 · Technik-Empfehlung — DOM-Leinwand statt GL-Textur-Wall.** Baue die Wand als **DOM-Schicht aus `<img>`/`<video>` mit CSS-3D-Transforms** (`perspective` am Container + per-Kachel `translate3d`/leichtes `rotateY` für die Krümmung; Drag bewegt einen `translate3d`-Layer, GPU-composited, `requestAnimationFrame`, Momentum). Grund: viele Videos **nativ vom Browser** dekodieren lassen skaliert weit besser als sie als WebGL-Texturen hochzuladen — genau so bleiben Media-Walls (phantom.land) flüssig. (Optional später eine dezente WebGL-Krümmungs-/Verzerrungs-Schicht, aber erst wenn DOM-Perf steht.)

**B3 · DER KRITISCHE TEIL — 4K-Medien ohne Lag/Wartezeit (Mattis' Hauptsorge).** „Andere Websites kriegen top-notch Videos problemlos hin" — ja, mit genau dieser Strategie. **Niemals 4K-Quelle ausliefern.** Mehrstufig + faul + nur-sichtbar:
- **Pro Video ZWEI Stufen:** (a) **Wall-Preview-Loop** — winzig (Breite ~480–640px, ~3–6 s, **stumm**, niedrige Bitrate, **AV1/WebM + H.264-Fallback**, Ziel **< 1 MB**); (b) **Lightbox-Version** — 1080p, anständige Bitrate, mit Ton, **erst bei Klick** geladen (Ziel ~3–8 MB, `-movflags +faststart`).
- **Pro Foto ZWEI Stufen:** responsive `srcset` (**AVIF + WebP** @ 480/960/1440/1920, q≈78) + **LQIP-Blur-up**-Platzhalter (~20px, inline base64); Full-Res nur in der Lightbox.
- **Virtualisierte Wand + Lazy + nur-Sichtbares-spielt:** `IntersectionObserver` — nur Kacheln nahe dem Viewport mounten ihr Medium; Videos `preload="none"` `muted` `playsinline` `loop`, **autoplay nur in-view**, **pause + Quelle freigeben out-of-view**; **max. ~4–6 gleichzeitig spielende Videos** + begrenzte parallele Decodes. Beim Drag: einlaufende Kacheln mounten, ferne unmounten (DOM-Node-Pool/Recycling). So bleibt eine riesige Wand smooth.
- **Poster-First:** jede Kachel zeigt sofort ihr Poster (billig), der Preview-Loop blendet nach Decode ein → **keine Blank-/Wartezeit**.
- **Formate/Decode:** **AV1** (2026 breit unterstützt, kleinste Dateien) + **H.264**-Fallback; HDR-Pixel-Videos → nach SDR tonemappen (sonst ausgewaschen). `faststart`.
- **Statische Adaptive-Option (nur falls ein Clip länger/höher muss):** selbst-gehostetes **HLS** (`.m3u8` + Segmente) via **hls.js** — läuft auf statischem Cloudflare Pages **ohne Backend**, adaptive Bitrate. Default bleibt die simplere Zwei-Stufen-Progressive-Variante; HLS nur bei Bedarf (auf Datei-Anzahl-Limit achten).
- **Budget (Cloudflare Pages, gratis):** **< 25 MB/Datei**, ~20k Dateien. Preview-Loops ≪ 1 MB, Lightbox-Videos 3–8 MB, alles lazy gestreamt.
- **Mattis' Fallback ausdrücklich:** falls flüssiges Video trotz allem zu teuer ist → **Bilder-only-Wand** (auch 4K, aber via Tiers/`srcset` problemlos). **Entscheidung per ehrlichem Test** (B6). Ideal = Video läuft (mit obigem schafft es das).
- **Reduced-data/Katalog:** nur Poster, click-to-load Video.

**B4 · Pipeline-Scripts.** Originale liegen lokal in `assets/{montenegro,italien,bayern,österreich}` (gitignored, NICHT deployen). Derivate → `public/assets/vacations/` (committed, budgetiert):
- `scripts/make-vacation-media.mjs` (**sharp**): pro Foto AVIF+WebP-Tiers + LQIP.
- `scripts/make-vacation-video.mjs` (**ffmpeg**-Wrapper): pro Video Preview-Loop-Tier (AV1/WebM + H.264) + Lightbox-Tier + **Poster-Frame** (`ffmpeg -ss … -vframes 1`).
- Schreibt ein **Manifest** `public/assets/vacations/manifest.json` (pro Item: `id, type, poster, preview[], full[], srcset, w, h, place, date`) → die Galerie rendert daraus. `.gitignore` prüfen (Derivate committen, Originale lokal lassen).

**B5 · Astro-Seite + Welt.** `src/pages/vacations.astro` (Muster `sea.astro`/`camino.astro`: `World`-Layout, `world="vacations"`, **voller semantischer Inhalt für SEO/Katalog** = statische `<figure>`-Galerie aus dem Manifest) + `src/worlds/vacations.ts` (Controller: gekrümmte Drag-Wand, Virtualisierung, Hover-Preview, Lightbox, Lazy/Pool). In `passage.ts` `WorldName`+`CONTROLLERS`+`worldFromPath` um `vacations` erweitern; `PathNav.astro`-Station ergänzen. Tageszeit-/Palette-Konsistenz wahren.

**B6 · Verify + ehrlicher Perf-Test (Pflicht).** `scripts/verify-vacations.mjs` (Wand lädt, Drag-Wisch bewegt, Hover-Preview spielt, Lightbox auf/zu, Lazy-Mount/Unmount, Poster-First, Katalog-Fallback, 0 Errors). **Plus zwei ehrliche Messungen auf Mattis' Gerät:** (1) **FPS beim Draggen** der Wand mit laufenden Videos (4060, ≥60), (2) **Netzwerk-Throttle-Test** (DevTools „Fast 3G") → die Wand muss **poster-first sofort** stehen und Previews nachladen **ohne Blockieren**. Belegt „lädt geil ohne Lag/Wartezeit".

**B7 · Hinweise:** **Jakobsweg-Ordner ist leer** → Camino-Fotos kommen später (nicht blockieren). Österreich-„über-den-Wolken" kann zusätzlich den Horizont-Kontakt speisen. Montenegro (1,5 GB, viele MP4) ist das reichste Set — kuratiere die stärksten Stücke (nicht stumpf alle 35 Dateien), Qualität vor Masse.

---

## 6 · Workstream C — Camino de Santiago: Blender-Kino-Bird's-Eye (Rebuild)

Eigener 3D-Block. Der jetzige Echtzeit-Flyover (`src/scenes/camino.ts`) hat **schwebende Beacon-Cones + Tube-Route-Head** → „billiges Videogame". **Raus damit.** Neu: eine **vor-in-Blender-choreographierte, kinoreife Vogelperspektive-Kamerafahrt** über die echte Topografie, **~7 s, ganze Strecke Porto→Santiago**, „Google-Maps, aber crazy viel besser".

- **Vorhandenes wiederverwenden:** `public/assets/camino/camino.glb` (echtes Copernicus-Terrain) + `camino_sat.webp` (Sentinel-Drape) + `camino_meta.json` + GIS-Pipeline `scripts/camino/` + Set-Script `scripts/blender/camino_set.py`. **Terrain + Drape bleiben** (abgenommen als „ultra realistic").
- **Technik (Doktrin-bewährt, wie die City):** Kamera **in Blender** als Catmull-Rom-/Bezier-Pfad über die Route choreographieren (hoher, leicht geneigter Bird's-Eye-Winkel, sauberer Anflug, ganze Strecke in ~7 s), als **GLB-Kamera-Animation** exportieren und web-seitig per `AnimationMixer` + `action.time` **scroll-gescrubbt** abspielen (kein `<video>`-Scrub — Frame-genau, Doktrin). Vorlage: `scripts/blender/city_set.py` (61 Quaternion-Keys, Flip-Guard) + `city.ts` (Mixer-Scrub).
- **Look:** Relief-Shading + Sentinel-Drape + aerial perspective + Gold-out behalten; **alle schwebenden Marker/Beacons entfernen.** Die Route optional als **dezente, gelände-huggende Glow-Linie** (kein Floating, keine Cones). Premium, ruhig, lesbar.
- **Inhalt:** kurzer ehrlicher Camino-Text (mit der Mutter) bleibt (SEO), Captions purgen (§8). EOX/Copernicus-Attribution behalten (Lizenzpflicht).
- **Dateien:** `scripts/blender/camino_set.py` (Kamerafahrt ergänzen), neu exportierte `camino.glb` (mit Cam-Animation; gltf-transform **gelockte Flags** §13), `src/scenes/camino.ts` (Beacons raus, Mixer-Scrub rein), `src/worlds/camino.ts` (Waymark/Captions anpassen), `src/pages/camino.astro` (Text-Purge). Verify: `scripts/verify-camino.mjs` + ehrliche FPS.

---

## 7 · Workstream D — Das Boot (The Sea: neu inszenieren + integrieren)

`src/scenes/sea.ts` (Ozean unangetastet — abgenommen). Heute segelt die Brigg von `z −150` nur auf `z −34`, bleibt winzig → liest als Fleck (`verify-out/sea-75.png`). Fix in dieser Tiefe:

1. **Money-Shot:** Brigg **groß & nah** heranführen und **quer vor der tiefen Sonne kreuzen** (Gegenlicht-Silhouette = das Aivazovsky-Motiv) — Pfad/Scale neu (deutlich näher/größer, Querfahrt L→R statt frontal).
2. **Ins Wasser setzen:** Draft/Origin so, dass die **Wasserlinie den Rumpf schneidet**; **Mehrpunkt-Buoyancy** (4–6 Rumpfpunkte aus `seaHeight()`/`seaSlope()` → Pitch/Roll fitten) → sichtbares Stampfen/Rollen.
3. **Verankern:** **Kielwasser** (Foam-Kanal `derivativeTex.z` / Ribbon / Canvas-Trail wie `trailCnv`) + **Bugspritzer** an brechenden Wellen.
4. **Kamera tief** am Höhepunkt, rahmt die Querfahrt vor der Sonne.
5. **Modell nur falls nötig neu** (`scripts/blender/sea_set.py`, mehr Rigg/Segelwölbung) — vorher Gamechanger-Check (gratis CC0-Großsegler?). Re-Export mit gelockten Flags.

Abnahme: Side-by-side gegen `assets-src/paintings/aivazovsky_capmartin_3882.jpg`; ehrliche FPS `/sea` gesamt (Kuwahara+Schiff+Scroll) auf 4060.

---

## 8 · Workstream E — Text-Purge (kitschig → minimal & ehrlich)

Wenig Text, nur was Sinn macht. **Behalten:** echte Bio/Ship's-Log, City-Records (echte Projekte), Camino-Text, Kontakt. **Streichen:** schwülstige Flavor-Captions/Taglines. Worst-Offender (grep selbst, nicht erschöpfend):

| Datei:Zeile | raus/ersetzen |
|---|---|
| `index.astro:105`, `city/index.astro:11,22`, `sea.astro:75` | „The City of **Agents**" → „The City" |
| `index.astro:76` | „This is not a portfolio. It is a journey." → knapp/weg |
| `index.astro:99,106,113,120` | vier `world-line`-Sprüche → je 1 ehrliche Zeile |
| `sea.astro:25` | „The water remembers every route." → nüchtern |
| `sea.astro:36–43` | 3 Voyage-Captions → **streichen** |
| `city/index.astro:23` | „The fog tears open. Neon below." → nüchtern |
| `city/index.astro:36–44` | 3 Approach-Captions → **streichen** |
| `horizon.astro:43–44` | **deutscher Leak „begehbares Kunstwerk"** im engl. Text → **streichen (Bug)** |
| `horizon.astro:23,58` | „The next world is unwritten." 2× → 1× behalten |
| `horizon.astro:37–47`, `camino.astro` Captions | auf max. 1 kürzen/streichen |

Ehrliche 1-Zeilen (Vorschlag, Mattis final): Sea „Who he is." · City „What he builds." · Camino „Where he walked." · Vacations „Where he's been." · Horizon „What's next." ⚠️ **Nie per PowerShell-Replace** (Mojibake) — nur Edit/Write.

---

## 9 · Workstream F — Threshold-Zoom nachjustieren

`src/scenes/threshold.ts`: `FOCAL_X 0.5 → ~0.30–0.35` (linke Hälfte: Nebelmeer/Nebelberge), `FOCAL_Y` am Original feintunen; `SMAX 7.2 → ~4.0–4.5` (sanfter, nicht in die Borsten); CSS-Transform-`wanderer_full.webp` behalten (bei weniger Zoom scharf genug, `.dzi`-Tiles optional). Dissolve übergibt an die **Lobby** (Workstream A). Gegen `assets-src/paintings/Caspar_David_Friedrich_-_Wanderer_above_the_Sea_of_Fog.jpeg` tunen.

---

## 10 · Assets & Pipelines (woher)

- **Friedrich-Derivate** (vorhanden): `public/assets/paintings/wanderer_{overview,full}.webp` + Tiles. Quelle `assets-src/paintings/…Sea_of_Fog.jpeg` (5256×6742).
- **Aivazovsky-Tafel** (Sea): `node scripts/make-painting-derivatives.mjs "assets-src/paintings/aivazovsky_capmartin_3882.jpg" public/assets/plates capmartin`.
- **City/Camino/Horizon-Tafeln:** gerahmte Stills der eigenen Szene → `public/assets/plates/<world>.webp` (sharp 1600w). Quellen: `city_still.py` / `camino_sat.webp` / `/dev/horizon`-Still.
- **Vacations-Medien:** §5-B4-Pipeline (sharp+ffmpeg) → `public/assets/vacations/`. Originale `assets/*` bleiben lokal.
- **Brigg-GLB** (vorhanden) + `scripts/blender/sea_set.py`. **Camino-Terrain** (vorhanden) + `camino_set.py`.

---

## 11 · Hard-Check / Localhost-Selbsttest (du führst ihn selbst durch)

Du bist NICHT im Plan-Mode — starten, klicken, testen, Screenshots lesen.
1. `$env:NODE_OPTIONS="--use-system-ca"; npm run check` (0) + `npm run build` (grün).
2. `npm run dev` → **tatsächlichen Port notieren** (~4325).
3. Playwright (installiert) wie `scripts/verify-*.mjs`: jede Beat-Phase abfahren (Loader→Threshold links/sanft→Lobby lebt+pant→Hover klärt Tafel+Titel→Klick dollyt durch→Veil→Zielwelt→zurück; Vacations: Galerie→Hover-Play→Lightbox; Camino: 7-s-Flug ohne Floating). Screenshots→`verify-out/`→per Read **selbst ansehen**.
4. **Side-by-side** gegen Referenz (Friedrich/Aivazovsky/phantom.land-Vacations).
5. **Ehrliche FPS (headed, 4060):** `/dev/hub`, `/sea`, `/dev/camino`, `/vacations` — FPS-Overlay real lesen (≥60). Headless-ANGLE zählt NICHT.
6. Alle Welten + zurück manuell; jeder Übergang ohne Regression.
7. **Katalog/A11y** (`prefers-reduced-motion`): voller Text, `<a>`-Welten, statische Vacations-Galerie, kein Bruch; Mobile-Breite.
8. **0 Console-Errors** durchgehend. Dann **strenger Senior-Awwwards-Review §3f**.

---

## 12 · Bewertungskriterien (Awwwards-Latte — Pass-Gate)

- [ ] **Lobby-Gefühl:** spürbar IM Nebelmeer, lebendig, Maus pant, man entscheidet von DRIN — KEIN Text-Listen-„Durchklicken".
- [ ] **Galerie edel:** Tafeln schweben gallerie-grade, perfekt lesbar, KEIN billiges Game-Schweben.
- [ ] **Durchtreten** liest als „durch das Gemälde", Rückkehr taucht im Nebel auf.
- [ ] **Vacations:** gekrümmte Drag-Leinwand à la phantom.land (Hover-Previews, Wisch-Navigation), alle Medien direkt klickbar, Lightbox+Video sauber; **lädt poster-first ohne Lag** (Drag-FPS ≥60 + Fast-3G-Test bestanden); Budget < 25 MB/Datei.
- [ ] **Camino:** kinoreifer 7-s-Bird's-Eye, KEINE schwebenden Marker, „Google-Maps × crazy besser".
- [ ] **Boot:** echtes Schiff im Schwell vor der Sonne (Wake/Spritzer/Pitch-Roll), nie Fleck.
- [ ] **Text:** kein Kitsch, kein deutscher Leak, „City" statt „City of Agents".
- [ ] **Zoom:** linke Hälfte, sanft, scharf.
- [ ] **Performance:** ehrliche ≥60 fps überall · **Regression:** alle Welten/Veils ok, `check`+`build` grün, 0 Errors · **SEO/Katalog** voll.
- [ ] Alle Review-Kategorien (§3f) ≥ 8, keine P0/P1 offen.

---

## 13 · Konventionen & Gotchas (alle aus brain.md bewiesen)

- npm immer `$env:NODE_OPTIONS="--use-system-ca"`. Dev-Port checken (~4325). curl `--ssl-no-revoke`, uv `--native-tls`.
- **Nie per PowerShell-Replace editieren** (UTF-8-Mojibake) — nur Edit/Write.
- `global.css`: kein `:global()` (platte Selektoren); in Astro-`<style>` dagegen `:global()` korrekt.
- **gltf-transform NIE blank `optimize`** — immer `--compress meshopt --simplify false --palette false --join false --flatten false`.
- Blender headless: `& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --factory-startup --python <script>`. Vorlagen `scripts/blender/`.
- WebGPU/TSL: `Fn(([d]:any)=>…)` const als `:any`; `screenUV` oben-links; eigene `RenderPipeline` via `pass()`; CanvasTexture `flipY=false`. Reuse `painting.ts`/`ocean.ts`/`camino.ts` als Muster.
- **Headless-FPS (ANGLE) NICHT ehrlich** — nur headed auf 4060 über `/dev/*`-Overlays.
- Commit auf `main`, Author-Email `engelhardt.mattis06@gmail.com` (GCM, kein `gh`), **nach jedem Commit pushen**, Message endet `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Repo `github.com/MattisEngelhardt/Website`.
- Session-Ende: `MAINPLAN.md`+`brain.md`+`HANDOFF.md` updaten. Cloudflare-Pages-Limit < 25 MB/Datei (Videos!).

---

## 14 · Reihenfolge / Phasing (mehrere Chats, jede Phase abnahmefähig)

1. **Phase 1 — Quick Wins:** Workstream **E (Text)** + **F (Zoom)**. Klein, sichtbar, risikoarm.
2. **Phase 2 — Die Lobby (Kern):** Workstream **A**. Erst Spike `/dev/hub` (Tafeln/Pan/Hover-Lens/Dolly + FPS), dann Integration, `verify-hub`, Side-by-side Friedrich.
3. **Phase 3 — My Vacations:** Workstream **B** (Medien-Pipeline + Manifest zuerst, dann gekrümmte Drag-Leinwand + Lightbox). Referenz steht (phantom.land).
4. **Phase 4 — Camino-Rebuild:** Workstream **C** (Blender-Kamerafahrt → Scrub).
5. **Phase 5 — Das Boot:** Workstream **D**.
6. **Phase 6 — Politur & Launch-Prep:** kompletter Hard-Check §11 + strenger Review §3f, FPS dokumentieren, Sound/Reduced-Motion/OG/Sitemap-Pass, committen/pushen, Handoff.

Jede Phase: bauen → Spike/Verify → **strenger Review bis Pass** → commit/push → Handoff. (Mattis: „Tiefe zuerst", er nimmt Zwischenstände ab.)

---

## 15 · Offen an Mattis (nicht blockieren — als `TODO(Mattis)` markieren)

- ✅ **Referenz für „My Vacations" geliefert: phantom.land/work** (leicht gekrümmte Drag-Leinwand mit Hover-Previews) — als visueller Nordstern in §5 verankert. Mattis nennt gern noch 1–2 weitere Lieblings-Awwwards-Refs, falls vorhanden.
- **Jakobsweg-Fotos** (`assets/jakobsweg` ist leer) — für Camino-Endcard/Vacations, sobald geliefert.
- **LinkedIn-/Email-/CV-URLs** (Horizont-Kontakt), Projekt-/Bio-Fakten (Ship's-Log/City-Records), finale 1-Zeilen pro Welt, finaler „City"-Name.
- Domain `mattisengelhardt.com` steht; Cloudflare-Pages-Verbindung macht Mattis im Dashboard.

---

### Zentrale Dateien (Einstieg)

- **Lobby:** `src/scenes/summit.ts` · `src/worlds/summit.ts` · `src/pages/index.astro` · reuse `src/scenes/painting.ts`, `src/scenes/threshold.ts`
- **Übergänge (nicht brechen):** `src/lib/passage.ts` · `src/lib/journey.ts` · `src/lib/quality.ts` · `src/components/PathNav.astro`
- **Vacations (neu):** `src/pages/vacations.astro` · `src/worlds/vacations.ts` · `scripts/make-vacation-media.mjs`(+video) · Medien `public/assets/vacations/`
- **Camino:** `scripts/blender/camino_set.py` · `src/scenes/camino.ts` · `src/worlds/camino.ts` · `src/pages/camino.astro`
- **Sea/Boot:** `src/scenes/sea.ts` (+ `ocean.ts` unangetastet) · `scripts/blender/sea_set.py`
- **Text-Purge:** `src/pages/{index,sea,camino,horizon}.astro` · `src/pages/city/index.astro`
- **Tafeln/Assets:** `assets-src/paintings/` · `public/assets/{plates,paintings,camino}/` · `scripts/make-painting-derivatives.mjs`
- **Verify/Spike-Muster:** `scripts/verify-{hero,sea,camino}.mjs` · `src/pages/dev/ocean.astro`
