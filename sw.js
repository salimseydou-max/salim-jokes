const DEFAULT_TITLE = "Voice Joke Club";
const DEFAULT_URL = "/#/jokes";
const DEFAULT_ICON = "/icons/icon-192.png";
const DEFAULT_BADGE = "/icons/favicon-32.png";

const CACHE_VERSION = "profile-avatar-fix-v5";
const CORE_CACHE = `vjc-core-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `vjc-runtime-cache-${CACHE_VERSION}`;
const API_CACHE = `vjc-api-cache-${CACHE_VERSION}`;
const IMAGE_CACHE = `vjc-image-cache-${CACHE_VERSION}`;
const CACHE_NAMES = [CORE_CACHE, RUNTIME_CACHE, API_CACHE, IMAGE_CACHE];

const OFFLINE_FALLBACK_URL = "/offline.html";
const APP_SHELL_URL = "/index.html";
const FONT_STYLESHEET_URL =
  "https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap";
const CORE_ASSETS = [
  "/",
  APP_SHELL_URL,
  "/#/jokes",
  OFFLINE_FALLBACK_URL,
  "/manifest.json",
  DEFAULT_ICON,
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/original-icon.svg",
  DEFAULT_BADGE,
  FONT_STYLESHEET_URL
];

function isHttpRequest(request) {
  if (!request || !request.url) {
    return false;
  }
  try {
    const parsed = new URL(request.url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function shouldCacheResponse(response) {
  return Boolean(response && (response.status === 200 || response.type === "opaque"));
}

async function putInCache(cacheName, request, response) {
  if (!shouldCacheResponse(response)) {
    return;
  }
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  await putInCache(cacheName, request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      await putInCache(cacheName, request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }
  const response = await networkPromise;
  if (response) {
    return response;
  }
  throw new Error("Network and cache miss.");
}

async function networkFirst(request, cacheName, fallbackUrl = "") {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    await putInCache(cacheName, request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) {
        return fallback;
      }
    }
    throw error;
  }
}

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request, { cache: "no-store" });
    await putInCache(CORE_CACHE, APP_SHELL_URL, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedPage = await caches.match(APP_SHELL_URL);
    if (cachedPage) {
      return cachedPage;
    }
    const fallback = await caches.match(OFFLINE_FALLBACK_URL);
    if (fallback) {
      return fallback;
    }
    throw error;
  }
}

async function handleRequest(request) {
  if (!isHttpRequest(request)) {
    return fetch(request);
  }

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    return handleNavigationRequest(request);
  }

  if (!sameOrigin) {
    if (
      request.destination === "style" ||
      request.destination === "font" ||
      request.destination === "script"
    ) {
      return staleWhileRevalidate(request, RUNTIME_CACHE);
    }
    return fetch(request);
  }

  if (url.pathname.startsWith("/api/")) {
    return networkFirst(request, API_CACHE);
  }

  if (
    request.destination === "image" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/splash/")
  ) {
    return cacheFirst(request, IMAGE_CACHE);
  }

  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "manifest"
  ) {
    return staleWhileRevalidate(request, RUNTIME_CACHE);
  }

  return staleWhileRevalidate(request, RUNTIME_CACHE);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE_CACHE);
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (error) {
            // Keep install resilient if a non-critical asset fails.
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (!CACHE_NAMES.includes(key)) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  event.respondWith(
    handleRequest(request).catch(async () => {
      if (request.mode === "navigate") {
        const fallback = await caches.match(OFFLINE_FALLBACK_URL);
        if (fallback) {
          return fallback;
        }
      }
      return Response.error();
    })
  );
});

function buildNotificationPayload(rawPayload) {
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? rawPayload
      : {};

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : DEFAULT_TITLE;

  const body = typeof payload.body === "string" ? payload.body : "";
  const tag = typeof payload.tag === "string" && payload.tag.trim() ? payload.tag.trim() : "update";
  const icon = typeof payload.icon === "string" && payload.icon.trim() ? payload.icon.trim() : DEFAULT_ICON;
  const badge =
    typeof payload.badge === "string" && payload.badge.trim() ? payload.badge.trim() : DEFAULT_BADGE;
  const data =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data
      : {};

  if (!data.url || typeof data.url !== "string") {
    data.url = DEFAULT_URL;
  }

  return {
    title,
    options: {
      body,
      tag,
      icon,
      badge,
      data
    }
  };
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      if (event.data) {
        try {
          payload = event.data.json();
        } catch (error) {
          try {
            payload = { body: await event.data.text() };
          } catch (textError) {
            payload = {};
          }
        }
      }
      const normalized = buildNotificationPayload(payload);
      await self.registration.showNotification(normalized.title, normalized.options);
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type !== "SHOW_NOTIFICATION") {
    return;
  }
  const normalized = buildNotificationPayload(data.payload || data);
  event.waitUntil(self.registration.showNotification(normalized.title, normalized.options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url || DEFAULT_URL;
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (!("focus" in client)) {
          continue;
        }
        const clientBase = (client.url || "").split("#")[0];
        const targetBase = targetUrl.split("#")[0];
        if (clientBase === targetBase) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
