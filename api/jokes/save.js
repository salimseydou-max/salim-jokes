import { saveJoke, toSafeRouteError } from "../../lib/database.js";
import parseRequestBody from "../../lib/parseRequestBody.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseRequestBody(req);
    const joke = await saveJoke({
      id: body.id,
      text: body.text || body.joke,
      language: body.language || body.lang,
      category: body.category,
      tags: body.tags,
      createdAt: body.createdAt,
    });
    return res.status(201).json({ success: true, joke });
  } catch (error) {
    console.error("POST /api/jokes/save failed:", error);
    const safe = toSafeRouteError(error);
    return res.status(safe.status).json(safe.body);
  }
}
