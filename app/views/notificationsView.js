function formatRelativeTime(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) {
    return "now";
  }
  const diffMs = Date.now() - time;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin <= 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function buildNotificationItem(item, compact = false) {
  const article = document.createElement("article");
  article.className = `notification-item${item.read ? "" : " is-unread"}`;
  article.dataset.notificationId = item.id;

  const top = document.createElement("div");
  top.className = "notification-top";
  const title = document.createElement("strong");
  title.textContent = item.title || "Notification";
  const time = document.createElement("span");
  time.className = "notification-time";
  time.textContent = formatRelativeTime(item.createdAt);
  top.append(title, time);

  const message = document.createElement("p");
  message.className = "notification-message";
  message.textContent = item.message;
  article.append(top, message);

  if (!compact && item.type) {
    const type = document.createElement("span");
    type.className = "notification-type";
    type.textContent = item.type.replace(/[-_]/g, " ");
    article.append(type);
  }
  return article;
}

function renderIntoList(container, notifications, compact = false) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  if (!notifications.length) {
    const empty = document.createElement("p");
    empty.className = "section-copy";
    empty.textContent = "No notifications yet.";
    container.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < notifications.length; i += 1) {
    fragment.appendChild(buildNotificationItem(notifications[i], compact));
  }
  container.appendChild(fragment);
}

export function createNotificationsView(options = {}) {
  const root = options.root;
  const store = options.store;
  const onUnreadChange =
    typeof options.onUnreadChange === "function" ? options.onUnreadChange : () => {};

  const list = root?.querySelector("[data-notifications-list]");
  const markAllButton = root?.querySelector("[data-notifications-mark-all]");

  const bellButton = options.bellButton || null;
  const badge = options.badge || null;
  const panel = options.panel || null;
  const panelList = panel?.querySelector("[data-notification-panel-list]") || null;
  const panelMarkAll = panel?.querySelector("[data-notification-panel-mark-all]") || null;

  let panelOpen = false;
  let unsubscribe = null;

  function updateUnreadBadge() {
    const unread = store?.unreadCount() || 0;
    if (badge) {
      badge.textContent = String(unread);
      badge.hidden = unread <= 0;
    }
    onUnreadChange(unread);
  }

  function render() {
    const notifications = store?.list() || [];
    renderIntoList(list, notifications, false);
    renderIntoList(panelList, notifications.slice(0, 8), true);
    updateUnreadBadge();
  }

  function closePanel() {
    if (!panel) {
      return;
    }
    panelOpen = false;
    panel.hidden = true;
    bellButton?.setAttribute("aria-expanded", "false");
  }

  function togglePanel() {
    if (!panel) {
      return;
    }
    panelOpen = !panelOpen;
    panel.hidden = !panelOpen;
    bellButton?.setAttribute("aria-expanded", panelOpen ? "true" : "false");
    if (panelOpen) {
      store?.markAllAsRead();
    }
  }

  function init() {
    if (!store) {
      return;
    }
    store.seedInitialNotifications();
    render();
    unsubscribe = store.subscribe(() => {
      render();
    });
    markAllButton?.addEventListener("click", () => {
      store.markAllAsRead();
    });
    panelMarkAll?.addEventListener("click", () => {
      store.markAllAsRead();
    });
    bellButton?.addEventListener("click", () => {
      togglePanel();
    });
    document.addEventListener("click", (event) => {
      if (!panel || panel.hidden) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (panel.contains(target) || bellButton?.contains(target)) {
        return;
      }
      closePanel();
    });
  }

  function activate() {
    store?.markAllAsRead();
    render();
  }

  function destroy() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  init();

  return {
    activate,
    render,
    destroy,
    closePanel,
  };
}
