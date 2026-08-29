const CACHE_NAME = "trilha-flashcard-v39";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=20260829-dup1",
  "./app.js?v=20260829-dup1",
  "./card-import.js?v=20260826-1",
  "./card-storage.js?v=20260826-1",
  "./card-manager.js?v=20260829-dup1",
  "./card-database.js?v=20260826-1",
  "./data-model.js?v=20260826-2",
  "./supabase-config.js?v=20260827-1",
  "./supabase-sync.js?v=20260827-1",
  "./vendor/supabase-js.mjs",
  "./firebase-config.js?v=20260821-2",
  "./cloud-sync.js?v=20260826-1",
  "./decks.js?v=20260829-1",
  "./spaced-repetition.js?v=20260823-1",
  "./motion-animations.js?v=20260824-1",
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
