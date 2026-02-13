export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { jokeId, eventType } = req.body;

    if (!jokeId || !eventType) {
      return res.status(400).json({ error: "Missing tracking data" });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization:
          "Bearer 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",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Track joke event. Joke ID: ${jokeId}. Event: ${eventType}. Support all languages and joke categories.`,
          },
        ],
      }),
    });

    const data = await response.json();
    void data;

    console.log("Tracking Logged:", jokeId, eventType);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Tracking error:", error);
    return res.status(500).json({ error: "Tracking failed" });
  }
}
