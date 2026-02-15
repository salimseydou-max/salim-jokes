import { getOpenRouterConfig } from "../config/ai.js";

const MAX_CANDIDATES = 12;
const BLOCK_THRESHOLD = 90;
const WARNING_THRESHOLD = 75;

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
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const jokeText = sanitizeText(body.jokeText || body.joke || "");
    if (!jokeText) {
      return res.status(400).json({ error: "Missing joke text" });
    }

    const candidates = normalizeCandidates(body.existingJokes || [], jokeText);
    if (!candidates.length) {
      return res.status(200).json({
        decision: "allow",
        similarityScore: 0,
        comparedCount: 0,
      });
    }

    if (!openRouterConfig.apiKey) {
      console.error("Missing OPENROUTER_API_KEY for duplicate checks");
      return res.status(200).json({
        decision: "allow",
        similarityScore: 0,
        comparedCount: 0,
        aiCheckFailed: true,
      });
    }

    let bestScore = 0;
    let bestMatch = "";
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
      return res.status(200).json({
        decision: "allow",
        similarityScore: 0,
        comparedCount: 0,
        aiCheckFailed: true,
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
