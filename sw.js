const DEFAULT_TITLE = "Voice Joke Club";
const DEFAULT_URL = "/#/jokes";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
  const icon = typeof payload.icon === "string" && payload.icon.trim() ? payload.icon.trim() : undefined;
  const badge = typeof payload.badge === "string" && payload.badge.trim() ? payload.badge.trim() : undefined;
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
