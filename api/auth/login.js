import {
  loginUser,
  setAuthSessionCookie,
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
  setNoStoreHeaders(res);
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseRequestBody(req);
    const result = await loginUser({
      email: body.email,
      phoneNumber: body.phoneNumber,
      identifier: body.identifier,
      password: body.password,
      userAgent: req?.headers?.["user-agent"] || "",
      ipAddress: getClientIp(req),
    });
    setAuthSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
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
