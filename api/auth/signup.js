import {
  setAuthSessionCookie,
  signupUser,
  toSafeAuthError,
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
    const body = await parseRequestBody(req);
    const result = await signupUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      locale: body.locale,
      timezone: body.timezone,
      userAgent: req?.headers?.["user-agent"] || "",
      ipAddress: getClientIp(req),
    });
    setAuthSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
    return res.status(201).json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error("POST /api/auth/signup failed:", error);
    const safe = toSafeAuthError(error);
    return res.status(safe.status).json(safe.body);
  }
}
