// Service Worker for Push Notifications

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let data = {
    title: 'New Notification',
    body: 'You have a new update',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
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
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'notification',
    data: data.data || {},
    vibrate: [100, 50, 100, 50, 100],
    renotify: true,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        // Notify all clients to play notification sound
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

  // Navigate based on notification type
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
        // If a window is already open, focus it and navigate
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
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[Service Worker] Notification closed.');
});
