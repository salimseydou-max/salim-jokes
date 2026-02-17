import { getOpenRouterConfig } from "../config/ai.js";

const FALLBACK_QUICK_JOKES = [
  "I told my calendar I needed a break. It scheduled one immediately.",
  "Why do programmers love dark mode? Because light attracts bugs.",
  "My WiFi apologized today. It said it was having a slow morning.",
];

const FALLBACK_STORY_JOKES = [
  "I opened my fridge for a midnight snack.\n\nThe leftover pizza looked at me like a judge at a talent show.\n\nI ate one slice and called it emotional support.",
  "I tried to clean my desk before working.\n\nI found three pens, two old chargers, and a note saying \"start tomorrow.\"\n\nSo I cleaned one corner and celebrated with coffee.",
  "I asked my phone battery why it disappears so fast.\n\nIt said I keep opening seven apps just to check one message.\n\nFair point. We agreed on power-saving mode.",
  "I joined an online yoga class to relax.\n\nMy camera stayed off, my cat walked across the keyboard, and the instructor said \"great breathing\" to someone else.\n\nI still counted it as inner peace with technical support.",
  "I promised myself I would wake up early and be productive.\n\nAt 6:00 a.m. my alarm sounded heroic, and at 6:02 I negotiated for five more minutes.\n\nBy 7:30 I had won the negotiation and lost the productivity.",
  "I tried meal prep to become an organized adult.\n\nBy Tuesday every container looked identical, and I played food roulette at lunch.\n\nGood news: I discovered mystery pasta pairs well with optimism.",
  "I opened ten tabs to finish one task faster.\n\nTab seven was a video about penguins, tab eight was a recipe I cannot cook, and tab nine sold lamps I do not need.\n\nThe task is still open, but now I am informed and well-lit.",
];

const FALLBACK_QUICK_JOKES_EXTRA = [
  "My to-do list and I had a meeting; we both agreed to reschedule.",
  "I asked my coffee for motivation, and it said, \"First sip, then speeches.\"",
  "My phone autocorrects \"gym\" to \"nap\" and honestly understands me.",
  "I started budgeting today; apparently snacks are an emotional utility bill.",
];
const ALL_FALLBACK_QUICK_JOKES = [...FALLBACK_QUICK_JOKES, ...FALLBACK_QUICK_JOKES_EXTRA];
const ALL_FALLBACK_STORY_JOKES = FALLBACK_STORY_JOKES;
const recentFallbackHistory = [];
const RECENT_FALLBACK_LIMIT = 10;

const BLOCKED_PATTERNS = [
  /\b(hate|kill|murder|rape|terror|nazi|racist|genocide|porn|nsfw|sex|explicit)\b/i,
  /\b(idiot|stupid|dumb|moron|loser|worthless)\b/i,
  /\b(كراهية|قتل|اغتصاب|اباحية|عنف|اساءة|غبي|أحمق)\b/i,
];
const MIN_WORDS = 8;
const MAX_WORDS = 95;
const MAX_QUICK_WORDS = 26;
const MIN_STORY_WORDS = 22;
const SIMILARITY_THRESHOLD = 0.66;
const QUALITY_THRESHOLD_QUICK = 60;
const QUALITY_THRESHOLD_STORY = 66;
const PROMPT_QUALITY_REQUIREMENTS =
  "Add duplicate detection and semantic similarity checking to prevent repeated or nearly identical jokes. " +
  "Use content validation to ensure each joke has clear structure, logical meaning, and a proper punchline. " +
  "Implement quality scoring to filter out low-effort, confusing, or boring jokes. " +
  "Require variety in joke topics, formats, and writing styles to keep content fresh and entertaining. " +
  "If a joke fails duplication, quality, or clarity checks, automatically replace it with a new unique joke.";

function pickFallbackJoke() {
  const remember = (value) => {
    const normalized = sanitizeTextWithLines(value).toLowerCase();
    if (!normalized) {
      return;
    }
    const existingIndex = recentFallbackHistory.indexOf(normalized);
    if (existingIndex >= 0) {
      recentFallbackHistory.splice(existingIndex, 1);
    }
    recentFallbackHistory.unshift(normalized);
    if (recentFallbackHistory.length > RECENT_FALLBACK_LIMIT) {
      recentFallbackHistory.splice(RECENT_FALLBACK_LIMIT);
    }
  };
  const pickFromPool = (pool) => {
    const fresh = pool.filter((joke) => !recentFallbackHistory.includes(sanitizeTextWithLines(joke).toLowerCase()));
    const source = fresh.length ? fresh : pool;
    const index = Math.floor(Math.random() * source.length);
    const selected = source[index] || source[0];
    remember(selected);
    return selected;
  };
  const style = Math.random() < 0.4 ? "story" : "quick";
  if (style === "story") {
    const selected = pickFromPool(ALL_FALLBACK_STORY_JOKES);
    return {
      joke: selected || ALL_FALLBACK_STORY_JOKES[0],
      style: "story",
    };
  }
  const selected = pickFromPool(ALL_FALLBACK_QUICK_JOKES);
  return {
    joke: selected || ALL_FALLBACK_QUICK_JOKES[0],
    style: "quick",
  };
}

function normalizeStyle(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "quick" || normalized === "short") {
    return "quick";
  }
  if (normalized === "story" || normalized === "long") {
    return "story";
  }
  return "mixed";
}

function pickTargetStyle(style, attempt) {
  if (style === "quick" || style === "story") {
    return style;
  }
  return attempt % 3 === 1 ? "story" : "quick";
}

function sanitizeTextWithLines(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function containsBlockedContent(text) {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

function tokenizeForSimilarity(text) {
  return sanitizeTextWithLines(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff\s]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildTokenSignature(text) {
  return new Set(tokenizeForSimilarity(text));
}

function buildTrigramSignature(text) {
  const normalized = sanitizeTextWithLines(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff\s]/gi, " ")
    .replace(/\s+/g, "_");
  const signature = new Set();
  if (normalized.length < 3) {
    return signature;
  }
  for (let i = 0; i < normalized.length - 2; i += 1) {
    signature.add(normalized.slice(i, i + 3));
  }
  return signature;
}

function getSetSimilarity(left, right) {
  if (!left.size || !right.size) {
    return 0;
  }
  let overlap = 0;
  left.forEach((item) => {
    if (right.has(item)) {
      overlap += 1;
    }
  });
  const union = new Set([...left, ...right]).size;
  return union ? overlap / union : 0;
}

function isSemanticallySimilar(text, existing = [], threshold = SIMILARITY_THRESHOLD) {
  const normalized = sanitizeTextWithLines(text).toLowerCase();
  if (!normalized) {
    return true;
  }
  const tokenSignature = buildTokenSignature(normalized);
  const trigramSignature = buildTrigramSignature(normalized);
  for (let i = 0; i < existing.length; i += 1) {
    const current = sanitizeTextWithLines(existing[i]).toLowerCase();
    if (!current) {
      continue;
    }
    if (current === normalized) {
      return true;
    }
    const containmentRatio = Math.min(current.length, normalized.length) / Math.max(current.length, normalized.length);
    if (containmentRatio >= 0.72 && (current.includes(normalized) || normalized.includes(current))) {
      return true;
    }
    const tokenSimilarity = getSetSimilarity(tokenSignature, buildTokenSignature(current));
    const trigramSimilarity = getSetSimilarity(trigramSignature, buildTrigramSignature(current));
    const blended = tokenSimilarity * 0.68 + trigramSimilarity * 0.32;
    if (blended >= threshold) {
      return true;
    }
  }
  return false;
}

function hasPunchlineSignal(text) {
  if (!text) {
    return false;
  }
  return (
    /[?؟]/.test(text) ||
    /Q:|A:|Setup:|Punchline:|س:|ج:|P:|R:|Tambaya|Amsa/i.test(text) ||
    /\b(but|then|so|instead|finally|turns out|suddenly|except)\b/i.test(text) ||
    /\b(mais|puis|alors|finalement|sauf que)\b/i.test(text) ||
    /\b(pero|luego|entonces|al final|resulta)\b/i.test(text) ||
    /\b(mas|depois|entao|no fim|acontece)\b/i.test(text) ||
    /\b(لكن|ثم|فجأة|في النهاية|اتضح)\b/i.test(text)
  );
}

function scoreJokeQuality(text, style) {
  const safe = sanitizeTextWithLines(text);
  const words = countWords(safe);
  const lines = safe.split("\n").map((line) => line.trim()).filter(Boolean).length;
  const tokens = tokenizeForSimilarity(safe);
  const diversity = tokens.length ? new Set(tokens).size / tokens.length : 0;
  let score = 0;

  if (!safe || containsBlockedContent(safe)) {
    return 0;
  }

  if (words >= MIN_WORDS && words <= MAX_WORDS) {
    score += 22;
  } else {
    score -= 20;
  }

  if (style === "story") {
    score += words >= MIN_STORY_WORDS && lines >= 3 ? 26 : -24;
  } else if (style === "quick") {
    score += words <= MAX_QUICK_WORDS && lines <= 2 ? 18 : -16;
  } else {
    score += lines >= 2 ? 12 : 8;
  }

  if (diversity >= 0.58) {
    score += 20;
  } else if (diversity >= 0.48) {
    score += 12;
  } else {
    score -= 14;
  }

  if (hasPunchlineSignal(safe)) {
    score += 20;
  } else if (words >= 14 && lines >= 2) {
    score += 8;
  } else {
    score -= 14;
  }

  if (/[.!?؟]$/.test(safe)) {
    score += 6;
  }
  if (/(really really|very very|ha ha ha|lol lol)/i.test(safe)) {
    score -= 16;
  }
  if (/^(nice|good|great|okay|calm|cool)\b/i.test(safe) && words < 12) {
    score -= 16;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isAcceptableJoke(text, style) {
  const safe = sanitizeTextWithLines(text);
  if (!safe) {
    return false;
  }
  if (containsBlockedContent(safe)) {
    return false;
  }
  const score = scoreJokeQuality(safe, style);
  const threshold = style === "story" ? QUALITY_THRESHOLD_STORY : QUALITY_THRESHOLD_QUICK;
  return score >= threshold;
}

function buildPromptForStyle(style) {
  if (style === "story") {
    return (
      "Create one creative, clean, engaging multi-line storytelling joke. " +
      "Use exactly 3 short paragraphs with a clear setup and punchline. " +
      "Use understandable language, avoid confusing lines, and keep the payoff clear. " +
      PROMPT_QUALITY_REQUIREMENTS + " " +
      "No offensive, disrespectful, sexual, violent, hateful, or inappropriate content."
    );
  }
  return (
    "Create one creative, clean, engaging quick punchline joke in one line. " +
    "Keep it concise but never low-effort: minimum 8 words, clear setup, and a punchline. " +
    PROMPT_QUALITY_REQUIREMENTS + " " +
    "No offensive, disrespectful, sexual, violent, hateful, or inappropriate content."
  );
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 8000));
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestedStyle =
    req.method === "POST"
      ? normalizeStyle(req?.body?.style)
      : normalizeStyle(req?.query?.style);
  const config = getOpenRouterConfig();
  if (!config.apiKey) {
    const fallback = pickFallbackJoke();
    return res.status(200).json({
      joke: fallback.joke,
      fallback: true,
      style: fallback.style,
      error: "OPENROUTER_API_KEY is not configured.",
    });
  }

  try {
    const attemptedCandidates = [];
    const baselineCatalog = [...ALL_FALLBACK_QUICK_JOKES, ...ALL_FALLBACK_STORY_JOKES];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const targetStyle = pickTargetStyle(requestedStyle, attempt);
      const timeout = createTimeoutSignal(config.timeoutMs);
      try {
        const headers = {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        };
        if (config.appUrl) {
          headers["HTTP-Referer"] = config.appUrl;
        }
        if (config.appName) {
          headers["X-Title"] = config.appName;
        }

        const response = await fetch(config.apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: config.model,
            temperature: 0.88,
            messages: [
              {
                role: "user",
                content: buildPromptForStyle(targetStyle),
              },
            ],
          }),
          signal: timeout.signal,
        });
        if (!response.ok) {
          throw new Error(`OpenRouter request failed: ${response.status}`);
        }
        const data = await response.json();
        const joke = sanitizeTextWithLines(data?.choices?.[0]?.message?.content || "");
        if (!isAcceptableJoke(joke, targetStyle)) {
          attemptedCandidates.push(joke);
          continue;
        }
        if (isSemanticallySimilar(joke, baselineCatalog, SIMILARITY_THRESHOLD)) {
          attemptedCandidates.push(joke);
          continue;
        }
        if (isSemanticallySimilar(joke, attemptedCandidates, SIMILARITY_THRESHOLD)) {
          attemptedCandidates.push(joke);
          continue;
        }
        return res.status(200).json({
          joke,
          fallback: false,
          style: targetStyle,
        });
      } finally {
        timeout.clear();
      }
    }
  } catch (error) {
    console.error("GET /api/generateJoke failed:", error);
  }
  const fallback = pickFallbackJoke();
  return res.status(200).json({
    joke: fallback.joke,
    fallback: true,
    style: fallback.style,
    error: "Failed to generate joke from AI provider.",
  });
}
