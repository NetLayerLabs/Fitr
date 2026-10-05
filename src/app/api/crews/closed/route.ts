/**
 * GET  /api/crews/closed: ids of crews their creator deleted from the app.
 * POST /api/crews/closed {crewId, message, signature}: the creator deletes a crew from the app.
 *      `message` is closeCrewMessage(...) signed with the creator's wallet (base64 signature).
 *      Verified: signature, freshness (10 min), and that the signer is the crew's onchain creator.
 * Nothing onchain changes (see src/lib/crews/closeMessage.ts).
 */
import "server-only";
import { getBase64Encoder, getPublicKeyFromAddress, getUtf8Encoder, isAddress, address, verifySignature, type SignatureBytes } from "@solana/kit";
import { loadCrewInvite } from "@/components/crews/inviteData";
import { CLOSE_MESSAGE_MAX_AGE_MS, parseCloseCrewMessage } from "@/lib/crews/closeMessage";
import { closedCrewIds, markCrewClosed } from "@/lib/crews/closedStore";
import { clientKey, createRateLimiter } from "@/lib/solana/server/rateLimit";
import { apiError, isSameOrigin, jsonResponse } from "@/lib/solana/server/rpcProxy";

const limiter = createRateLimiter({ capacity: 5, refillPerSecond: 5 / 60 });

export async function GET(): Promise<Response> {
  return jsonResponse({ closed: await closedCrewIds() }, 200, { "cache-control": "public, max-age=30" });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return jsonResponse(apiError("forbidden_origin", "Cross-origin requests are not allowed"), 403);
  const ip = clientKey(request);
  if (!limiter.take(ip)) {
    const retry = Math.max(1, limiter.retryAfterSec(ip));
    return jsonResponse(apiError("rate_limited", "Too many requests", retry), 429, { "retry-after": String(retry) });
  }

  let body: { message?: unknown; signature?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse(apiError("bad_request", "Invalid JSON"), 400);
  }
  if (typeof body.message !== "string" || typeof body.signature !== "string" || body.message.length > 600) {
    return jsonResponse(apiError("bad_request", "message and signature are required"), 400);
  }
  const parsed = parseCloseCrewMessage(body.message);
  if (!parsed || !isAddress(parsed.owner)) return jsonResponse(apiError("bad_request", "Unrecognised delete message"), 400);
  if (Math.abs(Date.now() - parsed.issuedAtMs) > CLOSE_MESSAGE_MAX_AGE_MS) {
    return jsonResponse(apiError("unauthorized", "This delete request has expired. Try again."), 401);
  }

  let valid = false;
  try {
    const sig = getBase64Encoder().encode(body.signature);
    if (sig.length === 64) {
      const key = await getPublicKeyFromAddress(address(parsed.owner));
      valid = await verifySignature(key, sig as SignatureBytes, getUtf8Encoder().encode(body.message));
    }
  } catch {
    valid = false;
  }
  if (!valid) return jsonResponse(apiError("unauthorized", "The signature does not match"), 401);

  const crew = await loadCrewInvite(parsed.crewId);
  if (crew.kind === "unavailable") return jsonResponse(apiError("upstream_unavailable", "Can't read the crew right now"), 503);
  if (crew.kind !== "found") return jsonResponse(apiError("not_found", "No such crew"), 404);
  if (crew.crew.info.creator !== parsed.owner) {
    return jsonResponse(apiError("unauthorized", "Only the crew's creator can delete it"), 401);
  }

  await markCrewClosed(parsed.crewId, parsed.owner);
  return jsonResponse({ ok: true, crewId: parsed.crewId.toString() }, 200);
}
