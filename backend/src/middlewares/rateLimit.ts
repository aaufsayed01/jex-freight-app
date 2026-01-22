import rateLimit from "express-rate-limit";

export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,                   // 5 signups per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-up attempts. Try again later." },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 logins per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

export const resendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { error: "Too many resend attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
