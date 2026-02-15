import {
  addLikedJokeToUser,
  getAuthenticatedUserFromRequest,
  toSafeAuthError,
} from "../../lib/auth.js";
import parseRequestBody from "../../lib/parseRequestBody.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseRequestBody(req);
    const auth = await getAuthenticatedUserFromRequest(req);
    const userId = auth?.user?.id || "";
    const jokeId = body.jokeId || "";
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
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
