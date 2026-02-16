import { readStorageValue, writeStorageValue } from "./storage.js";

const STORAGE_KEY = "vjc.notifications.v1";

function sanitizeId(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function sanitizeText(value, maxLength = 260) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeNotification(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = sanitizeId(raw.id);
  const message = sanitizeText(raw.message, 320);
  if (!id || !message) {
    return null;
  }
  return {
    id,
    type: sanitizeText(raw.type, 40) || "update",
    title: sanitizeText(raw.title, 120) || "",
    message,
    createdAt: sanitizeId(raw.createdAt, 80) || new Date().toISOString(),
    read: Boolean(raw.read),
    data: raw.data && typeof raw.data === "object" ? raw.data : {},
  };
}

function normalizeState(rawState) {
  const list = Array.isArray(rawState?.list) ? rawState.list : [];
  return {
    list: list.map((item) => normalizeNotification(item)).filter(Boolean),
  };
}

export function createNotificationStore(options = {}) {
  const storageKey = options.storageKey || STORAGE_KEY;
  const runtime = normalizeState(readStorageValue(storageKey, {}, "local"));
  const listeners = new Set();
  const backendAdapter =
    options.backendAdapter && typeof options.backendAdapter === "object"
      ? options.backendAdapter
      : null;

  function persist() {
    writeStorageValue(storageKey, runtime, "local");
  }

  function emit() {
    const snapshot = list();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        // Ignore listener errors to keep notification updates resilient.
      }
    });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function list() {
    return runtime.list
      .slice()
      .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  }

  function unreadCount() {
    return runtime.list.filter((item) => !item.read).length;
  }

  async function mirrorToBackend(item) {
    if (!backendAdapter || typeof backendAdapter.push !== "function") {
      return;
    }
    try {
      await backendAdapter.push(item);
    } catch (error) {
      // Keep local notifications alive if backend mirror fails.
    }
  }

  function add(input = {}) {
    const notification = normalizeNotification({
      id: input.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: input.type || "update",
      title: input.title || "",
      message: input.message || "",
      createdAt: input.createdAt || new Date().toISOString(),
      read: false,
      data: input.data || {},
    });
    if (!notification) {
      return null;
    }
    runtime.list.unshift(notification);
    runtime.list = runtime.list.slice(0, 250);
    persist();
    emit();
    mirrorToBackend(notification);
    return notification;
  }

  function markAsRead(id) {
    const safeId = sanitizeId(id);
    if (!safeId) {
      return false;
    }
    let changed = false;
    runtime.list = runtime.list.map((item) => {
      if (item.id !== safeId || item.read) {
        return item;
      }
      changed = true;
      return { ...item, read: true };
    });
    if (changed) {
      persist();
      emit();
    }
    return changed;
  }

  function markAllAsRead() {
    let changed = false;
    runtime.list = runtime.list.map((item) => {
      if (item.read) {
        return item;
      }
      changed = true;
      return { ...item, read: true };
    });
    if (changed) {
      persist();
      emit();
    }
    return changed;
  }

  function seedInitialNotifications() {
    if (runtime.list.length > 0) {
      return;
    }
    add({
      type: "feature-update",
      title: "Welcome",
      message: "Feed upgrades are active with smoother scrolling and richer interactions.",
    });
  }

  return {
    subscribe,
    list,
    unreadCount,
    add,
    markAsRead,
    markAllAsRead,
    seedInitialNotifications,
  };
}
