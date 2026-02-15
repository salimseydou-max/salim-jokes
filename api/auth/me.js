import {
  clearAuthSessionCookie,
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
  if (req.method !== "GET" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await getAuthenticatedUserFromRequest(req);
    if (!auth || !auth.user) {
      clearAuthSessionCookie(res);
      return res.status(200).json({
        authenticated: false,
        user: null,
      });
    }

    if (req.method === "PATCH") {
      const body = parseBody(req);
      const result = await updateUserProfile(auth.user.id, {
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        phoneNumber: body.phoneNumber,
        locale: body.locale,
        timezone: body.timezone,
        preferences: body.preferences,
        savedJokes: body.savedJokes,
        submittedJokes: body.submittedJokes,
      });
      return res.status(200).json({
        success: true,
        updated: Boolean(result && result.updated),
        user: (result && result.user) || auth.user,
      });
    }

    return res.status(200).json({
      authenticated: true,
      user: auth.user,
    });
  } catch (error) {
    console.error(`${req.method} /api/auth/me failed:`, error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
