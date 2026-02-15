const OPENROUTER_API_KEY = "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";

export default async function handler(req, res) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: "Generate one short clean funny joke. Support all languages.",
          },
        ],
      }),
    });

    const data = await response.json();

    const joke = data?.choices?.[0]?.message?.content || "No joke generated";

    res.status(200).json({ joke });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate joke" });
  }
}
