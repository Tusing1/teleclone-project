import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png", "push-events.js"],
      manifest: false, // We're using our own manifest.webmanifest
      workbox: {
        importScripts: ["/push-events.js"],
        globPatterns: ["**/*.{js,mjs,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Includes the local PDF worker
        cleanupOutdatedCaches: true,
        skipWaiting: false, // Let user control when to update
        clientsClaim: true,
        // Do not cache authenticated Supabase responses across accounts.
        // Media offline copies are kept by the account-scoped private file cache.
        runtimeCaching: [],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: { output: { manualChunks(id) {
      if (!id.includes('node_modules')) return;
      if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-runtime';
      if (id.includes('@supabase')) return 'supabase';
      if (id.includes('@radix-ui')) return 'ui-primitives';
      if (id.includes('date-fns')) return 'dates';
    } } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
