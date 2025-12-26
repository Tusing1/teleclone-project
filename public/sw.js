// Service Worker for StudyGram PWA + Push Notifications
const CACHE_NAME = 'studygram-v1';

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

// Fetch event - pass through (let vite-plugin-pwa handle caching)
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
});

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let data = {
    title: 'StudyGram',
    body: 'You have a new update',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'notification',
    data: {}
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error('Error parsing push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'notification',
    data: data.data || {},
    vibrate: [100, 50, 100, 50, 100],
    renotify: true,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        return clients.matchAll({ type: 'window', includeUncontrolled: true });
      })
      .then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'NOTIFICATION_RECEIVED',
            payload: data
          });
        });
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let urlToOpen = '/';

  if (data.conversationId) {
    urlToOpen = `/?conversation=${data.conversationId}`;
  } else if (data.type === 'match') {
    urlToOpen = '/?openFindFriends=true';
  } else if (data.url) {
    urlToOpen = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((focusedClient) => {
              if (focusedClient) {
                focusedClient.postMessage({
                  type: 'NOTIFICATION_CLICK',
                  payload: data
                });
              }
            });
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[Service Worker] Notification closed.');
});
