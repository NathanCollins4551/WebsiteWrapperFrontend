const SW_VERSION = "1.0.2";
const cacheName = "DefaultCompany-DigitalTwinWebGL-0.1.0";

// Simplified: We won't pre-cache everything to avoid stale errors during development
self.addEventListener('install', function (e) {
    console.log(`[Service Worker ${SW_VERSION}] Install triggered`);
    self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  console.log(`[Service Worker ${SW_VERSION}] Activated and claiming clients`);
  // Clean up old caches
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== cacheName) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', function (e) {
    // Only intercept requests for our own origin
    if (!e.request.url.startsWith(self.location.origin)) return;

    e.respondWith((async function () {
      let response = await caches.match(e.request);
      
      if (!response) {
        try {
          response = await fetch(e.request);
          
          // ONLY cache successful responses that are NOT HTML (unless it's the index)
          const isHtml = response.headers.get("content-type")?.includes("text/html");
          const isUnityAsset = e.request.url.includes("/unity/");
          
          if (response.ok && (isUnityAsset || !isHtml)) {
            const cache = await caches.open(cacheName);
            cache.put(e.request, response.clone());
          }
        } catch (err) {
          console.error(`[Service Worker ${SW_VERSION}] Fetch failed:`, err);
          return fetch(e.request); // Fallback to network
        }
      }

      // If the response is an error or a redirect to login, don't wrap it in security headers
      // which might mask the underlying issue.
      if (!response.ok || (response.headers.get("content-type")?.includes("text/html") && !e.request.url.endsWith(".html") && !e.request.url.includes("?t="))) {
        return response;
      }

      // EXPLICIT HEADER RECONSTRUCTION for successful assets
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
      newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
      newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    })());
});
