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
];

const BLOCKED_PATTERNS = [
  /\b(hate|kill|murder|rape|terror|nazi|racist|genocide|porn|nsfw|sex|explicit)\b/i,
  /\b(idiot|stupid|dumb|moron|loser|worthless)\b/i,
  /\b(كراهية|قتل|اغتصاب|اباحية|عنف|اساءة|غبي|أحمق)\b/i,
];
const MIN_WORDS = 5;
const MAX_WORDS = 90;
const MAX_QUICK_WORDS = 24;
const MIN_STORY_WORDS = 18;

function pickFallbackJoke() {
  const style = Math.random() < 0.4 ? "story" : "quick";
  if (style === "story") {
    const index = Math.floor(Math.random() * FALLBACK_STORY_JOKES.length);
    return {
      joke: FALLBACK_STORY_JOKES[index] || FALLBACK_STORY_JOKES[0],
      style: "story",
    };
  }
  const index = Math.floor(Math.random() * FALLBACK_QUICK_JOKES.length);
  return {
    joke: FALLBACK_QUICK_JOKES[index] || FALLBACK_QUICK_JOKES[0],
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function containsBlockedContent(text) {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

function isLikelyBoring(text) {
  const words = countWords(text);
  if (words < MIN_WORDS) {
    return true;
  }
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u0600-\u06ff\s]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  if (!tokens.length) {
    return true;
  }
  const uniqueRatio = new Set(tokens).size / tokens.length;
  if (uniqueRatio < 0.45) {
    return true;
  }
  return /(really really|very very|ha ha ha)/i.test(text);
}

function isWellStructured(text, style) {
  const words = countWords(text);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean).length;
  if (words < MIN_WORDS || words > MAX_WORDS) {
    return false;
  }
  if (style === "story") {
    return words >= MIN_STORY_WORDS && lines >= 3;
  }
  if (style === "quick") {
    return words <= MAX_QUICK_WORDS && lines <= 2;
  }
  return true;
}

function isAcceptableJoke(text, style) {
  const safe = sanitizeTextWithLines(text);
  if (!safe) {
    return false;
  }
  if (containsBlockedContent(safe)) {
    return false;
  }
  if (isLikelyBoring(safe)) {
    return false;
  }
  return isWellStructured(safe, style);
}

function buildPromptForStyle(style) {
  if (style === "story") {
    return (
      "Create one creative, clean, engaging multi-line storytelling joke. " +
      "Use exactly 3 short paragraphs with a clear setup and punchline. " +
      "No offensive, disrespectful, sexual, violent, hateful, or inappropriate content."
    );
  }
  return (
    "Create one creative, clean, engaging quick punchline joke in one line. " +
    "Keep it concise and entertaining. " +
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
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
            temperature: 0.8,
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
