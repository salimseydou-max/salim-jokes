import {
  clearAuthSessionCookie,
  logoutByToken,
  readAuthTokenFromRequest,
  shouldUseSecureCookies,
  toSafeAuthError,
} from "../../lib/auth.js";

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
    const token = readAuthTokenFromRequest(req);
    if (token) {
      await logoutByToken(token);
    }
    clearAuthSessionCookie(res, {
      secure: shouldUseSecureCookies(req),
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
