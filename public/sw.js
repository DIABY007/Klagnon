const CACHE_NAME = "klagnon-v1";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/dashboard",
  "/offline",
  "/manifest.json",
];

// Install : mettre en cache les assets statiques
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).then(() => self.skipWaiting());
    }).catch(() => self.skipWaiting())
  );
});

// Activate : nettoyer les anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch : Network first, cache fallback
self.addEventListener("fetch", (event) => {
  // Ignorer les requetes non GET
  if (event.request.method !== "GET") return;

  // Pour les pages HTML : Network First
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Pour les autres ressources : Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      });
    }).catch(() => caches.match("/"))
  );
});