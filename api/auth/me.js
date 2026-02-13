import {
  clearAuthSessionCookie,
  getAuthenticatedUserFromRequest,
  toSafeAuthError,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
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
    return res.status(200).json({
      authenticated: true,
      user: auth.user,
    });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
