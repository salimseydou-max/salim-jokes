import {
  loginUser,
  setAuthSessionCookie,
  toSafeAuthError,
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
    const body = parseBody(req);
    const result = await loginUser({
      email: body.email,
      password: body.password,
      userAgent: req?.headers?.["user-agent"] || "",
      ipAddress: getClientIp(req),
    });
    setAuthSessionCookie(res, result.sessionToken, result.sessionExpiresAt, req);
    return res.status(200).json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    const safe = toSafeAuthError(error);
    if (safe.status === 401) {
      return res.status(200).json({
        success: false,
        ...safe.body,
      });
    }
    return res.status(safe.status).json(safe.body);
  }
}
