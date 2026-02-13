import { saveJoke, toSafeRouteError } from "../../lib/database.js";

function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = parseBody(req);
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
