import {
  getAuthenticatedUserFromRequest,
  getAvatarAssetByKey,
  toSafeAuthError,
} from "../../lib/auth.js";

function getAvatarKeyFromRequest(req) {
  const query = req?.query && typeof req.query === "object" ? req.query : {};
  const raw = Array.isArray(query.key) ? query.key[0] : query.key;
  return typeof raw === "string" ? raw.trim() : "";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const avatarKey = getAvatarKeyFromRequest(req);
    if (!avatarKey) {
      return res.status(400).json({ error: "Missing avatar key" });
    }

    const auth = await getAuthenticatedUserFromRequest(req);
    if (!auth || !auth.user || !auth.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const avatar = await getAvatarAssetByKey(avatarKey);
    if (!avatar) {
      return res.status(404).json({ error: "Avatar not found" });
    }
    if (avatar.userId !== auth.user.id) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const etag = `"avatar-${avatar.key}-${Date.parse(avatar.updatedAt) || 0}"`;
    if (req?.headers?.["if-none-match"] === etag) {
      res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("ETag", etag);
      return res.status(304).end();
    }

    res.setHeader("Content-Type", avatar.mimeType || "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
    res.setHeader("ETag", etag);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(avatar.buffer);
  } catch (error) {
    console.error("GET /api/auth/avatar failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
