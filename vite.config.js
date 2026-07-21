import { defineConfig } from 'vite';

export default defineConfig({
  // Public directory with static assets (frames go here)
  publicDir: 'public',

  build: {
    // Output directory for Vercel to serve
    outDir: 'dist',
    // Inline assets smaller than 4kb; keep images as separate files
    assetsInlineLimit: 0,
    rollupOptions: {
      input: 'index.html',
    },
  },

  server: {
    // Open browser on dev start
    open: true,
  },
});
