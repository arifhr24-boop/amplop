const CACHE = 'amplop-cloud-v21';
const ASSETS = ['./login.html', './style.css', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const isNavigation = e.request.mode === 'navigate' || e.request.destination === 'document';
  if (isNavigation) {
    /* selalu ambil versi terbaru dulu; cache cuma jadi fallback saat offline */
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('./login.html')))
    );
    return;
  }
  /* aset pihak ketiga (cth. SheetJS, lazy-load Fitur E) sengaja TIDAK di-cache dan
     TIDAK diberi fallback './login.html' saat gagal — biar kegagalan fetch asli
     (mis. offline) tetap terlihat sebagai error oleh kode yang memanggilnya,
     bukan disamarkan jadi dokumen HTML yang salah. */
  const isSameOrigin = e.request.url.startsWith(self.location.origin);
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      if (res.ok && (isSameOrigin || e.request.url.includes('fonts.g') || e.request.url.includes('cdn.jsdelivr.net'))) {
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(err => { if (isSameOrigin) return caches.match('./login.html'); throw err; }))
  );
});
