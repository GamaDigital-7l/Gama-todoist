const CACHE_NAME = 'nexus-flow-cache-v1.1'; // Versão do cache
const DATA_CACHE_NAME = 'nexus-flow-data-cache-v1.0'; // Cache para dados de API (opcional, para leituras offline)

// Arquivos essenciais para o funcionamento offline
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/globals.css',
  '/src/App.css',
  '/favicon.svg',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/shortcut-task.png',
  '/icons/shortcut-planner.png',
  '/icons/shortcut-clients.png',
  '/icons/shortcut-results.png',
  '/placeholder.svg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  '//unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs' // Certifique-se de que a versão corresponde à usada em main.tsx
];

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[Service Worker] Cacheando shell da aplicação');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Falha ao cachear:', error);
      })
  );
  self.skipWaiting(); // Força a ativação do novo Service Worker imediatamente
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Ativando Service Worker...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[Service Worker] Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Garante que o Service Worker controla todas as páginas abertas
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
  // Estratégia Cache First, then Network para assets da aplicação
  if (urlsToCache.some(url => event.request.url.includes(url.replace(/^\//, '')))) {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // Para requisições de API (Supabase), tentar Network First, com fallback para Cache
  // e Background Sync para POST/PUT/DELETE
  const supabaseUrl = 'https://qbhwjmwyrkfyxajaksfk.supabase.co'; // Hardcoded Supabase URL
  if (event.request.url.startsWith(supabaseUrl) || event.request.url.includes('/functions/v1/')) {
    if (event.request.method === 'GET') {
      event.respondWith(
        caches.open(DATA_CACHE_NAME).then(cache => {
          return fetch(event.request)
            .then(response => {
              // Cachear a resposta da rede
              cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => {
              // Se a rede falhar, tentar o cache
              return cache.match(event.request);
            });
        })
      );
    } else if (['POST', 'PUT', 'DELETE'].includes(event.request.method)) {
      event.respondWith(async function() {
        try {
          const response = await fetch(event.request.clone());
          if (response.ok) {
            return response;
          }
          // Se a rede falhar, enfileirar para Background Sync
          throw new Error('Network response not ok, queueing for background sync.');
        } catch (error) {
          console.log('[Service Worker] Requisição de API falhou, enfileirando para Background Sync:', event.request.url, error);
          await saveRequestForLater(event.request);
          // Retornar uma resposta de fallback para o cliente, indicando que a ação será sincronizada
          return new Response(JSON.stringify({ message: 'Ação será sincronizada quando a conexão for restabelecida.' }), {
            status: 202, // Accepted
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }());
    }
    return;
  }

  // Para outros recursos, usar estratégia padrão (Network First)
  event.respondWith(fetch(event.request).catch(function() {
    return caches.match(event.request);
  }));
});

// --- Background Sync ---
async function saveRequestForLater(request) {
  const requestBody = await request.clone().text();
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Array.from(request.headers.entries()),
    body: requestBody,
    timestamp: new Date().toISOString(),
  };

  let queue = await getBackgroundSyncQueue();
  queue.push(requestData);
  await setBackgroundSyncQueue(queue);

  // Registrar um sync tag para que o navegador tente sincronizar quando a conexão voltar
  await self.registration.sync.register('offline-post-sync');
}

async function getBackgroundSyncQueue() {
  return (await caches.open(DATA_CACHE_NAME)).match('/background-sync-queue')
    .then(response => response ? response.json() : [])
    .catch(() => []);
}

async function setBackgroundSyncQueue(queue) {
  const cache = await caches.open(DATA_CACHE_NAME);
  await cache.put('/background-sync-queue', new Response(JSON.stringify(queue)));
}

self.addEventListener('sync', function(event) {
  if (event.tag === 'offline-post-sync') {
    console.log('[Service Worker] Tentando sincronizar requisições pendentes...');
    event.waitUntil(syncBackgroundRequests());
  }
});

async function syncBackgroundRequests() {
  let queue = await getBackgroundSyncQueue();
  const successfulRequests = [];

  for (const requestData of queue) {
    try {
      const headers = new Headers(requestData.headers);
      const request = new Request(requestData.url, {
        method: requestData.method,
        headers: headers,
        body: requestData.body,
        credentials: 'omit', // Não enviar credenciais automaticamente
      });
      const response = await fetch(request);
      if (response.ok) {
        console.log('[Service Worker] Requisição sincronizada com sucesso:', requestData.url);
        successfulRequests.push(requestData);
      } else {
        console.error('[Service Worker] Falha ao sincronizar requisição (resposta não OK):', requestData.url, response.status);
      }
    } catch (error) {
      console.error('[Service Worker] Falha ao sincronizar requisição (erro de rede):', requestData.url, error);
    }
  }

  // Remover requisições bem-sucedidas da fila
  const newQueue = queue.filter(req => !successfulRequests.includes(req));
  await setBackgroundSyncQueue(newQueue);

  if (newQueue.length === 0) {
    console.log('[Service Worker] Todas as requisições pendentes foram sincronizadas.');
    // Enviar notificação para o usuário que tudo foi sincronizado
    self.registration.showNotification('Nexus Flow', {
      body: 'Suas ações offline foram sincronizadas com sucesso!',
      icon: '/favicon.svg',
    });
  } else {
    console.warn(`[Service Worker] ${newQueue.length} requisições ainda pendentes.`);
  }
}

// --- Notificações Push ---
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const title = data.title || 'Nexus Flow';
  const options = {
    body: data.body || 'Você tem uma nova notificação!',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    data: {
      url: data.url || '/',
      taskId: data.taskId, // Para ações rápidas
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const clickedAction = event.action;
  const notificationUrl = event.notification.data.url;
  const taskId = event.notification.data.taskId;

  // Lógica para ações rápidas
  if (clickedAction && clickedAction.startsWith('complete-task-')) {
    const taskIdFromAction = clickedAction.replace('complete-task-', '');
    // Redirecionar para a página de tarefas com um parâmetro para o frontend concluir
    event.waitUntil(
      clients.openWindow(`/tasks?complete_task_id=${taskIdFromAction}`)
    );
  } else if (clickedAction === 'view-task' && taskId) {
    event.waitUntil(
      clients.openWindow(`/tasks?view_task_id=${taskId}`)
    );
  } else if (clickedAction === 'open-kanban' && notificationUrl) {
    event.waitUntil(
      clients.openWindow(notificationUrl)
    );
  } else {
    // Comportamento padrão: abrir a URL da notificação
    event.waitUntil(
      clients.openWindow(notificationUrl)
    );
  }
});

// --- Badging (para Android) ---
self.addEventListener('push', function(event) {
  // ... (lógica de notificação push existente) ...

  // Atualizar o badge do ícone do aplicativo
  if ('setAppBadge' in navigator) {
    event.waitUntil(
      self.registration.pushManager.getSubscription()
        .then(async subscription => {
          if (subscription) {
            // Você precisaria de um endpoint no seu backend que retorna o número de tarefas pendentes/atrasadas
            // Por simplicidade, vamos usar um valor fixo ou um contador simples aqui.
            // Idealmente, o payload da notificação push conteria o número do badge.
            const badgeCount = data.badgeCount || 1; // Exemplo: 1 para cada nova notificação
            navigator.setAppBadge(badgeCount);
          }
        })
        .catch(error => console.error('Erro ao definir o badge do aplicativo:', error))
    );
  }
});

// Limpar o badge quando o usuário abre o aplicativo
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'clearBadge') {
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(0);
    }
  }
});

// --- Atualização Silenciosa do App ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Lógica para detectar nova versão e notificar o cliente
self.addEventListener('controllerchange', () => {
  console.log('[Service Worker] Novo Service Worker ativado. Notificando cliente...');
  clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'APP_UPDATE' });
    });
  });
});