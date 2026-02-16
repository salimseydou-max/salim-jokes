import { featureFlags } from "../config/featureFlags.js";
import { createDuplicateTracker } from "../services/duplicateTracker.js";
import { createFavoritesStore } from "../services/favoritesStore.js";
import {
  fetchFeedPage,
  generateFallbackJoke,
  trackJokeView,
} from "../services/jokesApi.js";

const VISIBLE_BATCH_SIZE = 6;
const API_BATCH_SIZE = 12;
const MAX_API_ROUNDS_PER_LOAD = 4;
const MAX_GENERATION_ATTEMPTS = 8;

function createElement(tag, className = "") {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  return element;
}

function setButtonSavedState(button, isSaved) {
  button.dataset.saved = isSaved ? "true" : "false";
  button.textContent = isSaved ? "Saved" : "Save";
  button.setAttribute("aria-pressed", isSaved ? "true" : "false");
}

async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function createFeedView(options = {}) {
  const root = options.root;
  const toast = options.toast;
  const feedList = root?.querySelector("[data-feed-list]");
  const skeletonHost = root?.querySelector("[data-feed-skeleton]");
  const loadingFooter = root?.querySelector("[data-feed-loading]");
  const sentinel = root?.querySelector("[data-feed-sentinel]");
  const emptyState = root?.querySelector("[data-feed-empty]");

  const duplicateTracker = createDuplicateTracker({
    sessionKey: "vjc.feed.seen-joke-ids.v1",
    // This adapter is intentionally left as a no-op placeholder for future persistent filtering.
    persistenceAdapter: {
      async load() {
        return [];
      },
      async save() {
        return undefined;
      },
    },
  });
  const favoritesStore = createFavoritesStore({
    storageKey: "vjc.feed.favorite-jokes.v1",
  });

  let started = false;
  let loading = false;
  let observer = null;
  let nextOffset = 0;

  function setSkeletonVisible(isVisible) {
    if (!skeletonHost) {
      return;
    }
    skeletonHost.hidden = !isVisible;
  }

  function setFooterLoading(isVisible) {
    if (!loadingFooter) {
      return;
    }
    loadingFooter.hidden = !isVisible;
  }

  function setEmptyVisible(isVisible) {
    if (!emptyState) {
      return;
    }
    emptyState.hidden = !isVisible;
  }

  function renderSkeletonCards(count = 3) {
    if (!skeletonHost) {
      return;
    }
    skeletonHost.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const card = createElement("article", "joke-card skeleton-card");
      card.setAttribute("aria-hidden", "true");

      const line1 = createElement("div", "skeleton-line short");
      const line2 = createElement("div", "skeleton-line");
      const line3 = createElement("div", "skeleton-line");
      const line4 = createElement("div", "skeleton-line medium");
      const actions = createElement("div", "skeleton-actions");
      actions.innerHTML =
        '<span class="skeleton-chip"></span><span class="skeleton-chip"></span><span class="skeleton-chip"></span>';

      card.append(line1, line2, line3, line4, actions);
      fragment.appendChild(card);
    }
    skeletonHost.appendChild(fragment);
  }

  function buildJokeCard(joke) {
    const card = createElement("article", "joke-card");
    card.dataset.jokeId = joke.id;

    const header = createElement("header", "joke-card-header");
    const source = createElement("span", "joke-source");
    source.textContent = joke.source === "ai" || joke.source === "fallback_ai" ? "AI Mix" : "Community";
    const meta = createElement("span", "joke-meta");
    meta.textContent = `#${joke.category || "random"}`;
    header.append(source, meta);

    const content = createElement("p", "joke-text");
    content.textContent = joke.text;

    const actions = createElement("div", "joke-actions");
    const copyButton = createElement("button", "action-button");
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      try {
        await copyToClipboard(joke.text);
        toast?.show("Joke copied.");
      } catch (error) {
        toast?.show("Copy failed. Please try again.", "error");
      }
    });

    const shareButton = createElement("button", "action-button");
    shareButton.type = "button";
    shareButton.textContent = "Share";
    shareButton.addEventListener("click", async () => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: "Voice Joke Club",
            text: joke.text,
          });
        } else {
          await copyToClipboard(joke.text);
        }
        toast?.show("Ready to share.");
      } catch (error) {
        toast?.show("Share canceled.", "error");
      }
    });

    const favoriteButton = createElement("button", "action-button");
    favoriteButton.type = "button";
    const alreadySaved = favoritesStore.has(joke.id);
    setButtonSavedState(favoriteButton, alreadySaved);
    favoriteButton.addEventListener("click", () => {
      const result = favoritesStore.toggle({
        id: joke.id,
        text: joke.text,
        source: joke.source,
      });
      setButtonSavedState(favoriteButton, result.saved);
      toast?.show(result.saved ? "Saved locally." : "Removed from saved.");
    });

    actions.append(copyButton, shareButton, favoriteButton);
    card.append(header, content, actions);
    return card;
  }

  function appendJokesToFeed(jokes = []) {
    if (!feedList || !jokes.length) {
      return;
    }
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < jokes.length; i += 1) {
      const joke = jokes[i];
      const card = buildJokeCard(joke);
      fragment.appendChild(card);
      trackJokeView(joke);
    }
    feedList.appendChild(fragment);
  }

  function filterUniqueJokes(rawJokes = []) {
    const unique = [];
    for (let i = 0; i < rawJokes.length; i += 1) {
      const item = rawJokes[i];
      const id = String(item?.id || "").trim();
      if (!id) {
        continue;
      }
      if (!duplicateTracker.markDisplayed(id)) {
        continue;
      }
      unique.push(item);
    }
    return unique;
  }

  async function loadFallbackJokes(missingCount) {
    const output = [];
    for (
      let attempt = 0;
      attempt < MAX_GENERATION_ATTEMPTS && output.length < missingCount;
      attempt += 1
    ) {
      try {
        const style = attempt % 3 === 1 ? "story" : "quick";
        const generated = await generateFallbackJoke({ style });
        if (!generated || !generated.id) {
          continue;
        }
        if (!duplicateTracker.markDisplayed(generated.id)) {
          continue;
        }
        output.push(generated);
      } catch (error) {
        continue;
      }
    }
    return output;
  }

  async function loadMore() {
    if (loading) {
      return;
    }
    loading = true;
    setEmptyVisible(false);

    const initialLoad = !feedList || feedList.children.length === 0;
    if (initialLoad) {
      renderSkeletonCards(3);
      setSkeletonVisible(true);
    } else {
      setFooterLoading(true);
    }

    const collected = [];
    for (
      let round = 0;
      round < MAX_API_ROUNDS_PER_LOAD && collected.length < VISIBLE_BATCH_SIZE;
      round += 1
    ) {
      try {
        const page = await fetchFeedPage({
          offset: nextOffset,
          limit: API_BATCH_SIZE,
          includePremium:
            featureFlags.monetizationEnabled && featureFlags.premiumFeaturesVisible,
        });
        nextOffset += API_BATCH_SIZE;
        if (!page.hasMore) {
          nextOffset = 0;
        }
        const unique = filterUniqueJokes(page.jokes);
        if (unique.length) {
          collected.push(...unique);
        }
      } catch (error) {
        break;
      }
    }

    if (collected.length < VISIBLE_BATCH_SIZE) {
      const fallback = await loadFallbackJokes(VISIBLE_BATCH_SIZE - collected.length);
      if (fallback.length) {
        collected.push(...fallback);
      }
    }

    const toRender = collected.slice(0, VISIBLE_BATCH_SIZE);
    if (toRender.length) {
      appendJokesToFeed(toRender);
    } else if (!feedList || feedList.children.length === 0) {
      setEmptyVisible(true);
    }

    setSkeletonVisible(false);
    setFooterLoading(false);
    loading = false;
  }

  function onIntersect(entries) {
    const entry = entries.find((item) => item.isIntersecting);
    if (!entry) {
      return;
    }
    loadMore();
  }

  function startObserver() {
    if (!sentinel) {
      return;
    }
    if (observer) {
      return;
    }
    observer = new IntersectionObserver(onIntersect, {
      root: null,
      rootMargin: "1100px 0px 1100px 0px",
      threshold: 0.01,
    });
    observer.observe(sentinel);
  }

  function stopObserver() {
    if (!observer) {
      return;
    }
    observer.disconnect();
    observer = null;
  }

  async function activate() {
    if (!started) {
      started = true;
      await duplicateTracker.hydrateFromFutureStorage();
      startObserver();
      await loadMore();
      return;
    }
    startObserver();
    if (feedList && feedList.children.length < 3) {
      loadMore();
    }
  }

  function deactivate() {
    stopObserver();
  }

  return {
    activate,
    deactivate,
    loadMore,
  };
}
