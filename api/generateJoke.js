import { getOpenRouterConfig } from "../config/ai.js";

const FALLBACK_JOKES = [
  "I told my calendar I needed a break. It said: \"No problem, I already gave you a day off.\"",
  "Why do programmers love dark mode? Because light attracts bugs.",
  "I tried to write a joke about time travel, but you all laughed yesterday.",
];

function pickFallbackJoke() {
  const index = Math.floor(Math.random() * FALLBACK_JOKES.length);
  return FALLBACK_JOKES[index] || FALLBACK_JOKES[0];
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

  const config = getOpenRouterConfig();
  if (!config.apiKey) {
    return res.status(200).json({
      joke: pickFallbackJoke(),
      fallback: true,
      error: "OPENROUTER_API_KEY is not configured.",
    });
  }

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
            content: "Generate one short clean funny joke. Support all languages.",
          },
        ],
      }),
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status}`);
    }
    const data = await response.json();
    const joke = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!joke) {
      throw new Error("No joke generated");
    }
    return res.status(200).json({ joke, fallback: false });
  } catch (error) {
    console.error("GET /api/generateJoke failed:", error);
    return res.status(200).json({
      joke: pickFallbackJoke(),
      fallback: true,
      error: "Failed to generate joke from AI provider.",
    });
  } finally {
    timeout.clear();
  }
}
