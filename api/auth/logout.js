import {
  clearAuthSessionCookie,
  logoutByToken,
  readAuthTokenFromRequest,
  toSafeAuthError,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = readAuthTokenFromRequest(req);
    if (token) {
      await logoutByToken(token);
    }
    clearAuthSessionCookie(res, req);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
