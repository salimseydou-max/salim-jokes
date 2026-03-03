import { createRouter } from "./core/router.js";
import { createMonetizationInfrastructure } from "./monetization/index.js";
import { createAuthService } from "./services/authService.js";
import { createCommentStore } from "./services/commentStore.js";
import { createFeedComposer } from "./services/feedComposer.js";
import { createFavoritesStore } from "./services/favoritesStore.js";
import { createI18nService } from "./services/i18nService.js";
import { createNotificationStore } from "./services/notificationStore.js";
import { createPreferencesStore } from "./services/preferencesStore.js";
import { createReactionStore } from "./services/reactionStore.js";
import { createSearchService } from "./services/searchService.js";
import { getOrCreatePersistentId } from "./services/storage.js";
import { createSubmissionStore } from "./services/submissionStore.js";
import { createToast } from "./services/toast.js";
import { createFeedView } from "./views/feedView.js";
import { createNotificationsView } from "./views/notificationsView.js";
import { createProfileView } from "./views/profileView.js";
import { applyThemeToDocument, createSettingsView } from "./views/settingsView.js";
import { createSubmitView } from "./views/submitView.js";

createMonetizationInfrastructure();

const routes = Object.freeze({
  FEED: "/feed",
  SUBMIT: "/submit",
  PROFILE: "/profile",
  SETTINGS: "/settings",
  NOTIFICATIONS: "/notifications",
  ABOUT: "/about",
  PRIVACY: "/privacy",
  HELP: "/help",
  CONTACT: "/contact",
  FUTURE_PREMIUM: "/future-premium",
});

const sections = Array.from(document.querySelectorAll("[data-view]"));
const tabButtons = Array.from(document.querySelectorAll("[data-tab-route]"));
const menuRouteButtons = Array.from(document.querySelectorAll("[data-menu-route]"));
const profileRouteButtons = Array.from(document.querySelectorAll("[data-profile-route]"));
const profileActionButtons = Array.from(document.querySelectorAll("[data-profile-action]"));

const menuToggle = document.querySelector("[data-overflow-menu-toggle]");
const menuClose = document.querySelector("[data-overflow-menu-close]");
const menuPanel = document.querySelector("[data-overflow-menu]");
const profileMenuToggle = document.querySelector("[data-profile-menu-toggle]");
const profileMenuClose = document.querySelector("[data-profile-menu-close]");
const profileMenuPanel = document.querySelector("[data-profile-menu]");
const profileAlertBadge = document.querySelector("[data-profile-alert-badge]");
const headerProfileAvatar = document.querySelector("[data-header-profile-avatar]");
const headerProfileInitial = document.querySelector("[data-header-profile-initial]");

const toast = createToast(document.querySelector("[data-toast]"));

const viewerId = getOrCreatePersistentId("vjc.viewer-id.v1");
const authService = createAuthService();
const preferencesStore = createPreferencesStore();
applyThemeToDocument(preferencesStore.get().appearance?.theme || "dark");
const i18nService = createI18nService({
  defaultLanguage: preferencesStore.get().general?.language || "en",
});
const notificationStore = createNotificationStore();
const favoritesStore = createFavoritesStore({
  storageKey: "vjc.feed.favorite-jokes.v1",
});
const reactionStore = createReactionStore({
  storageKey: "vjc.reactions.v1",
});
const commentStore = createCommentStore({
  storageKey: "vjc.comments.v1",
});
const submissionStore = createSubmissionStore({
  storageKey: "vjc.submissions.v1",
});
const searchService = createSearchService();
const feedComposer = createFeedComposer({
  language: i18nService.getLanguage(),
  category: "random",
});

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

function applyDocumentLanguage(languageCode) {
  const language = String(languageCode || "en").slice(0, 2).toLowerCase();
  document.documentElement.setAttribute("lang", language);
  document.documentElement.setAttribute("dir", RTL_LANGUAGES.has(language) ? "rtl" : "ltr");
}

function updateHeaderProfile(user) {
  const entry = user || authService.getUser();
  const label = entry?.displayName || entry?.email || "User";
  const initial = String(label).trim().charAt(0).toUpperCase() || "U";
  const avatarUrl = entry?.avatarUrl || entry?.profile?.avatarUrl || "";

  if (headerProfileInitial) {
    headerProfileInitial.textContent = initial;
  }
  if (headerProfileAvatar) {
    if (avatarUrl) {
      headerProfileAvatar.src = avatarUrl;
      headerProfileAvatar.hidden = false;
      if (headerProfileInitial) {
        headerProfileInitial.hidden = true;
      }
    } else {
      headerProfileAvatar.hidden = true;
      if (headerProfileInitial) {
        headerProfileInitial.hidden = false;
      }
    }
  }
  if (profileMenuToggle) {
    profileMenuToggle.setAttribute("aria-label", `Open profile menu for ${label}`);
  }
}

function syncLanguageFromUser(user) {
  const language = String(user?.language || user?.profile?.preferences?.language || "")
    .slice(0, 2)
    .toLowerCase();
  if (!language) {
    return;
  }
  const current = preferencesStore.get().general?.language || "en";
  if (current !== language) {
    preferencesStore.update({
      general: {
        language,
      },
    });
  }
}

let profileView = null;
profileView = createProfileView({
  root: document.querySelector("[data-view='/profile']"),
  authService,
  favoritesStore,
  submissionStore,
  reactionStore,
  commentStore,
  i18nService,
  notificationStore,
  toast,
  getViewerId: () => viewerId,
  onUserChanged: (user) => {
    profileView?.refreshCollections();
    updateHeaderProfile(user || authService.getUser());
    syncLanguageFromUser(user || authService.getUser());
  },
});

const feedView = createFeedView({
  root: document.querySelector("[data-view='/feed']"),
  toast,
  feedComposer,
  searchService,
  favoritesStore,
  reactionStore,
  commentStore,
  notificationStore,
  preferencesStore,
  profileView,
  i18nService,
  getViewerId: () => viewerId,
  getCurrentUser: () => authService.getUser(),
});

const submitView = createSubmitView({
  root: document.querySelector("[data-view='/submit']"),
  toast,
  notificationStore,
  onSubmitted: (joke) => {
    const ownerId = authService.getUser()?.id || viewerId;
    if (joke) {
      submissionStore.addSubmission(joke, ownerId);
      feedView.addUserSubmission({
        ...joke,
        sourceType: "user",
      });
      profileView?.refreshCollections();
    }
  },
});

const settingsView = createSettingsView({
  root: document.querySelector("[data-view='/settings']"),
  preferencesStore,
  i18nService,
  authService,
  toast,
  notificationStore,
});

const notificationsView = createNotificationsView({
  root: document.querySelector("[data-view='/notifications']"),
  store: notificationStore,
  onUnreadChange: (count) => {
    if (profileAlertBadge) {
      profileAlertBadge.textContent = String(count);
      profileAlertBadge.hidden = count <= 0;
    }
  },
});

function closeMenu() {
  if (!menuPanel || !menuToggle) {
    return;
  }
  menuPanel.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
}

function closeProfileMenu() {
  if (!profileMenuPanel || !profileMenuToggle) {
    return;
  }
  profileMenuPanel.hidden = true;
  profileMenuToggle.setAttribute("aria-expanded", "false");
}

function openMenu() {
  if (!menuPanel || !menuToggle) {
    return;
  }
  menuPanel.hidden = false;
  menuToggle.setAttribute("aria-expanded", "true");
}

function openProfileMenu() {
  if (!profileMenuPanel || !profileMenuToggle) {
    return;
  }
  profileMenuPanel.hidden = false;
  profileMenuToggle.setAttribute("aria-expanded", "true");
}

function toggleMenu() {
  if (!menuPanel) {
    return;
  }
  if (menuPanel.hidden) {
    openMenu();
    return;
  }
  closeMenu();
}

function toggleProfileMenu() {
  if (!profileMenuPanel) {
    return;
  }
  if (profileMenuPanel.hidden) {
    openProfileMenu();
    return;
  }
  closeProfileMenu();
}

function setActiveSection(route) {
  sections.forEach((section) => {
    const isActive = section.getAttribute("data-view") === route;
    section.hidden = !isActive;
    section.classList.toggle("is-active", isActive);
  });
  tabButtons.forEach((button) => {
    const buttonRoute = button.getAttribute("data-tab-route");
    const isActive = buttonRoute === route;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });

  if (route === routes.FEED) {
    feedView.activate();
  } else {
    feedView.deactivate();
  }
  if (route === routes.SUBMIT) {
    submitView.focus();
  }
  if (route === routes.PROFILE) {
    profileView.activate();
  }
  if (route === routes.SETTINGS) {
    settingsView.activate();
  }
  if (route === routes.NOTIFICATIONS) {
    notificationsView.activate();
  }
}

function normalizeAppRoute(route) {
  if (
    route === routes.FEED ||
    route === routes.SUBMIT ||
    route === routes.PROFILE ||
    route === routes.SETTINGS ||
    route === routes.NOTIFICATIONS ||
    route === routes.ABOUT ||
    route === routes.PRIVACY ||
    route === routes.HELP ||
    route === routes.CONTACT
  ) {
    return route;
  }
  if (route === routes.FUTURE_PREMIUM) {
    return routes.FUTURE_PREMIUM;
  }
  return routes.FEED;
}

const router = createRouter({
  defaultRoute: routes.FEED,
});

const sharedHandler = (incomingRoute) => {
  const route = normalizeAppRoute(incomingRoute);
  setActiveSection(route);
  closeMenu();
  closeProfileMenu();
};

router.register(routes.FEED, sharedHandler);
router.register(routes.SUBMIT, sharedHandler);
router.register(routes.PROFILE, sharedHandler);
router.register(routes.SETTINGS, sharedHandler);
router.register(routes.NOTIFICATIONS, sharedHandler);
router.register(routes.ABOUT, sharedHandler);
router.register(routes.PRIVACY, sharedHandler);
router.register(routes.HELP, sharedHandler);
router.register(routes.CONTACT, sharedHandler);
router.register(routes.FUTURE_PREMIUM, sharedHandler);
router.register("*", () => {
  router.navigate(routes.FEED);
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const route = button.getAttribute("data-tab-route");
    if (!route) {
      return;
    }
    router.navigate(route);
  });
});

menuRouteButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const route = button.getAttribute("data-menu-route");
    if (!route) {
      return;
    }
    router.navigate(route);
  });
});

profileRouteButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const route = button.getAttribute("data-profile-route");
    if (!route) {
      return;
    }
    router.navigate(route);
  });
});

profileActionButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.getAttribute("data-profile-action");
    if (!action) {
      return;
    }
    if (action === "edit-info") {
      router.navigate(routes.PROFILE);
      window.setTimeout(() => {
        profileView?.openEditInfo?.();
      }, 20);
      return;
    }
    if (action === "logout") {
      await authService.logout();
      updateHeaderProfile(null);
      toast.show("Logged out.");
      router.navigate(routes.FEED);
    }
  });
});

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  closeProfileMenu();
  toggleMenu();
});
menuClose?.addEventListener("click", () => {
  closeMenu();
});
profileMenuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  closeMenu();
  toggleProfileMenu();
});
profileMenuClose?.addEventListener("click", () => {
  closeProfileMenu();
});
document.addEventListener("click", (event) => {
  if (!menuPanel || menuPanel.hidden) {
    if (!profileMenuPanel || profileMenuPanel.hidden) {
      return;
    }
  }
  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }
  if (menuPanel && !menuPanel.hidden) {
    if (!menuPanel.contains(target) && !menuToggle?.contains(target)) {
      closeMenu();
    }
  }
  if (profileMenuPanel && !profileMenuPanel.hidden) {
    if (!profileMenuPanel.contains(target) && !profileMenuToggle?.contains(target)) {
      closeProfileMenu();
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    closeProfileMenu();
  }
});

i18nService.applyTranslations(document);
applyDocumentLanguage(i18nService.getLanguage());
i18nService.subscribe((language) => {
  applyDocumentLanguage(language);
  i18nService.applyTranslations(document);
});

if (
  window.location.pathname === routes.FUTURE_PREMIUM ||
  window.location.pathname === `${routes.FUTURE_PREMIUM}/`
) {
  router.navigate(routes.FUTURE_PREMIUM);
}

router.start();
updateHeaderProfile(authService.getUser());

// Safety net: ensure feed auto-loads even if route events are delayed.
window.setTimeout(() => {
  const route = router.getCurrentRoute();
  const hasCards = Boolean(document.querySelector("[data-feed-list]")?.children.length);
  if (route === routes.FEED && !hasCards) {
    feedView.activate().catch(() => {
      toast.show("Could not load jokes. Please try again.", "error");
    });
  }
}, 1200);

let authHeartbeatTimer = 0;
function stopAuthHeartbeat() {
  if (authHeartbeatTimer) {
    window.clearInterval(authHeartbeatTimer);
    authHeartbeatTimer = 0;
  }
}

function startAuthHeartbeat() {
  stopAuthHeartbeat();
  authHeartbeatTimer = window.setInterval(() => {
    authService.refreshSession({ keepLocalOnFailure: true }).catch(() => null);
  }, 5 * 60 * 1000);
}

authService.subscribe((user) => {
  updateHeaderProfile(user);
  syncLanguageFromUser(user);
  if (user) {
    startAuthHeartbeat();
  } else {
    stopAuthHeartbeat();
  }
});
authService.refreshSession({ keepLocalOnFailure: true }).then((user) => {
  updateHeaderProfile(user);
  syncLanguageFromUser(user);
  if (user) {
    startAuthHeartbeat();
  } else {
    stopAuthHeartbeat();
  }
});

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Trigger update checks so stale shells are replaced quickly.
        registration.update().catch(() => null);
      })
      .catch(() => {
        // Service worker failures should not block app startup.
      });
  });
}
