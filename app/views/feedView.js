import { createDuplicateTracker } from "../services/duplicateTracker.js";
import {
  syncFavoriteToProfile,
  syncLikeToProfile,
  trackJokeView,
} from "../services/jokesApi.js";
import { exportJokeAsImage } from "../services/imageExport.js";

const VISIBLE_BATCH_SIZE = 5;
const SEARCH_BATCH_SIZE = 6;
const SEARCH_DEBOUNCE_MS = 160;
const RECENT_FEED_WINDOW = 18;
const FEED_LOAD_ERROR_MESSAGE = "Could not load jokes right now. Please try again.";

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

function getSourceLabel(sourceType = "") {
  const normalized = String(sourceType || "").toLowerCase();
  if (normalized === "ai") {
    return "AI";
  }
  if (normalized === "user") {
    return "User";
  }
  if (normalized === "trending") {
    return "Trending";
  }
  if (normalized === "recent") {
    return "Recent";
  }
  return "Random";
}

function formatCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function sumReactionCounts(counts = {}) {
  return Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function normalizeJokeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function createFeedView(options = {}) {
  const root = options.root;
  const toast = options.toast;
  const feedComposer = options.feedComposer;
  const searchService = options.searchService;
  const favoritesStore = options.favoritesStore;
  const reactionStore = options.reactionStore;
  const commentStore = options.commentStore;
  const notificationStore = options.notificationStore;
  const preferencesStore = options.preferencesStore;
  const profileView = options.profileView;
  const i18nService = options.i18nService;
  const getViewerId = typeof options.getViewerId === "function" ? options.getViewerId : () => "guest";
  const getCurrentUser =
    typeof options.getCurrentUser === "function" ? options.getCurrentUser : () => null;
  const t =
    typeof i18nService?.t === "function"
      ? (key, fallback) => i18nService.t(key, fallback)
      : (_key, fallback) => fallback;

  const searchInput = document.querySelector("[data-global-search-input]");
  const searchClear = document.querySelector("[data-global-search-clear]");
  const searchMeta = root?.querySelector("[data-feed-search-meta]");
  const feedList = root?.querySelector("[data-feed-list]");
  const skeletonHost = root?.querySelector("[data-feed-skeleton]");
  const loadingFooter = root?.querySelector("[data-feed-loading]");
  const sentinel = root?.querySelector("[data-feed-sentinel]");
  const emptyState = root?.querySelector("[data-feed-empty]");
  const defaultEmptyMessage =
    emptyState?.textContent?.trim() ||
    "No jokes found. Try a different search keyword or keep scrolling for fresh content.";

  const duplicateTracker = createDuplicateTracker({
    sessionKey: "vjc.feed.seen-joke-state.v3",
    localKey: "vjc.feed.seen-joke-state.local.v3",
    maxIds: 460,
    maxFingerprints: 560,
    // Placeholder for future persistent duplicate filtering backend.
    persistenceAdapter: {
      async load() {
        return [];
      },
      async save() {
        return undefined;
      },
    },
  });

  let started = false;
  let primed = false;
  let loading = false;
  let observer = null;
  let searchTimer = 0;
  let searchMode = false;
  let searchQuery = "";
  let searchResults = [];
  let searchOffset = 0;
  let activeReactionPicker = null;
  let activeReactionToggle = null;
  let primingTask = null;

  const mainFeedJokes = [];
  const knownById = new Map();

  function setSkeletonVisible(isVisible) {
    if (!skeletonHost) {
      return;
    }
    skeletonHost.hidden = !isVisible;
  }

  function setFeedBusy(isBusy) {
    if (!feedList) {
      return;
    }
    feedList.setAttribute("aria-busy", isBusy ? "true" : "false");
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

  function setEmptyMessage(message) {
    if (!emptyState) {
      return;
    }
    emptyState.textContent = String(message || defaultEmptyMessage);
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

  function getActiveOwnerIdentity() {
    const currentUser = getCurrentUser();
    if (currentUser?.id) {
      return {
        id: currentUser.id,
        displayName: currentUser.displayName || "User",
      };
    }
    return {
      id: getViewerId(),
      displayName: "Guest",
    };
  }

  function rememberJokes(jokes = []) {
    for (let i = 0; i < jokes.length; i += 1) {
      const joke = jokes[i];
      if (!joke || !joke.id) {
        continue;
      }
      if (!knownById.has(joke.id)) {
        knownById.set(joke.id, joke);
      }
    }
    searchService?.indexJokes(jokes);
    feedComposer?.addToCatalog?.(jokes);
  }

  function ensureMainFeedJoke(joke) {
    if (!joke?.id) {
      return;
    }
    if (!mainFeedJokes.some((entry) => entry.id === joke.id)) {
      mainFeedJokes.push(joke);
    }
  }

  function isInRecentFeedWindow(jokeId, windowSize = RECENT_FEED_WINDOW) {
    const id = String(jokeId || "").trim();
    if (!id || !mainFeedJokes.length) {
      return false;
    }
    const cap = Math.max(1, Math.floor(Number(windowSize) || RECENT_FEED_WINDOW));
    const startIndex = Math.max(0, mainFeedJokes.length - cap);
    for (let i = startIndex; i < mainFeedJokes.length; i += 1) {
      if (mainFeedJokes[i]?.id === id) {
        return true;
      }
    }
    return false;
  }

  function updateCommentButtonText(button, jokeId) {
    if (!button) {
      return;
    }
    const count = commentStore?.getCountForJoke(jokeId) || 0;
    button.textContent = `Comments ${formatCount(count)}`;
  }

  function closeActiveReactionPicker() {
    if (activeReactionPicker) {
      activeReactionPicker.hidden = true;
      activeReactionToggle?.setAttribute("aria-expanded", "false");
      activeReactionPicker = null;
      activeReactionToggle = null;
    }
  }

  function buildReactionControl(joke) {
    const wrapper = createElement("div", "reaction-control");
    const toggleButton = createElement("button", "compact-button");
    toggleButton.type = "button";
    toggleButton.setAttribute("aria-haspopup", "true");
    toggleButton.setAttribute("aria-expanded", "false");
    const picker = createElement("div", "reaction-picker");
    picker.hidden = true;
    picker.id = `reaction-picker-${String(joke?.id || "").replace(/[^a-zA-Z0-9_-]/g, "")}`;
    toggleButton.setAttribute("aria-controls", picker.id);

    const owner = getActiveOwnerIdentity();

    const refreshReactionState = (counts, selectedReaction) => {
      const total = sumReactionCounts(counts);
      const emoji = selectedReaction || "🙂";
      toggleButton.textContent = `React ${emoji} · ${formatCount(total)}`;
      toggleButton.classList.toggle("is-active", Boolean(selectedReaction));
    };

    const initializeFromStore = () => {
      const counts = reactionStore.getCounts(joke);
      const selectedReaction = reactionStore.getUserReaction(joke.id, owner.id);
      refreshReactionState(counts, selectedReaction);
    };

    reactionStore.reactionTypes.forEach((reaction) => {
      const optionButton = createElement("button", "reaction-option");
      optionButton.type = "button";
      optionButton.textContent = reaction;
      optionButton.addEventListener("click", async () => {
        const result = reactionStore.react(joke, owner.id, reaction);
        const selectedReaction = result.userReaction;
        refreshReactionState(result.counts, selectedReaction);
        picker.querySelectorAll(".reaction-option").forEach((node) => {
          node.classList.toggle("is-selected", node.textContent === selectedReaction);
        });
        if (selectedReaction) {
          notificationStore?.add({
            type: "user-activity",
            title: "Reaction saved",
            message: `You reacted ${selectedReaction} to a joke.`,
          });
          const currentUser = getCurrentUser();
          if (currentUser?.id) {
            await syncLikeToProfile(joke.id);
          }
        }
        profileView?.refreshCollections();
        closeActiveReactionPicker();
      });
      picker.appendChild(optionButton);
    });

    toggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = picker.hidden;
      closeActiveReactionPicker();
      picker.hidden = !willOpen;
      toggleButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) {
        activeReactionPicker = picker;
        activeReactionToggle = toggleButton;
      }
    });

    initializeFromStore();
    wrapper.append(toggleButton, picker);
    return wrapper;
  }

  function buildCommentSection(joke, commentButton) {
    const section = createElement("section", "comment-section");
    section.hidden = true;
    section.dataset.open = "false";
    section.id = `comments-${String(joke?.id || "").replace(/[^a-zA-Z0-9_-]/g, "")}`;
    commentButton.setAttribute("aria-controls", section.id);
    commentButton.setAttribute("aria-expanded", "false");

    const list = createElement("div", "comment-list");
    const form = createElement("form", "comment-form");
    const input = createElement("input", "comment-input");
    input.type = "text";
    input.placeholder = "Write a comment...";
    input.maxLength = 280;
    input.required = true;

    const submit = createElement("button", "comment-submit");
    submit.type = "submit";
    submit.textContent = "Post";
    form.append(input, submit);

    const renderComments = () => {
      list.innerHTML = "";
      const comments = commentStore.getListForJoke(joke.id);
      if (!comments.length) {
        const empty = createElement("p", "comment-empty");
        empty.textContent = "No comments yet.";
        list.appendChild(empty);
      } else {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < comments.length; i += 1) {
          const item = createElement("article", "comment-item");
          const author = createElement("strong", "comment-author");
          author.textContent = comments[i].userName || "Guest";
          const text = createElement("p", "comment-text");
          text.textContent = comments[i].text;
          item.append(author, text);
          fragment.appendChild(item);
        }
        list.appendChild(fragment);
      }
      updateCommentButtonText(commentButton, joke.id);
      profileView?.refreshCollections();
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) {
        return;
      }
      const author = getActiveOwnerIdentity();
      const comment = commentStore.addComment(joke, author, text);
      if (!comment) {
        toast?.show("Comment could not be added.", "error");
        return;
      }
      input.value = "";
      renderComments();
      notificationStore?.add({
        type: text.includes("@") ? "comment-reply" : "user-activity",
        title: text.includes("@") ? "Reply activity" : "Comment posted",
        message: text.includes("@")
          ? "A reply style comment was added."
          : "Your comment was posted.",
      });
    });

    section.append(list, form);
    section.renderComments = renderComments;
    return section;
  }

  function buildJokeCard(joke) {
    const card = createElement("article", "joke-card");
    card.dataset.jokeId = joke.id;
    const normalizedJokeText = normalizeJokeText(joke.text) || String(joke.text || "");

    const header = createElement("header", "joke-card-header");
    const source = createElement("span", "joke-source");
    source.textContent = getSourceLabel(joke.sourceType || joke.source);
    const meta = createElement("span", "joke-meta");
    meta.textContent = `#${joke.category || "random"}`;
    header.append(source, meta);

    const content = createElement("p", "joke-text");
    content.textContent = normalizedJokeText;

    const footer = createElement("div", "joke-footer");
    const footerMain = createElement("div", "joke-footer-main");
    const leftActions = createElement("div", "joke-left-actions");
    const tools = createElement("div", "joke-tools");

    const reactionControl = buildReactionControl(joke);

    const commentButton = createElement("button", "compact-button");
    commentButton.type = "button";
    updateCommentButtonText(commentButton, joke.id);
    const commentSection = buildCommentSection(joke, commentButton);
    commentButton.addEventListener("click", () => {
      const nextOpen = commentSection.dataset.open !== "true";
      commentSection.dataset.open = nextOpen ? "true" : "false";
      commentSection.hidden = !nextOpen;
      commentButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      if (nextOpen && typeof commentSection.renderComments === "function") {
        commentSection.renderComments();
      }
    });

    const copyButton = createElement("button", "action-button");
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      try {
        await copyToClipboard(normalizedJokeText);
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
            text: normalizedJokeText,
          });
        } else {
          await copyToClipboard(normalizedJokeText);
        }
        toast?.show("Ready to share.");
      } catch (error) {
        toast?.show("Share canceled.", "error");
      }
    });

    const imageButton = createElement("button", "action-button");
    imageButton.type = "button";
    imageButton.textContent = "Image";
    imageButton.addEventListener("click", async () => {
      try {
        await exportJokeAsImage({
          ...joke,
          text: normalizedJokeText,
        });
        toast?.show("Image exported.");
      } catch (error) {
        toast?.show("Image export failed.", "error");
      }
    });

    const favoriteButton = createElement("button", "action-button");
    favoriteButton.type = "button";
    setButtonSavedState(favoriteButton, favoritesStore.has(joke.id));
    favoriteButton.addEventListener("click", () => {
      const result = favoritesStore.toggle({
        id: joke.id,
        text: normalizedJokeText,
        source: joke.source,
        sourceType: joke.sourceType,
        category: joke.category,
        language: joke.language,
        tags: joke.tags,
        createdAt: joke.createdAt,
      });
      setButtonSavedState(favoriteButton, result.saved);
      if (result.saved) {
        syncFavoriteToProfile(joke);
      }
      profileView?.refreshCollections();
      toast?.show(result.saved ? "Saved locally." : "Removed from saved.");
    });

    leftActions.append(reactionControl, commentButton);
    tools.append(copyButton, shareButton, imageButton, favoriteButton);
    footerMain.append(leftActions, tools);
    footer.append(footerMain, commentSection);

    card.append(header, content, footer);
    return card;
  }

  function appendJokesToFeed(jokes = [], { append = true, trackViews = false } = {}) {
    if (!feedList) {
      return;
    }
    if (!append) {
      feedList.innerHTML = "";
    }
    if (!jokes.length) {
      return;
    }
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < jokes.length; i += 1) {
      const joke = jokes[i];
      const card = buildJokeCard(joke);
      fragment.appendChild(card);
      if (trackViews) {
        trackJokeView(joke);
      }
    }
    feedList.appendChild(fragment);
  }

  function renderSearchMetadata() {
    if (!searchMeta) {
      return;
    }
    if (!searchMode || !searchQuery) {
      searchMeta.textContent = t(
        "search.meta.default",
        "Mixing AI, user, trending, recent, and random jokes."
      );
      return;
    }
    searchMeta.textContent = `${formatCount(searchResults.length)} result${
      searchResults.length === 1 ? "" : "s"
    } for "${searchQuery}"`;
  }

  function filterUniqueMainFeed(rawJokes = []) {
    const unique = [];
    const batchIds = new Set();
    for (let i = 0; i < rawJokes.length; i += 1) {
      const item = rawJokes[i];
      const id = String(item?.id || "").trim();
      if (!id) {
        continue;
      }
      if (batchIds.has(id) || isInRecentFeedWindow(id)) {
        continue;
      }
      if (!duplicateTracker.markDisplayedJoke(item)) {
        continue;
      }
      batchIds.add(id);
      unique.push(item);
    }
    return unique;
  }

  async function expandSearchPool() {
    try {
      const extra = await feedComposer.nextBatch(
        SEARCH_BATCH_SIZE,
        (id, joke) => knownById.has(id) || duplicateTracker.hasJoke(joke || { id })
      );
      const fresh = extra.filter((joke) => joke?.id && !knownById.has(joke.id));
      if (!fresh.length) {
        return false;
      }
      rememberJokes(fresh);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function loadMoreSearch() {
    if (!searchMode || !searchQuery) {
      return;
    }
    if (searchOffset >= searchResults.length) {
      const expanded = await expandSearchPool();
      if (expanded) {
        searchResults = await searchService.search(searchQuery, { useServer: false });
        renderSearchMetadata();
      }
    }
    const nextChunk = searchResults.slice(searchOffset, searchOffset + SEARCH_BATCH_SIZE);
    if (!nextChunk.length) {
      if (!feedList || feedList.children.length === 0) {
        setEmptyVisible(true);
      }
      return;
    }
    appendJokesToFeed(nextChunk, { append: true, trackViews: false });
    searchOffset += nextChunk.length;
    setEmptyVisible(false);
  }

  async function applySearch(queryText = "") {
    searchQuery = String(queryText || "").trim();
    if (!searchQuery) {
      searchMode = false;
      searchResults = [];
      searchOffset = 0;
      appendJokesToFeed(mainFeedJokes, { append: false, trackViews: false });
      setEmptyMessage(defaultEmptyMessage);
      setEmptyVisible(mainFeedJokes.length === 0);
      renderSearchMetadata();
      return;
    }
    searchMode = true;
    setFooterLoading(false);
    setSkeletonVisible(false);
    searchResults = await searchService.search(searchQuery, { useServer: false });
    searchOffset = 0;
    appendJokesToFeed([], { append: false });
    if (!searchResults.length) {
      const expanded = await expandSearchPool();
      if (expanded) {
        searchResults = await searchService.search(searchQuery, { useServer: false });
      }
    }
    renderSearchMetadata();
    await loadMoreSearch();
  }

  function scheduleSearch() {
    if (searchTimer) {
      window.clearTimeout(searchTimer);
    }
    searchTimer = window.setTimeout(() => {
      applySearch(searchInput?.value || "").catch(() => {
        toast?.show("Search failed. Please try again.", "error");
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  async function loadMoreFeed() {
    const initialLoad = !feedList || feedList.children.length === 0;
    let loadError = null;
    if (initialLoad) {
      renderSkeletonCards(3);
      setSkeletonVisible(true);
    } else {
      setFooterLoading(true);
    }

    let collected = [];
    try {
      const next = await feedComposer.nextBatch(
        VISIBLE_BATCH_SIZE,
        (id, joke) =>
          duplicateTracker.hasJoke(joke || { id }) ||
          isInRecentFeedWindow(id)
      );
      collected = filterUniqueMainFeed(next);
    } catch (error) {
      collected = [];
      loadError = error;
    }

    if (collected.length < 2) {
      try {
        duplicateTracker.reset();
        for (let i = 0; i < collected.length; i += 1) {
          duplicateTracker.markDisplayedJoke(collected[i]);
        }
        const retryBatch = await feedComposer.nextBatch(
          VISIBLE_BATCH_SIZE,
          (id) => isInRecentFeedWindow(id)
        );
        const retryUnique = filterUniqueMainFeed(retryBatch);
        if (retryUnique.length) {
          const already = new Set(collected.map((entry) => entry.id));
          for (let i = 0; i < retryUnique.length; i += 1) {
            if (already.has(retryUnique[i].id)) {
              continue;
            }
            already.add(retryUnique[i].id);
            collected.push(retryUnique[i]);
          }
        }
      } catch (error) {
        loadError = loadError || error;
        // Keep feed resilient if retry path fails.
      }
    }

    if (collected.length) {
      mainFeedJokes.push(...collected);
      rememberJokes(collected);
      appendJokesToFeed(collected, { append: true, trackViews: true });
      setEmptyVisible(false);

      const prefs = preferencesStore?.get?.() || { notifications: { newJokes: false } };
      if (prefs.notifications?.newJokes) {
        notificationStore?.add({
          type: "new-jokes",
          title: "New jokes loaded",
          message: `${collected.length} fresh jokes were added to your feed.`,
        });
      }
    } else if (!feedList || feedList.children.length === 0) {
      setEmptyMessage(loadError ? FEED_LOAD_ERROR_MESSAGE : defaultEmptyMessage);
      setEmptyVisible(true);
      if (loadError) {
        toast?.show(FEED_LOAD_ERROR_MESSAGE, "error");
      }
    }
  }

  async function loadMore() {
    if (loading) {
      return;
    }
    loading = true;
    setFeedBusy(true);
    setEmptyVisible(false);
    try {
      if (searchMode) {
        await loadMoreSearch();
        return;
      }
      await loadMoreFeed();
    } catch (error) {
      if (!feedList || feedList.children.length === 0) {
        setEmptyMessage(FEED_LOAD_ERROR_MESSAGE);
        setEmptyVisible(true);
      }
      toast?.show(FEED_LOAD_ERROR_MESSAGE, "error");
    } finally {
      loading = false;
      setSkeletonVisible(false);
      setFooterLoading(false);
      setFeedBusy(false);
    }
  }

  function onIntersect(entries) {
    const entry = entries.find((item) => item.isIntersecting);
    if (!entry) {
      return;
    }
    loadMore();
  }

  function startObserver() {
    if (!sentinel || observer) {
      return;
    }
    observer = new IntersectionObserver(onIntersect, {
      root: null,
      rootMargin: "900px 0px 900px 0px",
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

  function bindGlobalHandlers() {
    searchInput?.addEventListener("input", () => {
      scheduleSearch();
    });
    searchClear?.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
      }
      applySearch("").catch(() => {
        toast?.show("Search reset failed. Please try again.", "error");
      });
    });
    document.addEventListener("click", () => {
      closeActiveReactionPicker();
    });
  }

  function primeComposerInBackground() {
    if (primingTask) {
      return primingTask;
    }
    primed = true;
    primingTask = feedComposer
      .prime()
      .then(() => {
        rememberJokes(feedComposer.getCatalogSnapshot());
      })
      .catch(() => {
        // Keep initial rendering resilient even if priming fails.
      })
      .finally(() => {
        primingTask = null;
      });
    return primingTask;
  }

  async function activate() {
    if (!started) {
      started = true;
      await duplicateTracker.hydrateFromFutureStorage();
      bindGlobalHandlers();
      if (!primed) {
        primeComposerInBackground();
      }
      startObserver();
      renderSearchMetadata();
      await loadMore();
      return;
    }
    if (!primed) {
      primeComposerInBackground();
    }
    startObserver();
    if (feedList && feedList.children.length < 3 && !searchMode) {
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
    indexJokes(jokes = []) {
      rememberJokes(jokes);
    },
    addUserSubmission(joke) {
      if (!joke) {
        return;
      }
      feedComposer.injectUserJoke(joke);
      rememberJokes([joke]);
      ensureMainFeedJoke(joke);
    },
    setSearchValue(value = "") {
      if (searchInput) {
        searchInput.value = String(value);
      }
      applySearch(value).catch(() => {
        toast?.show("Search failed. Please try again.", "error");
      });
    },
  };
}
