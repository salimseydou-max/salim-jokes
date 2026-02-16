import { createDuplicateTracker } from "../services/duplicateTracker.js";
import {
  syncFavoriteToProfile,
  syncLikeToProfile,
  trackJokeView,
} from "../services/jokesApi.js";
import { exportJokeAsImage } from "../services/imageExport.js";

const VISIBLE_BATCH_SIZE = 5;
const SEARCH_RENDER_LIMIT = 36;
const SEARCH_DEBOUNCE_MS = 140;

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

function formatCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
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
  const feedComposer = options.feedComposer;
  const searchService = options.searchService;
  const favoritesStore = options.favoritesStore;
  const reactionStore = options.reactionStore;
  const commentStore = options.commentStore;
  const notificationStore = options.notificationStore;
  const preferencesStore = options.preferencesStore;
  const profileView = options.profileView;
  const getViewerId = typeof options.getViewerId === "function" ? options.getViewerId : () => "guest";
  const getCurrentUser =
    typeof options.getCurrentUser === "function" ? options.getCurrentUser : () => null;

  const searchInput = root?.querySelector("[data-feed-search-input]");
  const searchCategory = root?.querySelector("[data-feed-search-category]");
  const searchClear = root?.querySelector("[data-feed-search-clear]");
  const searchMeta = root?.querySelector("[data-feed-search-meta]");
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

  let started = false;
  let primed = false;
  let loading = false;
  let observer = null;
  let searchTimer = 0;
  let searchMode = false;
  const mainFeedJokes = [];
  const knownById = new Map();

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

  function getActiveOwnerIdentity() {
    const currentUser = getCurrentUser();
    if (currentUser?.id) {
      return {
        id: currentUser.id,
        displayName: currentUser.displayName || "User",
      };
    }
    const viewerId = getViewerId();
    return {
      id: viewerId,
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

  function updateCommentButtonText(button, jokeId) {
    if (!button) {
      return;
    }
    const count = commentStore?.getCountForJoke(jokeId) || 0;
    button.textContent = `Comments ${formatCount(count)}`;
  }

  function buildReactionBar(joke) {
    const bar = createElement("div", "reaction-bar");
    const owner = getActiveOwnerIdentity();
    const reactionCounts = reactionStore.getCounts(joke);
    const userReaction = reactionStore.getUserReaction(joke.id, owner.id);
    const reactionButtons = [];

    const updateReactionButtons = (counts, selectedReaction) => {
      for (let i = 0; i < reactionButtons.length; i += 1) {
        const config = reactionButtons[i];
        const nextCount = Math.max(0, Number(counts?.[config.reaction]) || 0);
        config.button.classList.toggle("is-active", selectedReaction === config.reaction);
        config.button.innerHTML =
          `<span class="emoji">${config.reaction}</span><span class="emoji-count">${formatCount(nextCount)}</span>`;
      }
    };

    reactionStore.reactionTypes.forEach((reaction) => {
      const button = createElement("button", "reaction-button");
      button.type = "button";
      button.dataset.reaction = reaction;
      button.addEventListener("click", async () => {
        const result = reactionStore.react(joke, owner.id, reaction);
        updateReactionButtons(result.counts, result.userReaction);
        profileView?.refreshCollections();
        if (result.userReaction) {
          notificationStore?.add({
            type: "user-activity",
            title: "Reaction saved",
            message: `You reacted ${result.userReaction} to a joke.`,
          });
          const currentUser = getCurrentUser();
          if (currentUser?.id) {
            await syncLikeToProfile(joke.id);
          }
        }
      });
      reactionButtons.push({
        reaction,
        button,
      });
      bar.appendChild(button);
    });

    updateReactionButtons(reactionCounts, userReaction);
    return bar;
  }

  function buildCommentSection(joke, commentButton) {
    const section = createElement("section", "comment-section");
    section.hidden = true;
    section.dataset.open = "false";

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
      const nextType = text.includes("@") ? "comment-reply" : "user-activity";
      notificationStore?.add({
        type: nextType,
        title: nextType === "comment-reply" ? "Reply activity" : "Comment posted",
        message:
          nextType === "comment-reply"
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

    const header = createElement("header", "joke-card-header");
    const source = createElement("span", "joke-source");
    source.textContent = getSourceLabel(joke.sourceType || joke.source);
    const meta = createElement("span", "joke-meta");
    meta.textContent = `#${joke.category || "random"}`;
    header.append(source, meta);

    const content = createElement("p", "joke-text");
    content.textContent = joke.text;

    const actionRow = createElement("div", "joke-action-row");
    const reactionBar = buildReactionBar(joke);
    const actions = createElement("div", "joke-actions compact");

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

    const imageButton = createElement("button", "action-button");
    imageButton.type = "button";
    imageButton.textContent = "Image";
    imageButton.addEventListener("click", async () => {
      try {
        await exportJokeAsImage(joke);
        toast?.show("Image exported.");
      } catch (error) {
        toast?.show("Image export failed.", "error");
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

    const commentButton = createElement("button", "action-button");
    commentButton.type = "button";
    updateCommentButtonText(commentButton, joke.id);
    const commentSection = buildCommentSection(joke, commentButton);
    commentButton.addEventListener("click", () => {
      const nextOpen = commentSection.dataset.open !== "true";
      commentSection.dataset.open = nextOpen ? "true" : "false";
      commentSection.hidden = !nextOpen;
      if (nextOpen && typeof commentSection.renderComments === "function") {
        commentSection.renderComments();
      }
    });

    actions.append(copyButton, shareButton, imageButton, favoriteButton, commentButton);
    actionRow.append(reactionBar, actions);
    card.append(header, content, actionRow, commentSection);
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

  function filterUniqueMainFeed(rawJokes = []) {
    const unique = [];
    for (let i = 0; i < rawJokes.length; i += 1) {
      const item = rawJokes[i];
      const id = String(item?.id || "").trim();
      if (!id) {
        continue;
      }
      if (!duplicateTracker.markDisplayed(id) || mainFeedJokes.some((entry) => entry.id === id)) {
        continue;
      }
      unique.push(item);
    }
    return unique;
  }

  function renderSearchMetadata(query, count) {
    if (!searchMeta) {
      return;
    }
    if (!query) {
      searchMeta.textContent = "Mixing AI, user, trending, recent, and random jokes.";
      return;
    }
    searchMeta.textContent = `${formatCount(count)} result${count === 1 ? "" : "s"} for "${query}"`;
  }

  async function runSearchNow() {
    const query = searchInput?.value?.trim() || "";
    const category = searchCategory?.value || "all";
    if (!query) {
      searchMode = false;
      renderSearchMetadata("", 0);
      appendJokesToFeed(mainFeedJokes, { append: false, trackViews: false });
      setEmptyVisible(mainFeedJokes.length === 0);
      startObserver();
      return;
    }
    searchMode = true;
    stopObserver();
    setFooterLoading(false);
    setSkeletonVisible(false);
    const results = await searchService.search(query, {
      category,
      useServer: false,
    });
    const sliced = results.slice(0, SEARCH_RENDER_LIMIT);
    appendJokesToFeed(sliced, { append: false, trackViews: false });
    setEmptyVisible(sliced.length === 0);
    renderSearchMetadata(query, results.length);
  }

  function scheduleSearch() {
    if (searchTimer) {
      window.clearTimeout(searchTimer);
    }
    searchTimer = window.setTimeout(() => {
      runSearchNow();
    }, SEARCH_DEBOUNCE_MS);
  }

  async function loadMore() {
    if (searchMode) {
      return;
    }
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

    let collected = [];
    try {
      const next = await feedComposer.nextBatch(
        VISIBLE_BATCH_SIZE,
        (id) => duplicateTracker.has(id) || mainFeedJokes.some((entry) => entry.id === id)
      );
      collected = filterUniqueMainFeed(next);
    } catch (error) {
      collected = [];
    }

    const toRender = collected.slice(0, VISIBLE_BATCH_SIZE);
    if (toRender.length) {
      mainFeedJokes.push(...toRender);
      rememberJokes(toRender);
      appendJokesToFeed(toRender, { append: true, trackViews: true });
      setEmptyVisible(false);
      const prefs = preferencesStore?.get?.() || { notifications: { newJokes: false } };
      if (prefs.notifications?.newJokes) {
        notificationStore?.add({
          type: "new-jokes",
          title: "New jokes loaded",
          message: `${toRender.length} fresh jokes were added to your feed.`,
        });
      }
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
      if (!primed) {
        primed = true;
        await feedComposer.prime();
        rememberJokes(feedComposer.getCatalogSnapshot());
      }
      startObserver();
      await loadMore();
      renderSearchMetadata("", 0);
      return;
    }
    if (!primed) {
      primed = true;
      await feedComposer.prime();
      rememberJokes(feedComposer.getCatalogSnapshot());
    }
    startObserver();
    if (feedList && feedList.children.length < 3) {
      loadMore();
    }
  }

  function deactivate() {
    stopObserver();
  }

  function init() {
    searchInput?.addEventListener("input", () => {
      scheduleSearch();
    });
    searchCategory?.addEventListener("change", () => {
      scheduleSearch();
    });
    searchClear?.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
      }
      if (searchCategory) {
        searchCategory.value = "all";
      }
      scheduleSearch();
    });
  }

  init();

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
    },
  };
}
