const DEFAULT_ROUTE = "/feed";

function normalizeRoute(rawRoute = "") {
  const value = String(rawRoute || "").trim();
  if (!value) {
    return DEFAULT_ROUTE;
  }
  if (value === "*") {
    return "*";
  }
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  const [pathOnly] = withSlash.split("?");
  const normalizedPath = pathOnly.replace(/\/{2,}/g, "/");
  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    return normalizedPath.slice(0, -1);
  }
  return normalizedPath;
}

function readHashRoute() {
  const hash = String(window.location.hash || "").replace(/^#/, "").trim();
  if (!hash) {
    return "";
  }
  return normalizeRoute(hash);
}

function readPathRoute() {
  const path = String(window.location.pathname || "").trim();
  if (!path || path === "/") {
    return "";
  }
  return normalizeRoute(path);
}

export function createRouter(options = {}) {
  const defaultRoute = normalizeRoute(options.defaultRoute || DEFAULT_ROUTE);
  const routes = new Map();
  let started = false;

  function getCurrentRoute() {
    return readHashRoute() || readPathRoute() || defaultRoute;
  }

  function emitRouteChange() {
    const route = getCurrentRoute();
    const handler = routes.get(route) || routes.get("*");
    if (typeof handler === "function") {
      handler(route);
    }
    return route;
  }

  function register(route, handler) {
    routes.set(normalizeRoute(route), handler);
  }

  function navigate(route, options = {}) {
    const normalized = normalizeRoute(route);
    if (options.usePathname) {
      window.history.pushState({}, "", normalized);
      emitRouteChange();
      return;
    }
    if (window.location.hash !== `#${normalized}`) {
      window.location.hash = normalized;
      return;
    }
    emitRouteChange();
  }

  function start() {
    if (started) {
      return;
    }
    started = true;
    window.addEventListener("hashchange", emitRouteChange);
    window.addEventListener("popstate", emitRouteChange);
    if (!readHashRoute() && !readPathRoute()) {
      window.location.hash = defaultRoute;
      return;
    }
    emitRouteChange();
  }

  return {
    register,
    navigate,
    start,
    getCurrentRoute,
  };
}
