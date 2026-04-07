self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'MsgBuddy', {
      body: data.body ?? '',
      icon: '/logo.png',
      badge: '/square.png',
      tag: data.tag,
      data: data.data ?? {},
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(href);
            return client.focus();
          }
        }
        return clients.openWindow(href);
      })
  );
});
