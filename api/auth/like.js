import {
  addLikedJokeToUser,
  getAuthenticatedUserFromRequest,
  toSafeAuthError,
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
    const auth = await getAuthenticatedUserFromRequest(req);
    const userId = body.userId || auth?.user?.id || "";
    const jokeId = body.jokeId || "";
    if (!userId || !jokeId) {
      return res.status(400).json({ error: "Missing like data" });
    }
    const result = await addLikedJokeToUser(userId, jokeId);
    return res.status(200).json({ success: true, updated: Boolean(result?.updated) });
  } catch (error) {
    console.error("POST /api/auth/like failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
