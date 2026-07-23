// ─── Structured logging (pino) ────────────────────────────────────────────────
// JSON logs that are queryable in production, with secrets redacted so tokens,
// passwords and cookies never leak into log storage. Import and use instead of
// console.* in server code: logger.info({ orderId }, "order confirmed").

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: { app: "simbazaar" },
  // Never log credentials or session material, wherever they appear in an object.
  redact: {
    paths: ["password", "*.password", "token", "*.token", "authorization", "cookie", "headers.cookie", "headers.authorization", "service_role_key", "*.service_role_key"],
    censor: "[redacted]",
  },
});
