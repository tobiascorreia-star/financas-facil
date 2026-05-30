// FinançasFácil — Service Worker v5.0
// ESTRATÉGIA: Network-first para HTML (sempre versão mais recente)
//             Cache-first para assets estáticos (ícones, manifest)
const CACHE_NAME = 'financas-facil-v5';
const STATIC_ASSETS = ['./manifest.json', './icon.svg'];

// ── INSTALAÇÃO ────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ATIVAÇÃO — limpa caches antigos E força reload das abas ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Removendo cache antigo:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'SW_UPDATED' });
            });
          });
      })
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  if (url.includes('supabase.co')) return;

  if (e.request.destination === 'document' ||
      url.endsWith('/') ||
      url.endsWith('/index.html') ||
      url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request)
            .then(cached => cached || caches.match('./'));
        })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return response;
        });
      })
  );
});

// ── MENSAGEM DO APP ───────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── WEB PUSH ──────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || 'FinançasFácil', {
      body:               data.body    || '',
      tag:                data.tag     || 'financas-push',
      icon:               data.icon    || './icon.svg',
      badge:              data.badge   || './icon.svg',
      data:               { url: data.url || './' },
      actions:            data.actions || [],
      requireInteraction: data.requireInteraction || false,
      vibrate:            [200, 100, 200],
    })
  );
});

// ── CLIQUE NA NOTIFICAÇÃO ─────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const win = wins.find(w => w.url.includes(self.location.origin));
      if (win) return win.focus();
      return clients.openWindow(url);
    })
  );
});

// ── PUSH SUBSCRIPTION CHANGE ──────────────────────────────
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: e.oldSubscription.options.applicationServerKey
    }).then(sub => {
      return self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({
          type: 'SUBSCRIPTION_RENEWED',
          subscription: sub.toJSON()
        }));
      });
    })
  );
});
