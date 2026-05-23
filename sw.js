/* FinançasFácil — Service Worker
   MegaFllex Soluções © 2026
   ─────────────────────────────── */

const CACHE = 'financasfacil-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// ── INSTALL: armazena assets no cache ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpa caches antigos ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: serve do cache, atualiza em background ─────────
self.addEventListener('fetch', event => {
  // Apenas requisições GET
  if(event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Retorna do cache imediatamente se disponível
      if(cached){
        // Atualiza cache em background (stale-while-revalidate)
        fetch(event.request).then(fresh => {
          if(fresh && fresh.status === 200){
            caches.open(CACHE).then(c => c.put(event.request, fresh));
          }
        }).catch(()=>{});
        return cached;
      }

      // Sem cache: tenta rede
      return fetch(event.request).then(response => {
        if(!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline e sem cache: retorna index.html (SPA fallback)
        return caches.match('./index.html');
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (futuro) ───────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  self.registration.showNotification(data.title || 'FinançasFácil', {
    body: data.body || '',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: data.tag || 'financas'
  });
});
