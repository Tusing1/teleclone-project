// Development fallback. Production Workbox imports the same push handlers.
importScripts('/push-events.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
