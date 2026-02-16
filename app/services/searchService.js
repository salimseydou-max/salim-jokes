function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s#-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(query) {
  const normalized = normalizeText(query);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildSearchDocument(joke) {
  if (!joke || !joke.id) {
    return null;
  }
  const tags = Array.isArray(joke.tags) ? joke.tags : [];
  const normalizedTags = tags.map((tag) => normalizeText(tag)).filter(Boolean);
  const category = normalizeText(joke.category || "");
  const sourceType = normalizeText(joke.sourceType || joke.source || "");
  const text = normalizeText(joke.text || "");
  const searchable = [text, category, sourceType, ...normalizedTags].join(" ");
  return {
    id: String(joke.id),
    joke,
    searchable,
    text,
    category,
    sourceType,
    tags: normalizedTags,
  };
}

function scoreDocument(document, tokens, selectedCategory) {
  if (!document || !tokens.length) {
    return 0;
  }
  if (selectedCategory && selectedCategory !== "all" && document.category !== selectedCategory) {
    return 0;
  }
  let score = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) {
      continue;
    }
    if (document.text.includes(token)) {
      score += 5;
    }
    if (document.category.includes(token)) {
      score += 4;
    }
    if (document.sourceType.includes(token)) {
      score += 3;
    }
    if (document.tags.some((tag) => tag.includes(token))) {
      score += 4;
    }
    if (document.searchable.includes(token)) {
      score += 1;
    }
  }
  return score;
}

export function createSearchService(options = {}) {
  const docsById = new Map();
  const serverAdapter =
    options.serverAdapter && typeof options.serverAdapter.search === "function"
      ? options.serverAdapter
      : null;

  function indexJokes(jokes = []) {
    for (let i = 0; i < jokes.length; i += 1) {
      const document = buildSearchDocument(jokes[i]);
      if (!document) {
        continue;
      }
      docsById.set(document.id, document);
    }
  }

  function searchLocal(query, options = {}) {
    const tokens = tokenizeQuery(query);
    if (!tokens.length) {
      return [];
    }
    const selectedCategory = normalizeText(options.category || "all") || "all";
    const ranked = [];
    docsById.forEach((document) => {
      const score = scoreDocument(document, tokens, selectedCategory);
      if (score <= 0) {
        return;
      }
      ranked.push({
        score,
        joke: document.joke,
      });
    });
    ranked.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const leftTime = Date.parse(left.joke.createdAt || "") || 0;
      const rightTime = Date.parse(right.joke.createdAt || "") || 0;
      return rightTime - leftTime;
    });
    return ranked.map((entry) => entry.joke);
  }

  async function search(query, options = {}) {
    const localResults = searchLocal(query, options);
    if (!serverAdapter || options.useServer !== true) {
      return localResults;
    }
    try {
      const serverResults = await serverAdapter.search(query, options);
      if (!Array.isArray(serverResults) || !serverResults.length) {
        return localResults;
      }
      indexJokes(serverResults);
      const merged = [...serverResults, ...localResults];
      const seen = new Set();
      return merged.filter((joke) => {
        const id = String(joke?.id || "").trim();
        if (!id || seen.has(id)) {
          return false;
        }
        seen.add(id);
        return true;
      });
    } catch (error) {
      return localResults;
    }
  }

  return {
    indexJokes,
    search,
    searchLocal,
  };
}
