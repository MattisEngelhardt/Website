# REDESIGN-LOBBY.md — taking the Main-Lobby from "cheap" to Awwwards SOTD

> Strict Awwwards-juror + art-director verdict on the rejected Main-Lobby, and a concrete, buildable redesign aligned to the doctrine (real Blender production geometry + baked light; Kuwahara is the painterly FINISH on real depth, never the content). Scope: Workstream A only. Reference north-star: `assets-src/paintings/Caspar_David_Friedrich_-_Wanderer_above_the_Sea_of_Fog.jpeg`.

---

## 1 · BRUTAL CRITIQUE

Scored against the Friedrich reference and the four screenshots (`verify-out/hub-center.png`, `hub-pan-left.png`, `shot-day.png`, `shot-dusk.png`). Pass-bar is ≥ 8. This lobby fails the gate hard.

| Category | Score | Verdict |
|---|---|---|
| Design / Aesthetics | **3 / 10** | A flat orange-to-grey gradient with four hard-gold-framed photos floating in a row. Reads as "PowerPoint of screenshots." No depth, no light, no atmosphere doing work. |
| "In-the-painting" immersion | **2 / 10** | You are NOT inside anything. You float above a featureless grey cotton-wool band and stare at a wall of pictures. Zero parallax read, zero volume, zero awe. |
| The 4 "blocks" presentation | **2 / 10** | Four identical webp rectangles in identical thin gold frames at one shared depth. This is the single cheapest element. It's a gallery wall, not "paintings living inside a painting." |
| Content / meaning | **4 / 10** | Tiny unreadable placards bottom-left, disconnected from their frames. The frames carry literal screenshots of the other scenes — derivative, not curated. |
| Mattis-DNA-fit / Friedrich | **3 / 10** | The palette is a sunset poster, not Friedrich's luminous blue-grey sea of fog. The wanderer is a black sticker, not a figure. The crag is a tiny dark lump, not a foreground that runs off the bottom of the frame. |

### WHY it reads as cheap — specifically, screenshot vs. painting

1. **The fog is a thin, featureless white band, not a sea.** In the Friedrich, the fog is the BRIGHTEST, most dramatic mass in the frame: it billows, it has crests and valleys, dark crags pierce it, distant ridges float on it, it recedes through aerial perspective into a luminous grey infinity. In the screenshots it's a low, flat, smooth strip of cotton wool with no volume and no silhouette. The raymarch that's wired in `hub.ts` is either not firing or washed out — the `?fsky` cheap path / thin coverage (`fcut 0.33`, `fden 2.3`) reads as haze, not a billowing bank. At ~17 fps the cost is being paid with NONE of the payoff.

2. **Flat photos in hard gold frames = the "PowerPoint of screenshots" problem.** Four `*.webp` plates (`/assets/plates/sea|city|camino|horizon.webp`) on identical `PlaneGeometry`, all at roughly the same depth band (z −17 to −29), all the same size, all in the same gold molding. There is no compositional hierarchy, no "the gaze discovers them," no sense that one is near and one is far across the fog. The gold frame's TSL "bevel" (`hub.ts` ~456–463) is a flat gradient fake — it has no real carved molding profile, so under the Kuwahara pass it smears to a plastic yellow border, not gilt wood.

3. **The sky is a poster gradient, not Aivazovsky/Friedrich light.** `shot-day`/`shot-dusk` are a uniform orange wash with a hard sun disc. No atmospheric scattering into the fog, no warm-low/cool-up tension (the doctrine's core Friedrich+Aivazovsky move). The fog should be lit BY this sky and glow from within; instead sky and fog are two disconnected layers.

4. **The wanderer is a 2-D black sticker.** `drawWanderer(false)` canvas alpha on a plane, lower-right, with a hard edge and no integration into the rock or the light. Mattis explicitly said **remove the wandering figure** — and he's right: it's the most "basic-coded" element in the frame and it competes with the "you ARE the wanderer" idea. It must go.

5. **The foreground rock is a tiny dark lump, not a repoussoir.** In the painting the rock FILLS the bottom third and runs off the bottom edge — it's the ground you stand on. Here it's a small chip in the lower-right corner (`TERRAIN_SCALE 0.62`, only the `Outcrop` mesh, pushed to the side). There is no foreground anchor, so the eye has nothing to stand on and the whole frame floats.

6. **The Kuwahara finish has nothing real to paint.** The painterly pass is designed to rebuild real depth into brushwork. Over flat planes + a flat gradient it just softens an already-flat image — so it reads as a slightly blurry slideshow, not an oil painting. Garbage in, garbage out: the pass is fine, the geometry under it is the problem.

7. **Performance is unacceptable and unearned.** ~17 fps for a flat slideshow is the worst possible trade. The raymarch is eating the budget (`FSTEPS 18`, `FMARCH 165`, full-res under Kuwahara `KUWAHARA_RADIUS 3`) while delivering thin haze. Target is **60 fps on an RTX 4060 laptop WITH Kuwahara on top.**

**Bottom line:** the lobby is a flat gallery wall under a sunset poster with a sticker man. The redesign must make the FOG the hero, give the blocks real carved dimensional presence at staged depths, replace the figure with a first-person "you stepped through and now stand on the rock" framing, and pay the GPU budget only where it buys awe.

---

## 2 · THE REDESIGN BLUEPRINT

Doctrine first: **real Blender production geometry + baked light is the content; Kuwahara is the finish on real depth.** Every element below is real geometry or real baked data, not shader-painting.

### a. ATMOSPHERE / FOG — make it Friedrich's luminous, billowing sea, cheaply

The fog is the hero and was the weakest point. It must read as a deep, billowing, sun-lit bank with crests, valleys, and dark crags piercing it, receding through aerial perspective — and run at 60 fps under Kuwahara.

**Three options, ranked:**

- **Option A — Real Blender-modeled fog-bank geometry with a baked luminance gradient (CHOSEN).**
  Model the sea of fog as actual undulating **billow geometry** in Blender (a displaced surface: big rolling swell + 2-octave puff noise on top, crests heaving up, valleys sinking), the same deterministic-fBm approach already proven in `summit_set.py`. Bake a **vertical + sun-ward luminance gradient into vertex colors** (bright crests catching the low sun, dark shadowed valleys, cool blue-grey body) plus baked AO so billows self-shadow. On the web it renders **unlit, vertex-color only** (cheapest possible material) — the painterly pass finishes it. Layer 3–4 such banks at increasing depth with aerial-perspective haze-to-sky (`mix(col, sky, smoothstep(near,far,dist))`) so the bank recedes to a luminous infinity. **Cost:** a few thousand unlit vertex-colored tris — trivial, leaves the whole frame budget for Kuwahara. **Quality:** highest — real silhouette, real volume, real baked light, doctrine-pure. This is the City/Summit recipe applied to fog.

- **Option B — Cheaper analytic raymarch (the current approach, fixed).** Keep the raymarch but (1) gate hard (skip the upper ~half of the frame, already wired via `FGATE`), (2) drop to ~10–12 steps with cone-stepping, (3) run it at **half-resolution into an offscreen target** and upsample under Kuwahara (the painterly blur hides the low res entirely), (4) push coverage and density way up so it reads as a dense bank, not haze. Cheaper to author (no Blender export) but still fragment-heavy and never as crisp in silhouette as real geometry. Fallback only.

- **Option C — Layered painterly depth-cards done RIGHT.** Not the current thin wisps — instead 5–7 **Blender-rendered bank silhouettes** (real billowing geometry rendered to RGBA strips with baked light), composited as parallaxing cards at staged depths with proper aerial fade. Near-free to render. Reads beautifully head-on but breaks under the lobby's left↔right pan (cards are 2-D). Good for a static hero, wrong for a pannable lobby.

**DECISION: Option A.** Real fog-bank geometry, baked luminance + AO into vertex color, unlit on the web, finished by Kuwahara, with a thin analytic **near-wisp** layer (1–2 of the existing `addFogLayer` planes, kept) drifting close past the camera for life. This kills the 17 fps problem (geometry is ~free vs. the raymarch) AND gives a real billowing silhouette the current version can never produce. The TSL raymarch in `hub.ts` is removed.

### b. THE 4 "BLOCKS" — real carved canvases, staged in depth, "a painting inside a painting"

Kill the four-identical-photos-in-a-row layout. Each block becomes a **real framed canvas built in Blender** with a **carved gold molding profile** (an actual extruded/beveled molding cross-section sweep — ogee + cove + bead, the real museum-frame silhouette), with **baked gilt light + AO in the gold leaf** so it catches the low sun on its top-left and falls to shadow lower-right. Exported as GLB, instanced per block, swapping only the artwork texture. The frame + art are repainted by Kuwahara → genuinely a painting inside a painting.

**Composition (staged depth, gaze-revealed — NOT a row):**

- Four canvases hung at **four distinct depths and heights**, spread across the pannable azimuth arc so panning DISCOVERS them rather than showing all four at once. Suggested staging (refine in spike): one near and large and low-left (the first thing you meet), one mid-depth high-center, one further and smaller right, one deep and small far-right catching the most sun-haze. Aerial perspective fades the deeper frames toward the fog (lower contrast, cooler, softer) so depth reads honestly.
- **Plinth/ledge anchoring (the anti-float move).** Mattis HATES cheap floating. Two acceptable presentations, mix them:
  1. **Rock-ledge plinths emerging from the fog** — the nearest 1–2 canvases rest on / lean against small **Blender outcrop ledges** that rise out of the bank, so they're grounded in the world, not hovering. Built from the same `summit_set.py` crag vocabulary.
  2. **Edel float for the deep ones** — the far canvases may hang, but only "über nice": a real soft drop-shadow cast onto the fog beneath them (a baked contact-shadow card), a heavier carved frame so they have visible weight, and near-zero bob. No HUD bob, no jitter, no game markers.
- **Artwork, not screenshots.** Replace raw scene `*.webp` stills with **curated, painterly-treated key stills** of each world (the best frame, color-graded to the Friedrich/Aivazovsky palette so all four belong to ONE painted world). Sea = the Aivazovsky-grade backlit ship; City = one strong dusk silhouette; Camino = a topography crest; Horizon = the golden cloud sea. Each runs through `make-painting-derivatives.mjs`.
- **Readability.** Title + one honest line (Workstream E copy) on a **museum placard that is part of the frame group** (anchored to the molding, not floating bottom-left detached), billboard-yaw'd to stay readable on pan, with a legibility shadow. Hover lifts the reality lens exactly over that canvas (already wired via `uPointerUv`/`uReality` — keep).

### c. COMPOSITION WITHOUT THE FIGURE — you ARE the wanderer

Remove `drawWanderer` and the figure mesh entirely. The anchor becomes **the rock you stand on**, first-person:

- **The foreground outcrop fills the bottom third and runs off the bottom edge of the frame**, exactly as in the painting — but now it's YOUR vantage, seen from a first-person eye just above it. Scale the `Outcrop` mesh UP (from `0.62`) and bring it forward + centered-low so its dark hewn lip occupies the lower foreground as a repoussoir. This is the single move that says "you stepped THROUGH the painting and now stand inside it."
- The eye sits **just above the billowing top of the fog**, looking down-and-across it (slight negative pitch). The crests heave below you; the bright bank rises toward the distant low sun; dark crags and far ridges float on the fog mid-distance. Mouse = wind + a bounded left↔right gaze pan (keep the yaw-clamp), so you survey the bank from your perch.
- A whisper of near wind-wisp drifts across the lower frame (close, fast parallax) so the fog visibly moves PAST you — reinforcing "you are down in it," not looking at a postcard.

### d. THE "IN-THE-PAINTING" FEELING — concrete moves

- **Parallax that proves depth.** Foreground rock (huge, near) → near wind-wisps → staged canvases at 4 depths → fog banks at 3–4 depths → far ridges → luminous sky. On pan/wind, each layer shifts at its own rate. The current version has none of this because everything is at one depth.
- **The Kuwahara reality-lens as the signature.** Keep `createPainting(..., {lens:true})`. Resting → the whole frame is brushwork (an oil painting you're standing in). Move the mouse / hover a canvas → reality wipes sharp right there, then settles back to paint. This is the one interaction that sells "a living painting." Keep `uReality` rise/settle tuning.
- **Light tension.** Warm low sun from one side scattering INTO the fog (baked into the bank's sun-ward gradient); cool luminous blue-grey ambient giving the fog its inner glow (the Friedrich signature). Sky and fog must share light — the fog is lit by the sky, the brightest mass in the frame. Tie both to the day-cycle palette (`lerpPalette`/`DAY_CYCLE`), keep the slow time-of-day sync.
- **Grain + frame vignette.** Keep the paper-tooth grain and soft vignette from `painting.ts` — they frame the plate as a painted object. Consider a subtle inner **painted border / deckle** at the very edge so the whole lobby reads as one large canvas (a painting whose subject contains more paintings).
- **Camera life.** Very slow breathing drift + the wind-coupled pan. No bob on the canvases beyond a near-imperceptible settle. Stillness must feel like a held oil painting, motion like wind moving through it.

### e. REAL BLENDER ASSETS TO BUILD

Pattern: deterministic-fBm geometry + Cycles AO bake → vertex color, unlit on web, headless via `blender.exe --background --factory-startup --python`, export GLB with **locked gltf-transform flags** (`--compress meshopt --simplify false --palette false --join false --flatten false`). Follow `scripts/blender/{summit_set,city_set,sea_set,camino_set}.py`.

1. **`scripts/blender/fog_set.py` → `assets-src/lobby/fog.glb`** *(the hero)*
   - **Geometry:** 3–4 nested billowing bank surfaces (big swell + 2-octave puff displacement; crests heave up, valleys sink), each a separate mesh at increasing depth/scale so they parallax. Reuse the `vnoise`/`fbm` helpers verbatim from `summit_set.py`.
   - **Bake:** vertical + sun-ward **luminance gradient** into vertex color (bright sun-lit crests → cool blue-grey body → dark valleys) + Cycles **AO** so billows self-shadow. Bake at golden-hour-neutral; the web re-tints per day-cycle via a uniform multiply.
   - **Poly budget:** ~8–20k tris total (unlit vertex-color is cheap; favor smooth silhouette over micro-detail since Kuwahara blurs fine detail).
   - **Export:** `assets-src/lobby/fog.glb` → `public/assets/lobby/fog.glb`.

2. **`scripts/blender/frame_set.py` → `assets-src/lobby/frame.glb`** *(the carved gold molding — reused for all 4 blocks)*
   - **Geometry:** one museum frame built by **sweeping a real molding cross-section** (ogee + cove + bead) around a rectangular path → genuine carved 3-D molding with depth and chamfers (NOT the flat TSL gradient fake). Plus a recessed inner rabbet the artwork plane sits in, and a flat back. Parameterize the opening to the 3:2 ratio; the web instances it and scales per block.
   - **Bake:** gilt **directional light + AO** into vertex color so the molding catches the low sun top-left and falls to shadow lower-right, with darkened recesses. A warm gold base tone.
   - **Poly budget:** ~3–8k tris (sweep with modest segments; the bevels read, Kuwahara softens the rest). One asset, instanced 4×.
   - **Export:** `assets-src/lobby/frame.glb` → `public/assets/lobby/frame.glb`. Artwork texture supplied per-block at runtime.

3. **`scripts/blender/plinth_set.py` → `assets-src/lobby/plinths.glb`** *(rock ledges that ground the near canvases + the enlarged foreground outcrop)*
   - **Geometry:** 2–3 small hewn outcrop ledges (same crag vocabulary as `summit_set.py build_crags`) that rise out of the fog for the nearest canvases to rest on/lean against; PLUS a re-tuned large foreground `Outcrop` variant sized to fill the bottom third and run off the frame (first-person vantage). Can be added to `summit_set.py` as new meshes or a sibling script — keep it one export if convenient.
   - **Bake:** AO → vertex color, floor ~0.22, like the existing outcrop. Dark Friedrich stone.
   - **Poly budget:** ~5–10k tris.
   - **Export:** `assets-src/lobby/plinths.glb` → `public/assets/lobby/plinths.glb` (or fold the big outcrop into the existing `summit.glb` re-export).

4. **Artwork stills (pipeline, not Blender)** — curate one strong key still per world, color-grade to the unified Friedrich/Aivazovsky palette, run through `scripts/make-painting-derivatives.mjs` → `public/assets/plates/{sea,city,camino,horizon}.webp` (1600w). These are the canvases inside the frames.

**Web wiring (`src/scenes/hub.ts` rewrite):** load `fog.glb` (replaces the TSL raymarch + most `addFogLayer` planes; keep 1–2 near wisps), instance `frame.glb` ×4 with per-block artwork, place `plinths.glb` + enlarged foreground outcrop, **remove the wanderer figure + texture entirely**, keep `createPainting({lens:true})`, keep pan/yaw-clamp/wind/hover-raycast/dolly-through-frame/placard-projection. Sky stays a day-cycle gradient dome (cheap), now feeding light into the baked fog tint.

---

## 3 · PRIORITIZED BUILD ORDER

**P0 — Blockers (the lobby is not viewable until these land):**
1. `fog_set.py` → real billowing fog-bank GLB with baked luminance + AO. Wire into `hub.ts`, **delete the TSL raymarch**. This alone fixes both the "thin featureless fog" and the 17 fps problems. Side-by-side vs. Friedrich; honest FPS on the 4060 (target 60 with Kuwahara on).
2. **Remove the wanderer figure** (mesh, `drawWanderer` import, figure texture) and **enlarge + re-center the foreground outcrop** to fill the bottom third / run off the frame (first-person "you are the wanderer" vantage).
3. Re-grade the **sky → fog light tension** (warm-low / cool-up), tie to `lerpPalette`. Confirm the fog is the brightest, most luminous mass in the frame.

**P1 — Awwwards bar (without these it's "fixed" but not SOTD):**
4. `frame_set.py` → carved gold molding GLB; replace the four flat planes + TSL-fake-bevel with 4 instances at **staged depths/heights** across the pan arc (kill the row). Aerial-perspective fade on the deep frames.
5. `plinth_set.py` → rock ledges grounding the near canvases (anti-float); edel soft contact-shadow for the deep floaters.
6. Curate + painterly-grade the **4 artwork stills** to one unified palette via `make-painting-derivatives.mjs` (replace raw screenshots). Placards anchored to the frame group, billboard-readable.

**P2 — Polish that wins the vote:**
7. Parallax pass: verify 6+ depth layers shift at distinct rates on pan/wind; tune near-wisp drift so fog visibly passes the viewer.
8. Painted deckle/inner-border so the whole lobby reads as one canvas; vignette + grain final tune.
9. Reality-lens timing polish (rise on hover, settle on rest); dolly-through-frame easing into `passage.ts` nav.
10. `verify-hub.mjs` regression (threshold → lobby lives + pans → hover clears canvas + placard → click dollies through → world; return surfaces in the fog) + catalog/reduced-motion fallback + honest 4060 FPS logged ≥ 60.

**Definition of done (Awwwards gate, §3f / §12):** all five critique categories ≥ 8, side-by-side against the Friedrich holds up ("I am INSIDE this"), honest ≥ 60 fps on the 4060 with Kuwahara on, 0 console errors, `check` + `build` green, catalog/SEO intact, no P0/P1 open.
