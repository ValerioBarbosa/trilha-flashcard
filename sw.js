const CACHE_NAME = "trilha-flashcard-v31";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=20260824-5",
  "./app.js?v=20260824-9",
  "./card-import.js?v=20260821-1",
  "./card-storage.js?v=20260823-1",
  "./card-manager.js?v=20260824-1",
  "./card-database.js?v=20260822-1",
  "./firebase-config.js?v=20260821-2",
  "./cloud-sync.js?v=20260823-2",
  "./vendor/pdf.mjs?v=4.10.38",
  "./vendor/pdf.worker.mjs?v=4.10.38",
  "./decks.js?v=20260820-2",
  "./spaced-repetition.js?v=20260823-1",
  "./motion-animations.js?v=20260823-1",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl = null) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (fallbackUrl ? await caches.match(fallbackUrl) : Response.error());
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }

  const isCodeAsset = url.origin === self.location.origin && /\.(?:js|css)$/.test(url.pathname);
  event.respondWith(isCodeAsset ? networkFirst(event.request) : cacheFirst(event.request));
});
