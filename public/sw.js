// Service Worker for VTracker PWA with Web Push Notifications
const CACHE_NAME = 'vtracker-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ================= WEB PUSH NOTIFICATION HANDLER =================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'VTracker', body: event.data.text() };
    }
  }

  const title = data.title || '🎯 Valorant Shop Reset (07:00 AM)';
  const iconUrl = new URL('/icon-192.png', self.location.origin).href;

  const options = {
    body: data.body || 'Cửa hàng hôm nay đã cập nhật skin mới!',
    icon: iconUrl,
    badge: iconUrl,
    data: {
      url: data.url || '/'
    }
  };

  // Feature detection: Only add vibrate & actions if supported (avoids iOS WebKit strict rejection)
  if ('vibrate' in navigator) {
    options.vibrate = [200, 100, 200];
  }
  if ('actions' in Notification.prototype) {
    options.actions = [
      { action: 'open', title: 'Mở xem ngay' },
      { action: 'close', title: 'Đóng' }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.warn('[SW Push fallback]:', err);
      return self.registration.showNotification(title, {
        body: data.body || 'Cửa hàng hôm nay đã cập nhật skin mới!'
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
