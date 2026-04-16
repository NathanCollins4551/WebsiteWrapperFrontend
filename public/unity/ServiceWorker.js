const SW_VERSION = "1.0.1";
const cacheName = "DefaultCompany-DigitalTwinWebGL-0.1.0";
const contentToCache = [
    "Build/Temp.loader.js",
    "Build/Temp.framework.js.unityweb",
    "Build/Temp.data.unityweb",
    "Build/Temp.wasm.unityweb",
    "TemplateData/style.css"
];

self.addEventListener('install', function (e) {
    console.log(`[Service Worker ${SW_VERSION}] Install triggered`);
    // Force the new service worker to become active immediately
    self.skipWaiting();
    
    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker ${SW_VERSION}] Caching assets`);
      await cache.addAll(contentToCache);
    })());
});

self.addEventListener('activate', function (e) {
  console.log(`[Service Worker ${SW_VERSION}] Activated and claiming clients`);
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
    e.respondWith((async function () {
      let response = await caches.match(e.request);
      
      if (!response) {
        console.log(`[Service Worker ${SW_VERSION}] Network fetch: ${e.request.url}`);
        response = await fetch(e.request);
        const cache = await caches.open(cacheName);
        cache.put(e.request, response.clone());
      } else {
        console.log(`[Service Worker ${SW_VERSION}] Cache hit: ${e.request.url}`);
      }

      // EXPLICIT HEADER RECONSTRUCTION
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
