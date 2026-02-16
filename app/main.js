import { createRouter } from "./core/router.js";
import { createMonetizationInfrastructure } from "./monetization/index.js";
import { createToast } from "./services/toast.js";
import { createFeedView } from "./views/feedView.js";
import { createSubmitView } from "./views/submitView.js";

const monetization = createMonetizationInfrastructure();

const routes = Object.freeze({
  FEED: "/feed",
  SUBMIT: "/submit",
  ABOUT: "/about",
  FUTURE_PREMIUM: "/future-premium",
});

const sections = Array.from(document.querySelectorAll("[data-view]"));
const tabButtons = Array.from(document.querySelectorAll("[data-tab-route]"));

const toast = createToast(document.querySelector("[data-toast]"));
const feedView = createFeedView({
  root: document.querySelector("[data-view='/feed']"),
  toast,
  monetization,
});
const submitView = createSubmitView({
  root: document.querySelector("[data-view='/submit']"),
  toast,
  onSubmitted: () => {
    // Keep submissions isolated to the submit section while confirming success in-app.
  },
});

function setActiveSection(route) {
  sections.forEach((section) => {
    const isActive = section.getAttribute("data-view") === route;
    section.hidden = !isActive;
    section.classList.toggle("is-active", isActive);
  });
  tabButtons.forEach((button) => {
    const isActive = button.getAttribute("data-tab-route") === route;
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
}

function normalizeAppRoute(route) {
  if (route === routes.FEED || route === routes.SUBMIT || route === routes.ABOUT) {
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
};

router.register(routes.FEED, sharedHandler);
router.register(routes.SUBMIT, sharedHandler);
router.register(routes.ABOUT, sharedHandler);
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
