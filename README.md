# Der Wanderer

**The personal world of [Mattis Engelhardt](https://mattisengelhardt.com) — a walkable artwork in five acts.**

Not a portfolio. A single journey through worlds, each painted in a style he loves: a sea of fog under an Aivazovsky sky, a neon pixel city full of working agents, a pilgrim path hung with real photographs, a horizon above the clouds.

Built in 12 days, in the open, together with Claude (Fable 5).

## The worlds

| Act | Route | World |
|---|---|---|
| 0 | `/` | The Summit — a living sea of fog, synced to your local time |
| I | `/sea` | The Sea — who he is |
| II | `/city` | The City of Agents — what he builds (incl. a real arcade) |
| III | `/camino` | The Way — the human |
| IV | `/horizon` | The Horizon — contact |

## Stack

- [Astro 6](https://astro.build) — static, islands, full HTML on every route
- [Three.js](https://threejs.org) WebGPURenderer + TSL — one shader codebase, WebGPU with automatic WebGL2 fallback
- [GSAP ScrollTrigger](https://gsap.com) + [Lenis](https://lenis.darkroom.engineering) — the scroll journey
- Zero backend, zero API keys, zero running costs

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # static production build → dist/
npm run check    # typecheck
```

Tip: append `?hour=19.5` to the URL to preview any time of day in the hero sky.

## Principles

- Full semantic HTML first; the living layer streams in on top
- One palette (his painting quintet) bent through every world
- Restraint over spectacle — every effect carries the story
- Performance is part of the art: tiny initial JS, scenes lazy-load
