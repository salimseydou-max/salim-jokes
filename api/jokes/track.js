import { toSafeRouteError, trackJokeView } from "../../lib/database.js";
import {
  getAuthenticatedUserFromRequest,
  incrementUserViewCount,
} from "../../lib/auth.js";
import parseRequestBody from "../../lib/parseRequestBody.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseRequestBody(req);
    let sessionUserId = "";
    try {
      const auth = await getAuthenticatedUserFromRequest(req);
      sessionUserId = auth?.user?.id || "";
    } catch (authError) {
      console.error("Auth session lookup failed in /api/jokes/track:", authError);
    }

    const userId = body.userId || sessionUserId || "";
    const tracking = await trackJokeView(body.jokeId, userId, {
      text: body.text || body.joke,
      language: body.language || body.lang,
      category: body.category,
      tags: body.tags,
      createdAt: body.createdAt,
    });
    if (userId) {
      try {
        await incrementUserViewCount(userId);
      } catch (profileError) {
        console.error("Failed updating user view stats:", profileError);
      }
    }
    return res.status(200).json({ success: true, tracking });
  } catch (error) {
    console.error("POST /api/jokes/track failed:", error);
    const safe = toSafeRouteError(error);
    return res.status(safe.status).json(safe.body);
  }
}
