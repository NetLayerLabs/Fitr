/**
 * "Delete crew" is app-side only: the crew's onchain pool is never closed (the program gives its
 * creator no powers). The creator signs this plain-text message with their wallet (no transaction,
 * no SOL); the server checks the signature and that the signer is the crew's onchain creator, then
 * hides the crew in the app and on its invite page. Stakes already made can still be claimed.
 */

/** How long a signed delete request stays valid. */
export const CLOSE_MESSAGE_MAX_AGE_MS = 10 * 60_000;

export function closeCrewMessage(crewId: bigint, owner: string, issuedAtMs: number): string {
  return [
    `Fitr: delete crew ${crewId}`,
    `Creator: ${owner}`,
    `Issued at: ${new Date(issuedAtMs).toISOString()}`,
    "This removes the crew from the Fitr app and closes its invite link. It sends no transaction, and stakes already made can still be claimed.",
  ].join("\n");
}

/** The parts of a delete message, or null if it is not exactly one we would have produced. */
export function parseCloseCrewMessage(message: string): { crewId: bigint; owner: string; issuedAtMs: number } | null {
  const m = /^Fitr: delete crew ([1-9][0-9]{0,19})\nCreator: ([1-9A-HJ-NP-Za-km-z]{32,44})\nIssued at: ([0-9T:.\-]+Z)\n/.exec(message);
  if (!m) return null;
  const crewId = BigInt(m[1]);
  const issuedAtMs = Date.parse(m[3]);
  if (!Number.isFinite(issuedAtMs)) return null;
  if (closeCrewMessage(crewId, m[2], issuedAtMs) !== message) return null;
  return { crewId, owner: m[2], issuedAtMs };
}
