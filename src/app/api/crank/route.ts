/**
 * POST /api/crank (Authorization: Bearer CRON_SECRET) -> CrankReport.
 *
 * Called by the VPS cron. Runs one idempotent pass of finalize_day / close_missed / sweep_day
 * over every pool day whose attest deadline has passed (see runCrank). One run at a time per
 * process; a concurrent call gets 409.
 */
import { timingSafeEqual } from "node:crypto";
import { apiError, jsonOk } from "@/lib/attest/http";
import { getServerSolana, runCrank, ServerSolanaNotConfiguredError } from "@/lib/solana/server/attestor";
import { readServerSecrets, ServerSecretsError } from "@/lib/solana/server/secrets";

const G = globalThis as typeof globalThis & { __fitrCrankRunning?: boolean };

function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  let cronSecret: string | null;
  try {
    cronSecret = readServerSecrets().cronSecret;
  } catch (e) {
    if (e instanceof ServerSecretsError) return apiError(503, "not_configured", "Crank is not configured");
    throw e;
  }
  if (!cronSecret) return apiError(503, "not_configured", "Crank is not configured");
  if (!bearerMatches(request.headers.get("authorization"), cronSecret)) {
    return apiError(401, "unauthorized", "Unauthorized");
  }
  if (G.__fitrCrankRunning) return apiError(409, "conflict", "A crank run is already in progress", 30);

  G.__fitrCrankRunning = true;
  try {
    const ctx = await getServerSolana();
    return jsonOk(await runCrank(ctx));
  } catch (e) {
    if (e instanceof ServerSolanaNotConfiguredError || e instanceof ServerSecretsError) {
      return apiError(503, "not_configured", "Crank is not configured");
    }
    console.error("[crank] run failed", e instanceof Error ? e.name : "unknown");
    return apiError(503, "upstream_unavailable", "Crank run failed, try again", 60);
  } finally {
    G.__fitrCrankRunning = false;
  }
}
