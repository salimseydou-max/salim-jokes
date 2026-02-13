import { saveUserFavorite, toSafeRouteError } from "../../lib/database.js";
import {
  addFavoriteJokeToUser,
  getAuthenticatedUserFromRequest,
} from "../../lib/auth.js";

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
    let sessionUserId = "";
    try {
      const auth = await getAuthenticatedUserFromRequest(req);
      sessionUserId = auth?.user?.id || "";
    } catch (authError) {
      console.error("Auth session lookup failed in /api/jokes/favorite:", authError);
    }

    const userId = body.userId || sessionUserId;
    if (!userId || !body.jokeId) {
      return res.status(400).json({ error: "Missing favorite data" });
    }

    const favorite = await saveUserFavorite(userId, body.jokeId, {
      text: body.text || body.joke,
      language: body.language || body.lang,
      category: body.category,
      tags: body.tags,
      createdAt: body.createdAt,
    });
    try {
      await addFavoriteJokeToUser(userId, body.jokeId);
    } catch (profileError) {
      console.error("Failed syncing favorite to auth profile:", profileError);
    }

    return res.status(200).json({ success: true, favorite });
  } catch (error) {
    console.error("POST /api/jokes/favorite failed:", error);
    const safe = toSafeRouteError(error);
    return res.status(safe.status).json(safe.body);
  }
}
