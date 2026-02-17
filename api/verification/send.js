import parseRequestBody from "../../lib/parseRequestBody.js";
import {
  deliverVerificationCode,
  toSafeVerificationDeliveryError,
} from "../../lib/verificationDelivery.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = await parseRequestBody(req);
    const result = await deliverVerificationCode({
      type: body.type,
      target: body.target,
      code: body.code,
      expiresAt: body.expiresAt,
    });
    return res.status(200).json({
      success: true,
      delivered: true,
      channel: result.type,
      provider: result.provider,
      mock: Boolean(result.mock),
      maskedTarget: result.maskedTarget,
      ...(result.code ? { code: result.code } : {}),
    });
  } catch (error) {
    console.error("POST /api/verification/send failed:", error);
    const safe = toSafeVerificationDeliveryError(error);
    return res.status(safe.status).json(safe.body);
  }
}
