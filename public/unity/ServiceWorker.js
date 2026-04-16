const cacheName = "DefaultCompany-DigitalTwinWebGL-0.1.0";
const contentToCache = [
    "Build/Temp.loader.js",
    "Build/Temp.framework.js.unityweb",
    "Build/Temp.data.unityweb",
    "Build/Temp.wasm.unityweb",
    "TemplateData/style.css"
];

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log('[Service Worker] Caching all: app shell and content');
      await cache.addAll(contentToCache);
    })());
});

self.addEventListener('fetch', function (e) {
    e.respondWith((async function () {
      let response = await caches.match(e.request);
      console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
      
      if (!response) {
        response = await fetch(e.request);
        const cache = await caches.open(cacheName);
        console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
        cache.put(e.request, response.clone());
      }

      // EXPLICIT HEADER RECONSTRUCTION
      // Since response headers are immutable, we create a new Response with the required headers.
      // This is the only way to ensure the browser sees the COEP/COOP/CORP headers
      // for resources served from the Service Worker cache.
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
      newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
      newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

      // Handle cases where the body might be empty or consumed
      let responseBody = response.body;
      
      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    })());
});
