self.addEventListener('push', function(event) {
  const data = event.data.json();
  const title = data.title || 'Minha Vida';
  const options = {
    body: data.body || 'Você tem uma nova notificação!',
    icon: data.icon || '/favicon.svg', // Caminho absoluto
    badge: data.badge || '/favicon.svg', // Caminho absoluto
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [], // Adicionar ações da notificação
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const clickedAction = event.action;
  const notificationUrl = event.notification.data.url;

  // Se a ação for para completar uma tarefa recorrente
  if (clickedAction && clickedAction.startsWith('complete-task-')) {
    const taskId = clickedAction.replace('complete-task-', '');
    // Chamar uma API para marcar a tarefa como concluída
    // Você precisará de um endpoint que possa ser acessado pelo Service Worker
    // Por simplicidade, vamos redirecionar para a página de tarefas com um parâmetro
    // que o frontend pode usar para concluir a tarefa.
    event.waitUntil(
      clients.openWindow(`/tasks?complete_task_id=${taskId}`)
    );
  } else {
    // Comportamento padrão: abrir a URL da notificação
    event.waitUntil(
      clients.openWindow(notificationUrl)
    );
  }
});