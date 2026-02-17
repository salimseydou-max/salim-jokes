import {
  clearAuthSessionCookie,
  getAuthenticatedUserFromRequest,
  readAuthTokenFromRequest,
  setAuthSessionCookie,
  toSafeAuthError,
  updateUserProfile,
} from "../../lib/auth.js";
import parseRequestBody from "../../lib/parseRequestBody.js";

function setNoStoreHeaders(res) {
  if (!res || typeof res.setHeader !== "function") {
    return;
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Vary", "Cookie");
}

export default async function handler(req, res) {
  setNoStoreHeaders(res);
  if (req.method !== "GET" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await getAuthenticatedUserFromRequest(req);
    if (!auth || !auth.user) {
      if (req.method === "PATCH") {
        clearAuthSessionCookie(res);
        return res.status(401).json({
          error: "Authentication required.",
          code: "AUTH_REQUIRED",
        });
      }
      clearAuthSessionCookie(res);
      return res.status(200).json({
        authenticated: false,
        user: null,
      });
    }

    const token = readAuthTokenFromRequest(req);
    if (token && auth.session?.expiresAt) {
      setAuthSessionCookie(res, token, auth.session.expiresAt);
    }

    if (req.method === "PATCH") {
      const body = await parseRequestBody(req);
      const result = await updateUserProfile(auth.user.id, {
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        phoneNumber: body.phoneNumber,
        language: body.language,
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
