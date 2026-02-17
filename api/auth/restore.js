import {
  clearAuthSessionCookie,
  getAuthenticatedUserByToken,
  setAuthSessionCookie,
  shouldUseSecureCookies,
  toSafeAuthError,
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseRequestBody(req);
    const sessionToken = String(body?.sessionToken || "").trim();
    if (!sessionToken) {
      clearAuthSessionCookie(res, {
        secure: shouldUseSecureCookies(req),
      });
      return res.status(401).json({
        authenticated: false,
        error: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    const auth = await getAuthenticatedUserByToken(sessionToken);
    if (!auth?.user || !auth?.session?.expiresAt) {
      clearAuthSessionCookie(res, {
        secure: shouldUseSecureCookies(req),
      });
      return res.status(401).json({
        authenticated: false,
        error: "Session expired. Please sign in again.",
        code: "AUTH_SESSION_EXPIRED",
      });
    }

    setAuthSessionCookie(res, sessionToken, auth.session.expiresAt, {
      secure: shouldUseSecureCookies(req),
    });

    return res.status(200).json({
      authenticated: true,
      user: auth.user,
      sessionToken,
    });
  } catch (error) {
    console.error("POST /api/auth/restore failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json({
      authenticated: false,
      ...safe.body,
    });
  }
}
