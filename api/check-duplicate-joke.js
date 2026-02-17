import { getOpenRouterConfig } from "../config/ai.js";
import parseRequestBody from "../lib/parseRequestBody.js";

const MAX_CANDIDATES = 12;
const BLOCK_THRESHOLD = 90;
const WARNING_THRESHOLD = 75;
const LOCAL_BLOCK_THRESHOLD = 84;
const LOCAL_WARNING_THRESHOLD = 70;

function sanitizeText(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeCandidates(existingJokes, newJoke) {
  if (!Array.isArray(existingJokes)) {
    return [];
  }
  const normalizedNew = sanitizeText(newJoke).toLowerCase();
  const seen = new Set();
  const output = [];
  for (let i = 0; i < existingJokes.length; i += 1) {
    if (output.length >= MAX_CANDIDATES) {
      break;
    }
    const item = existingJokes[i];
    const raw =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.joke || item.text || ""
          : "";
    const safe = sanitizeText(raw);
    if (!safe) {
      continue;
    }
    const normalized = safe.toLowerCase();
    if (normalized === normalizedNew || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(safe);
  }
  return output;
}

function hasExactDuplicate(existingJokes, newJoke) {
  if (!Array.isArray(existingJokes)) {
    return false;
  }
  const normalizedNew = sanitizeText(newJoke).toLowerCase();
  if (!normalizedNew) {
    return false;
  }
  for (let i = 0; i < existingJokes.length; i += 1) {
    const item = existingJokes[i];
    const raw =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.joke || item.text || ""
          : "";
    const normalized = sanitizeText(raw).toLowerCase();
    if (normalized && normalized === normalizedNew) {
      return true;
    }
  }
  return false;
}

function parseSimilarityScore(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const match = value.match(/(\d{1,3}(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 100) {
    return 100;
  }
  return parsed;
}

function tokenizeForSimilarity(text) {
  return sanitizeText(text)
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
  const normalized = sanitizeText(text)
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

function getLocalSimilarityScore(a, b) {
  const left = sanitizeText(a).toLowerCase();
  const right = sanitizeText(b).toLowerCase();
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 100;
  }
  const containmentRatio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
  if (containmentRatio >= 0.72 && (left.includes(right) || right.includes(left))) {
    return Math.round(86 + containmentRatio * 10);
  }
  const tokenSimilarity = getSetSimilarity(buildTokenSignature(left), buildTokenSignature(right));
  const trigramSimilarity = getSetSimilarity(buildTrigramSignature(left), buildTrigramSignature(right));
  const blended = tokenSimilarity * 0.68 + trigramSimilarity * 0.32;
  return Math.round(Math.max(0, Math.min(100, blended * 100)));
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 8000));
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function getSimilarityScore(newJoke, existingJoke, config) {
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
        messages: [
          {
            role: "user",
            content:
              "Compare these two jokes and return only a similarity percentage number from 0 to 100. " +
              "Consider semantic meaning, paraphrases, and translations across languages.\n\n" +
              `Joke A:\n${newJoke}\n\n` +
              `Joke B:\n${existingJoke}`,
          },
        ],
      }),
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenRouter similarity request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const score = parseSimilarityScore(content);
    if (score === null) {
      throw new Error("Could not parse similarity score");
    }
    return score;
  } finally {
    timeout.clear();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const openRouterConfig = getOpenRouterConfig();
    const body = await parseRequestBody(req);
    const jokeText = sanitizeText(body.jokeText || body.joke || "");
    if (!jokeText) {
      return res.status(400).json({ error: "Missing joke text" });
    }

    const rawExistingJokes = body.existingJokes || [];
    if (hasExactDuplicate(rawExistingJokes, jokeText)) {
      return res.status(200).json({
        decision: "block",
        similarityScore: 100,
        comparedCount: 1,
        aiCheckFailed: false,
        matchedJoke: sanitizeText(jokeText),
        source: "exact-match",
      });
    }
    const candidates = normalizeCandidates(rawExistingJokes, jokeText);
    if (!candidates.length) {
      return res.status(200).json({
        decision: "allow",
        similarityScore: 0,
        comparedCount: 0,
      });
    }

    let bestScore = 0;
    let bestMatch = "";
    for (let i = 0; i < candidates.length; i += 1) {
      const score = getLocalSimilarityScore(jokeText, candidates[i]);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidates[i];
      }
      if (bestScore >= BLOCK_THRESHOLD) {
        return res.status(200).json({
          decision: "block",
          similarityScore: Math.round(bestScore),
          comparedCount: i + 1,
          aiCheckFailed: false,
          matchedJoke: bestMatch,
          source: "local-semantic",
        });
      }
    }

    if (!openRouterConfig.apiKey) {
      console.error("Missing OPENROUTER_API_KEY for duplicate checks");
      const localDecision =
        bestScore >= LOCAL_BLOCK_THRESHOLD
          ? "block"
          : bestScore >= LOCAL_WARNING_THRESHOLD
            ? "warn"
            : "allow";
      return res.status(200).json({
        decision: localDecision,
        similarityScore: Math.round(bestScore),
        comparedCount: candidates.length,
        aiCheckFailed: true,
        matchedJoke: localDecision === "allow" ? "" : bestMatch,
        source: "local-semantic",
      });
    }

    let comparedCount = 0;
    let hadAiFailure = false;

    for (let i = 0; i < candidates.length; i += 1) {
      try {
        const score = await getSimilarityScore(jokeText, candidates[i], openRouterConfig);
        comparedCount += 1;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidates[i];
        }
        if (bestScore >= BLOCK_THRESHOLD) {
          break;
        }
      } catch (error) {
        hadAiFailure = true;
        console.error("Duplicate similarity compare failed:", error);
      }
    }

    if (!comparedCount) {
      const localDecision =
        bestScore >= LOCAL_BLOCK_THRESHOLD
          ? "block"
          : bestScore >= LOCAL_WARNING_THRESHOLD
            ? "warn"
            : "allow";
      return res.status(200).json({
        decision: localDecision,
        similarityScore: Math.round(bestScore),
        comparedCount: candidates.length,
        aiCheckFailed: true,
        matchedJoke: localDecision === "allow" ? "" : bestMatch,
        source: "local-semantic",
      });
    }

    const roundedScore = Math.round(bestScore);
    const decision =
      roundedScore >= BLOCK_THRESHOLD
        ? "block"
        : roundedScore >= WARNING_THRESHOLD
          ? "warn"
          : "allow";

    return res.status(200).json({
      decision,
      similarityScore: roundedScore,
      comparedCount,
      aiCheckFailed: hadAiFailure,
      matchedJoke: decision === "allow" ? "" : bestMatch,
      source: "hybrid",
    });
  } catch (error) {
    console.error("Duplicate check error:", error);
    return res.status(200).json({
      decision: "allow",
      similarityScore: 0,
      comparedCount: 0,
      aiCheckFailed: true,
    });
  }
}
