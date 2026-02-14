import {
  getAuthenticatedUserFromRequest,
  toSafeAuthError,
  updateUserProfile,
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
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await getAuthenticatedUserFromRequest(req);
    if (!auth || !auth.user) {
      return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    }

    const body = parseBody(req);
    const result = await updateUserProfile(auth.user.id, {
      displayName: body.displayName,
      avatarUrl: body.avatarUrl,
    });

    return res.status(200).json({
      success: true,
      updated: Boolean(result && result.updated),
      user: (result && result.user) || auth.user,
    });
  } catch (error) {
    console.error("PATCH /api/auth/profile failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
