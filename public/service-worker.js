self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nova Notificação';
  const options = {
    body: data.body || 'Você tem uma nova notificação.',
    icon: data.icon || '/favicon.ico', // Ícone padrão
    badge: data.badge || '/favicon.ico', // Badge para Android
    data: {
      url: data.url || self.location.origin // URL para abrir ao clicar na notificação
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});