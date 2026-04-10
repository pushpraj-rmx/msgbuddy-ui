self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'MsgBuddy', {
      body: data.body ?? '',
      icon: '/logo.png',
      badge: '/square.png',
      tag: data.tag,
      data: data.data ?? {},
      requireInteraction: !!(data.data && data.data.conversationId),
      actions: data.data && data.data.conversationId
        ? [{ action: 'reply', title: 'Reply', type: 'text', placeholder: 'Type a message…' }]
        : [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const notifData = event.notification.data ?? {};
  const href = notifData.href ?? '/';
  const conversationId = notifData.conversationId ?? null;

  event.notification.close();

  if (action === 'reply' && conversationId) {
    const replyText = (event.reply ?? '').trim();
    if (!replyText) return;

    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((list) => {
          // Find an open app window and delegate the send to it (it has auth)
          for (const client of list) {
            if (client.url.includes(self.location.origin) && 'postMessage' in client) {
              client.postMessage({
                type: 'NOTIFICATION_REPLY',
                conversationId,
                text: replyText,
              });
              return client.focus ? client.focus() : undefined;
            }
          }
          // No window open — fall back to opening the app at the conversation
          return clients.openWindow(href);
        })
    );
    return;
  }

  // Default: navigate to the conversation href
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
