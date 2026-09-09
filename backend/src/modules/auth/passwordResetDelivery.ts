import { env } from "../../config/env.js";
import { serviceUnavailable } from "../../utils/errors.js";

type PasswordResetDelivery = {
  email: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
};

export function passwordResetDeliveryConfigured() {
  return Boolean(env.PASSWORD_RESET_WEB_URL && env.PASSWORD_RESET_DELIVERY_URL);
}

/**
 * The application deliberately delegates message delivery to a configurable
 * transactional-mail adapter so credentials never live in source control.
 */
export async function deliverPasswordReset(payload: PasswordResetDelivery) {
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
