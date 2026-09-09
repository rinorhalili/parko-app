import rateLimit from "express-rate-limit";

export const generalRateLimit = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false });
const authLimitMessage = { success: false, error: { code: "RATE_LIMITED", message: "Shumë tentativa. Prit disa minuta dhe provo përsëri." } };
export const authRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: authLimitMessage });
// Automatic session restoration must not consume the login/register budget.
export const sessionRateLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: authLimitMessage });
export const parkingReportRateLimit = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });
