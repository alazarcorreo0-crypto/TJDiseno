/* Service Worker - T&J Cotizador v5 */
const CACHE_NAME = "tj-cotizador-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.png",
  "./fondo.jpg"
];

/* Escucha mensajes del cliente (para skipWaiting inmediato) */
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

self.addEventListener("install", e => {
  // Activar inmediatamente sin esperar
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* Estrategia:
   - Google Sheets / CORS proxy → network-first
   - HTML → network-first (¡clave para que se actualice!)
   - Otros assets → cache-first con revalidación
*/
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // API externa
  if (req.url.includes("docs.google.com") || req.url.includes("corsproxy.io")){
    e.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // HTML: SIEMPRE intenta red primero
  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html") || req.url.endsWith("/")){
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Assets: cache-first con revalidación en background
  e.respondWith(
    caches.match(req).then(cached => {
      const red = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic"){
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || red;
    })
  );
});