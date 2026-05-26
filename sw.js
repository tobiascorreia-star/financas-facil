// FinançasFácil — Service Worker v2.0 (Web Push + Offline)
const CACHE_NAME = 'financas-facil-v2';
const STATIC = ['./','./index.html','./manifest.json','./icon.svg'];

// ── INSTALAÇÃO ────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// ── ATIVAÇÃO ──────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH (cache-first para assets estáticos) ─────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return; // não cacheia API
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── WEB PUSH — recebe notificação mesmo com app fechado ───
self.addEventListener('push', e => {
  if (!e.data) return;

  let data = {};
  try { data = e.data.json(); } catch { data = { title: e.data.text() }; }

  const title   = data.title   || 'FinançasFácil';
  const body    = data.body    || '';
  const tag     = data.tag     || 'financas-push';
  const icon    = data.icon    || './icon.svg';
  const badge   = data.badge   || './icon.svg';
  const url     = data.url     || './';
  const actions = data.actions || [];

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon,
      badge,
      data: { url },
      actions,
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200],
    })
  );
});

// ── CLIQUE NA NOTIFICAÇÃO ─────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      // Se o app já está aberto, foca nele
      const win = wins.find(w => w.url.includes(self.location.origin));
      if (win) return win.focus();
      // Senão abre uma nova aba
      return clients.openWindow(url);
    })
  );
});

// ── PUSH SUBSCRIPTION CHANGE (renovação automática) ───────
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: e.oldSubscription.options.applicationServerKey
    }).then(sub => {
      // Notifica o app para salvar nova subscription
      return self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SUBSCRIPTION_RENEWED', subscription: sub.toJSON() }));
      });
    })
  );
});
