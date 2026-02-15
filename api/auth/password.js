import {
  getAuthenticatedUserFromRequest,
  setAuthSessionCookie,
  toSafeAuthError,
  updateUserPassword,
} from "../../lib/auth.js";
import parseRequestBody from "../../lib/parseRequestBody.js";

function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwarded)) {
    return forwarded[0] || "";
  }
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req?.socket?.remoteAddress || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await getAuthenticatedUserFromRequest(req);
    if (!auth || !auth.user) {
      return res.status(401).json({
        error: "Authentication required.",
        code: "AUTH_REQUIRED",
      });
    }

    const body = await parseRequestBody(req);
    const result = await updateUserPassword(
      auth.user.id,
      body.currentPassword,
      body.newPassword,
      {
        userAgent: req?.headers?.["user-agent"] || "",
        ipAddress: getClientIp(req),
      }
    );
    setAuthSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
    return res.status(200).json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error("POST /api/auth/password failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
