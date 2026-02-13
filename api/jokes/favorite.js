import { saveUserFavorite, toSafeRouteError } from "../../lib/database.js";

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
    const favorite = await saveUserFavorite(body.userId, body.jokeId);
    return res.status(200).json({ success: true, favorite });
  } catch (error) {
    console.error("POST /api/jokes/favorite failed:", error);
    const safe = toSafeRouteError(error);
    return res.status(safe.status).json(safe.body);
  }
}
