/**
 * The journey system — one shared scroll spine for every world.
 *
 * Lenis carries the momentum (the walking rhythm), GSAP ScrollTrigger
 * reads positions from it. Canonical sync pattern: Lenis rides GSAP's
 * ticker so both always agree on the same frame.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export function initJourney(): Lenis {
  if (lenis) return lenis;

  lenis = new Lenis({
    // a walker's pace: unhurried, weighty, never floaty
    duration: 1.15,
    easing: (t) => 1 - Math.pow(1 - t, 4),
    // in-page anchors (the "descend" link) ride the same momentum
    anchors: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

export function getLenis(): Lenis | null {
  return lenis;
}

export { gsap, ScrollTrigger };
