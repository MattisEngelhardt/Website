# DER WANDERER — Die persönliche Welt von Mattis Engelhardt

> Finaler Plan, gemeinsam entwickelt am 10.06.2026. Dieses Dokument ist das Deliverable der Planungs-Session — implementiert wird erst auf Mattis' Startsignal.

## Kontext

12 Tage freies Fable 5 (bis 22.06.2026). Ziel: eine Awwwards-Level-Website über Mattis — keine Galerie, keine Portfolio-Sektionen, sondern **eine eigene Welt**: Action, Kunst, lebendig, mit eingebauten Mini-Games. Harte Constraints: fertig bis 22.06., danach null laufende Kosten, komplett kostenlos gehostet, über Google auf seinen Namen auffindbar. Site-Inhalt Englisch, Zusammenarbeit Deutsch. Mattis liefert Inhalte und Richtung; alle UI/UX/Motion/3D/Shader-Entscheidungen liegen bei Claude als Handwerk.

**Mattis' ästhetische DNA (von ihm selbst definiert):**
1. **Künstlergemälde** — wichtigster Stil. Referenzen: Aivazovsky-Sonnenuntergang mit Schiff (sein LinkedIn-Banner; Farben: Gelb, Orange, Rot, Babyblau, Türkis) und *Der Wanderer über dem Nebelmeer* (Caspar David Friedrich) als Lieblingsgemälde aller Zeiten.
2. Pixelart / Cyberpunk-2077-Vibe, 3. Neo-Tokyo, 4. Ultra-realistisch.
- Interaktions-Referenz: landonorris.com (Helm-Morph-Hero, Maus-reaktiv).
- Biografisches Material: Student (HfWU), AI-Builder (Claude Code/Codex, Agenten, Multi-Agent-Deck-System), Startup-/Founder-Mindset, Jakobsweg mit seiner Mutter, Reisen (Montenegro, Bayern) mit starken eigenen Fotos.

## Das Konzept: Ein Wanderer zwischen Welten

Die Website ist **eine einzige Wanderung** durch Welten, jede in einem seiner Stile gemalt. Der Stilwechsel ist kein Bruch, sondern die künstlerische Aussage: *ein Wanderer zwischen Welten* — zwischen Gemälde und Code, Studium und Startup, Pilgerweg und Neo-Tokyo. Sein Lieblingsgemälde (der Wanderer), sein gelaufener Jakobsweg und seine Tagline ("Building agents until all that's left to do is what I love") sind bereits dieselbe Geschichte — die Site erzählt sie als begehbares Kunstwerk.

Navigation: primär eine scrollgetriebene Reise (GSAP ScrollTrigger + Lenis), sekundär **der Pfad** — eine persistente Pilger-Karte zum Springen zwischen Welten. Jede Welt ist zugleich eine echte Route mit echtem Textinhalt (SEO).

## Die Welten (Akte)

### Akt 0 — Der Gipfel (`/`) — der Hero
- Friedrich-Komposition in WebGL: Rückenfigur über einem **lebenden Nebelmeer** (volumetrischer/layered Fog-Shader), Himmel in Aivazovsky-Palette, **synchronisiert mit der echten Ortszeit des Besuchers** (Morgenrot bis Nachtblau).
- Maus = Wind: Nebel, Licht, Mantel reagieren. Signature-Interaktion (der "Lando-Moment"): Mausbewegung blendet die Welt zwischen **Pinselstrich-Rendering und scharfer Realität** über (Kuwahara-Painterly-Shader ↔ klares Rendering).
- Name + Tagline als Frontispiz gesetzt; voller SEO-Text im HTML. Scroll = Abstieg in den Nebel (White-out-Übergang in Akt I).

### Akt I — Das Meer (`/sea`) — wer er ist
- Aivazovsky-Welt: Sonnenuntergang, Gerstner-Wellen-Ozean mit painterly Post-Processing, ein Schiff als Träger der Bio (Student, Esslingen, BWL × AI, Stationen — Fakten kommen aus dem Content-Interview).
- Interaktion: Cursor zieht Lichtbahnen/Wellen; Kamera folgt dem Schiff beim Scrollen.

### Akt II — Die Stadt der Agenten (`/city` + `/city/<projekt>`) — was er baut
- Nebel reißt auf in eine **Neo-Tokyo-Pixelnacht**: Neon, Regen, CRT/Glitch-Effekte. Gebäude/Billboards = Projekte (Multi-Agent-Deck-System als größter Turm, VoiceForge, StudyMind, Strategy Agent). Seine Agenten laufen als Pixel-Figuren durch die Straßen.
- Jedes Projekt: eigene Route mit echter Case Study (SEO-Fleisch) + visueller Inszenierung.
- **Die Arcade-Halle** (`/city/arcade`): in die Website gecodete Automaten —
  1. **Tic-Tac-Toe vs. The Algorithm** (Minimax, unschlagbar). Wandtext: *"You can't beat it. That's why I build with them, not against them."* (Pflicht)
  2. **Swarm** — Boids-Schwarm dirigieren, der gemeinsam ein Bild malt; Agenten-Identität als Kunstmechanik. (Pflicht)
  3. **Snake** im CRT-Look. (Optional, nur bei Restzeit)
  - Highscores/Erfolge in localStorage.

### Akt III — Der Weg (`/camino`) — der Mensch
- Stilwechsel ins warme Realistische: der Jakobsweg. Ein Pfad durch Landschaft; an ihm hängen **seine echten Reisefotos** (Camino mit der Mutter, Montenegro, Bayern) als "Fenster der Realität" in der gemalten Welt — der Kontrast Foto↔Gemälde ist das Statement.
- Parallax-Wanderung, Schritt-Sound, Wegmarken als Kapitel (was der Weg über seine Arbeitsweise sagt: ein Schritt nach dem anderen).

### Akt IV — Der Horizont (`/horizon`) — Kontakt
- Über den Wolken, goldene Stunde, kein Raum, keine Wände. Kontakt, Links (GitHub, LinkedIn), CV-Download. *"The next world is unwritten."*

### Die lebendige Schicht: Der Wanderpass
- Wie Pilgerstempel auf dem Jakobsweg: Besucher sammeln **Stempel** (Welten besucht, Games gewonnen, Geheimnisse gefunden) in einem Pilgerausweis (localStorage, UI als gestempeltes Büchlein).
- Alle Stempel → eine **verborgene letzte Welt** schaltet frei (kleines persönliches Finale, z. B. Wallpaper-Pack der Welten als Download).
- Weitere Easter Eggs: Terminal-Mode (Taste `~`), Konami-Code, täglich wechselndes Detail (datums-geseedet, null Backend), Link auf den öffentlichen Source-Code.

## Art Direction

- **Farbsystem:** Sein Painting-Quintett (Sonnengelb, Orange, Zinnoberrot, Babyblau, Türkis) als globale Palette; jede Welt nutzt eine Teilmenge (Stadt: Neon-Verschiebung derselben Töne — Türkis/Magenta-Kante).
- **Typografie:** Display-Serif mit Buch-/Museumscharakter für Erzähltexte + Monospace-Akzente für die Builder-Identität (Anklang an seine LinkedIn-Tagline in Mono). Konkrete Fonts: variable Google Fonts (kostenlos, self-hosted), Auswahl an Tag 1.
- **Motion-DNA:** ein gemeinsames Easing-/Timing-Tokenset über alle Welten; Übergänge zwischen Welten sind inszenierte Set-Pieces (White-out-Nebel, Glitch-Riss, Goldblende), nie harte Cuts.
- **Sound:** pro Welt eine leise Klangfarbe (Wind/Möwen, Meer, Regen+Synth, Schritte, Stille) — Howler, opt-in Toggle, nie Autoplay.
- **Cursor:** hinterlässt feine Pinselspuren (global, dezent).

## Tech-Architektur

- **Astro 5** (statisch, Islands): jede Route liefert vollständiges semantisches HTML → SEO trotz WebGL. Schwere Szenen als lazy Islands.
- **Three.js** + custom **GLSL** (Kuwahara-Painterly-Post, layered Fog, Gerstner-Wellen, Pixelation/CRT-Post), **GSAP ScrollTrigger** + **Lenis** für die Scroll-Journey, View Transitions zwischen Routen, **Howler** für Sound. Games in Canvas/Vanilla-TS.
- **Zwei Erlebnis-Modi:** Voll (Desktop, WebGL) und **"Der Katalog"** — Mobile-/Reduced-Motion-/No-WebGL-Fassung als schön gesetzter Reisebericht/Ausstellungskatalog mit identischem Inhalt. Löst Accessibility + Mobile + SEO gleichzeitig; Games laufen auch im Katalog (sie sind Canvas, kein WebGL).
- **Performance-Budget:** LCP < 2s auf `/`, initiales JS der Einstiegsroute < 150 KB (Hero-Szene streamt nach), Assets aggressiv komprimiert (KTX2/WebP, Sprite-Atlanten), 60 fps auf Mittelklasse-Laptop, Awwwards bewertet Performance mit.
- **Repo:** neues öffentliches GitHub-Repo (Ordner `agent fable 5`), Open Source als Dev-/Career-Statement.

## Hosting, Kosten, Google

- **Cloudflare Pages** (gratis, unbegrenzter Traffic, Custom Domain gratis). Fallback: GitHub Pages.
- **Domain:** Empfehlung `mattisengelhardt.com` (~10 €/Jahr — einzige Ausgabe des Projekts, stärkstes Signal für das Ranking auf seinen Namen). Gratis-Alternative: `*.pages.dev`. Entscheidung bei Mattis; Plan funktioniert mit beidem.
- **SEO:** schema.org `Person` + `CreativeWork` JSON-LD, Sitemap, Meta/OG sauber, pro Welt ein build-time generiertes OG-Image, voller Text in jedem HTML (Katalog-Inhalt wird server-seitig gerendert, nicht nachgeladen), Google Search Console Submission am Launch-Tag. Suchziel: "Mattis Engelhardt".
- **Null laufende Kosten:** kein Backend, keine API, kein Key, kein Agent. Hinweis: Awwwards-*Einreichung* kostet eine Gebühr — optional, seine Entscheidung; die Qualitätslatte gilt unabhängig davon.

## 12-Tage-Roadmap (10.06. → 22.06.)

| Tag | Werk |
|---|---|
| 1 | Content-Interview (Bio-Fakten & was öffentlich sein darf — bewusste Kuration; berufliche Stationen klären; Fotos sichten & auswählen), Domain-Entscheidung, Art-Direction-Lock (Fonts, Paletten-Tokens, Motion-Tokens), Repo + Astro-Skeleton + Deploy-Pipeline (ab Tag 1 live auf Preview-URL) |
| 2–3 | **Akt 0 zuerst** (das Meisterstück, härteste Technik): Nebelmeer-Shader, Tageszeit-Himmel, Maus-Wind, Pinselstrich↔Real-Morph; dazu Journey-/Scroll-System & Welt-Übergangs-Framework |
| 4 | Akt I — Das Meer (Wellen, Schiff, Bio-Inszenierung) |
| 5–6 | Akt II — Stadt (Pixel-Welt, Agenten-Figuren, Projekt-Routen mit Case-Study-Texten) |
| 7–8 | Arcade: Tic-Tac-Toe-Minimax + Swarm, poliert; Snake nur bei Restzeit |
| 9 | Akt III — Der Weg (Foto-Treatment, Parallax-Wanderung) |
| 10 | Akt IV — Horizont + Wanderpass/Stempel + verborgene Welt + Terminal/Easter Eggs |
| 11 | Polish: Motion-Feinschliff, Sound, Performance-Budget, Katalog-Modus, Mobile, Cross-Browser, Reduced-Motion |
| 12 | Launch: OG-Images, Sitemap, Search Console, finaler Deploy, README, optional Awwwards-Submission |

**Scope-Ventile** (Streichreihenfolge bei Zeitnot): Snake → tägliches Detail → Akt-III-Set-Piece vereinfachen (statisches Parallax) → Sound → Pinselstrich↔Real-Morph wird einfacher Shader-Crossfade.

## Was Mattis liefert (Tag 1)

1. Reisefotos (Camino, Montenegro, Bayern) — seine "peak Bilder"
2. Projekt-Fakten: Multi-Agent-Deck-System, VoiceForge, StudyMind, Strategy Agent (was, wie, Ergebnis; Screenshots falls vorhanden)
3. Bio-Eckpunkte, die öffentlich sein dürfen + berufliche Stationen + Ton
4. Links (GitHub, LinkedIn), CV ja/nein, Foto/Silhouette für die Rückenfigur ja/nein
5. Domain-Entscheidung

## Verifikation

- Lighthouse ≥ 90 (Performance/SEO/A11y) je Route auf der deployten Preview
- `curl` auf jede Route zeigt vollen Textinhalt ohne JS (SEO-Beweis)
- Games auf Desktop + Touch durchgespielt; Wanderpass-Stempel persistieren; verborgene Welt schaltet korrekt frei
- Katalog-Modus mit deaktiviertem WebGL/JS und mit `prefers-reduced-motion` geprüft
- Rich-Results-Test für Person-Schema grün; Search-Console-Submission erfolgt
- Realer Check auf Mittelklasse-Smartphone: flüssig, lesbar, schön




Notizen von Mattis:
- ich muss dir noch bilder und videos von mir bereitstellen die wir in der website verorten (und die videos auch teilweise extrem gut für motion übergänge etc nutzen könnten)
- außerdem: ki videos durch nano banana oder image gen 2 von open ai machen für 3d videos (awwwards websites haben dass wenn man runterscroll, motion passiert)
- du musst wirklich top notch state of the art style, übergänge, implementierungen, design bei der website haben (recherchiere was top notch awwwards websites anders machen)
- wichtig ist, dass du nicht winfach andere awwwards kopierst sondern komplett meinen style mitreinbringst und das auf absolutem extrem top notch class niveau umsetzt. es soll die krasseste und schönste und künstlerischste und lebensigste website off all time werden (keinlagging natürlich)
- und alles so einsetzen dass es sinn macht (jetzt nicht einfach nur effekte und dergleichen spamen, sondern elegant einsetzen)
- recherchiere nach wie wir am besten videos und bilder in die website implementieren sollten (ob echte 4k videos mehr passen als high class ki videos für übergänge)
- und schaue nach welche tools state of the art sind (juni 2026)
- alle technischen sachen sollen sich auf state of the art (juni 2026 beziehen)