// ─── Environment validation ───────────────────────────────────────────────────
// Validate server configuration once at module load and surface a clear message,
// instead of a cryptic failure deep inside a request. Non-fatal by design: the
// app degrades to a 503 ("Supabase is not configured") rather than crashing the
// build, so preview/CI environments without secrets still compile.

import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ADMIN_EMAILS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
export const serverEnv = parsed.success ? parsed.data : {};

const dbConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!dbConfigured) {
  // eslint-disable-next-line no-console
  console.warn("[env] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not fully set — database features return 503 until configured.");
}
export const ENV_DB_CONFIGURED = dbConfigured;
