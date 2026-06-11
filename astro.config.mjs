// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// TODO(Mattis): final domain decision — mattisengelhardt.com recommended.
// Until then this is the canonical target; swap before launch if needed.
export default defineConfig({
  site: 'https://mattisengelhardt.com',
  integrations: [sitemap()],
  prefetch: true,
  // dev-only overlay; it 504s under vite dep re-optimization and
  // pollutes automated runtime verification — we don't use it
  devToolbar: { enabled: false },
  vite: {
    build: {
      // three/webgpu is large by nature; we lazy-load scenes, so this
      // only silences the warning for the async chunk.
      chunkSizeWarningLimit: 1200,
    },
  },
});
