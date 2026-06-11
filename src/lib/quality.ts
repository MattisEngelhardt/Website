/**
 * Experience gate — decides between the full WebGPU/WebGL journey and
 * "The Catalogue" (the beautifully typeset, fully static fallback).
 *
 * The catalogue is not a degraded site: every route ships complete
 * semantic HTML regardless. This gate only decides whether to stream
 * in the living layer on top.
 */

export type ExperienceMode = 'full' | 'catalog';

export function experienceMode(): ExperienceMode {
  if (typeof window === 'undefined') return 'catalog';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'catalog';
  }

  // respect metered connections
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return 'catalog';

  // WebGPU (baseline 2026) or WebGL2 — three's WebGPURenderer falls
  // back to WebGL2 on its own, so either is enough.
  if ('gpu' in navigator) return 'full';

  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  if (gl) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return 'full';
  }

  return 'catalog';
}

/** Marks the document so CSS can style both modes deliberately. */
export function applyModeClass(mode: ExperienceMode): void {
  document.documentElement.dataset.mode = mode;
}
