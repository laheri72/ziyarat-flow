const CACHE_NAME = "ziyarat-shell-v1";

const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/robots.txt",
];

// Install: Pre-cache essential app shell assets and activate immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW install pre-cache warning:", err))
  );
});

// Activate: Take control of all clients immediately and prune older caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests and Supabase backend API calls (handled by app sync queue)
  if (request.method !== "GET" || url.hostname.includes("supabase.co")) {
    return;
  }

  // 2. Navigation requests (e.g. full page reload / route changes)
  // Network-first with instant fallback to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/index.html", responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline navigation fallback: serve cached index.html
          const cachedResponse =
            (await caches.match("/index.html")) || (await caches.match("/"));
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response("Offline - Rawdat Tahera Ziyarat", {
            headers: { "Content-Type": "text/html" },
          });
        })
    );
    return;
  }

  // 3. Static assets (JS bundles, CSS, fonts, images)
  // Stale-While-Revalidate / Cache-First with background refresh
  if (
    url.origin === self.location.origin ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Fetch fresh copy in background to update cache
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});
