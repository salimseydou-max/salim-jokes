export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const jokeId = String(body.jokeId || "").trim();
    const eventType = String(body.eventType || "").trim();

    if (!jokeId || !eventType) {
      return res.status(400).json({ error: "Missing tracking data" });
    }

    console.log("Tracking Logged:", jokeId, eventType);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Tracking error:", error);
    return res.status(500).json({ error: "Tracking failed" });
  }
}
