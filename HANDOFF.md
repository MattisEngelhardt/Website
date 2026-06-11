# Handoff an die nächste Session

> Diesen Prompt (ab der nächsten Zeile) in die neue Session kopieren.
> Konvention: wird am Ende jeder großen Session aktualisiert.

---

@PLAN.md @brain.md

Du übernimmst „Der Wanderer" — die Awwwards-Level-Website über Mattis Engelhardt, eine begehbare Kunst-Reise in 5 Akten. PLAN.md = Konzept + 12-Tage-Roadmap (Deadline 22.06.2026), brain.md = exakter Stand, alle Tech-Entscheidungen und Umgebungs-Gotchas. Beides zuerst lesen, brain.md ist die Wahrheit.

**Stand (11.06., Tag 2):** Das Akt-0-Meisterstück steht und ist im Browser verifiziert (echtes WebGPU, 0 Errors): Kuwahara-Painterly-Welt mit Maus-„Realitätslinse" (der Lando-Moment), prozedural gemalte Wanderer-Rückenfigur im goldenen Schnitt, White-out-Descent der nahtlos in eine Buchseiten-Sektion auflöst, Scroll-Reveals, Katalog-Modus-Gate verifiziert. Check + Build grün, zwei Commits auf `main`. Mattis' Inspirations-Referenzen (phantom.land, landonorris, pacomepertant, juliencalot → Signatur-Loader-Idee) und das Asset-Inventar (`/assets` — Achtung: Jakobsweg-Ordner LEER) sind in brain.md gespeichert.

**Dein erster Schritt:** `npm run dev` (Hintergrund) + `node scripts/verify-hero.mjs` (etablierte Runtime-Verifikation, Screenshots in `verify-out/` mit Read ansehen) — bestätigt dir in 2 Minuten, dass alles läuft. Dev-Tools: `?hour=19.5` (Tageszeit), `?lens` (Linsen-Maske).

**Dann laut Roadmap:** View-Transitions/Welt-Übergangs-Framework (Rest von Tag 2–3; ClientRouter ändert Script-Lifecycle — danach alles re-verifizieren!), dann Tag 4: **Akt I — Das Meer** (Gerstner-Wellen, Schiff, Bio-Inszenierung; die Aivazovsky-Palette existiert schon als GOLDEN/DUSK in summit.ts).

**Nicht vergessen:** npm nur mit `$env:NODE_OPTIONS="--use-system-ca"`. Neue Findings sofort in brain.md (TSL-Findings-Sektion existiert). Am Session-Ende dieses HANDOFF.md neu schreiben.

**Von Mattis ggf. einsammeln (blockiert Teile von Tag 4–9):** Jakobsweg-Fotos (Ordner leer!), Projekt-Fakten, Bio, Links, Domain-Entscheidung, `gh auth login`, FPS-Eindruck auf seinem Gerät (Kuwahara-Kosten), optional echte Unterschrift für den Signatur-Loader — Liste in brain.md unter „Offene Inputs".
