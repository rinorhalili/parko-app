import { env } from "../../config/env.js";
import { serviceUnavailable } from "../../utils/errors.js";

type PasswordResetDelivery = {
  email: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
};

export function passwordResetDeliveryConfigured() {
  return Boolean(env.PASSWORD_RESET_WEB_URL && (env.PASSWORD_RESET_DELIVERY_URL || (env.RESEND_API_KEY && env.EMAIL_FROM)));
}

/**
 * The application deliberately delegates message delivery to a configurable
 * transactional-mail adapter so credentials never live in source control.
 */
export async function deliverPasswordReset(payload: PasswordResetDelivery) {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [payload.email],
          subject: "Reset your Parko password",
          text: `Hello ${payload.name}, reset your Parko password here: ${payload.resetUrl}. This link expires at ${payload.expiresAt.toISOString()}.`
        }),
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw serviceUnavailable("Password reset delivery is unavailable");
    }
    if (!response.ok) throw serviceUnavailable("Password reset delivery is unavailable");
    return;
  }

  if (!env.PASSWORD_RESET_DELIVERY_URL) {
    throw serviceUnavailable("Password reset delivery is not configured");
  }

  let response: Response;
  try {
    response = await fetch(env.PASSWORD_RESET_DELIVERY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.PASSWORD_RESET_DELIVERY_TOKEN ? { Authorization: `Bearer ${env.PASSWORD_RESET_DELIVERY_TOKEN}` } : {})
      },
      body: JSON.stringify({ type: "password-reset", ...payload }),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw serviceUnavailable("Password reset delivery is unavailable");
  }

  if (!response.ok) throw serviceUnavailable("Password reset delivery is unavailable");
}

export async function deliverEmailVerification(payload: { email: string; name: string; verificationUrl: string; expiresAt: Date }) {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [payload.email], subject: "Verify your Parko email", text: `Hello ${payload.name}, verify your email: ${payload.verificationUrl}. This link expires at ${payload.expiresAt.toISOString()}.` }), signal: AbortSignal.timeout(10_000)
    }).catch(() => null);
    if (!response?.ok) throw serviceUnavailable("Email verification delivery is unavailable");
    return;
  }
  if (!env.PASSWORD_RESET_DELIVERY_URL) throw serviceUnavailable("Email verification delivery is not configured");
  const response = await fetch(env.PASSWORD_RESET_DELIVERY_URL, {
    method: "POST", headers: { "Content-Type": "application/json", ...(env.PASSWORD_RESET_DELIVERY_TOKEN ? { Authorization: `Bearer ${env.PASSWORD_RESET_DELIVERY_TOKEN}` } : {}) },
    body: JSON.stringify({ type: "email-verification", ...payload }), signal: AbortSignal.timeout(10_000)
  }).catch(() => null);
  if (!response?.ok) throw serviceUnavailable("Email verification delivery is unavailable");
}
