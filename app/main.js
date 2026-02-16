import { createRouter } from "./core/router.js";
import { createMonetizationInfrastructure } from "./monetization/index.js";
import { createAuthService } from "./services/authService.js";
import { createCommentStore } from "./services/commentStore.js";
import { createFeedComposer } from "./services/feedComposer.js";
import { createFavoritesStore } from "./services/favoritesStore.js";
import { createNotificationStore } from "./services/notificationStore.js";
import { createPreferencesStore } from "./services/preferencesStore.js";
import { createReactionStore } from "./services/reactionStore.js";
import { createSearchService } from "./services/searchService.js";
import { getOrCreatePersistentId } from "./services/storage.js";
import { createSubmissionStore } from "./services/submissionStore.js";
import { createToast } from "./services/toast.js";
import { createVerificationService } from "./services/verificationService.js";
import { createFeedView } from "./views/feedView.js";
import { createNotificationsView } from "./views/notificationsView.js";
import { createProfileView } from "./views/profileView.js";
import { createSettingsView } from "./views/settingsView.js";
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

const menuToggle = document.querySelector("[data-overflow-menu-toggle]");
const menuClose = document.querySelector("[data-overflow-menu-close]");
const menuPanel = document.querySelector("[data-overflow-menu]");
const menuAlertBadge = document.querySelector("[data-menu-alert-badge]");

const toast = createToast(document.querySelector("[data-toast]"));

const viewerId = getOrCreatePersistentId("vjc.viewer-id.v1");
const authService = createAuthService();
const verificationService = createVerificationService();
const preferencesStore = createPreferencesStore();
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
  language: "en",
  category: "random",
});

let profileView = null;
profileView = createProfileView({
  root: document.querySelector("[data-view='/profile']"),
  authService,
  verificationService,
  favoritesStore,
  submissionStore,
  reactionStore,
  commentStore,
  toast,
  getViewerId: () => viewerId,
  onUserChanged: () => {
    profileView?.refreshCollections();
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
  authService,
  toast,
  notificationStore,
});

const notificationsView = createNotificationsView({
  root: document.querySelector("[data-view='/notifications']"),
  store: notificationStore,
  onUnreadChange: (count) => {
    if (!menuAlertBadge) {
      return;
    }
    menuAlertBadge.textContent = String(count);
    menuAlertBadge.hidden = count <= 0;
  },
});

function closeMenu() {
  if (!menuPanel || !menuToggle) {
    return;
  }
  menuPanel.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
}

function openMenu() {
  if (!menuPanel || !menuToggle) {
    return;
  }
  menuPanel.hidden = false;
  menuToggle.setAttribute("aria-expanded", "true");
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

menuToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMenu();
});
menuClose?.addEventListener("click", () => {
  closeMenu();
});
document.addEventListener("click", (event) => {
  if (!menuPanel || menuPanel.hidden) {
    return;
  }
  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }
  if (menuPanel.contains(target) || menuToggle?.contains(target)) {
    return;
  }
  closeMenu();
});

authService.refreshSession();

if (
  window.location.pathname === routes.FUTURE_PREMIUM ||
  window.location.pathname === `${routes.FUTURE_PREMIUM}/`
) {
  router.navigate(routes.FUTURE_PREMIUM);
}

router.start();

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker failures should not block app startup.
    });
  });
}
