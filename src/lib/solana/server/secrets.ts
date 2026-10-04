/**
 * Server-only secrets. Values are read from the process environment on each call and are never
 * logged, echoed in errors, or sent to the browser. Error messages name the variable, never
 * its value.
 */
import "server-only";

export interface ServerSecrets {
  /** Helius API key for the /api/rpc proxy, /api/seeker and the attestor. */
  heliusApiKey: string | null;
  /** Attestor signing key: 64 bytes (secret key + public key, `solana-keygen` JSON format). */
  attestorKeypairBytes: Uint8Array | null;
  /** Shared secret for the crank endpoint called by the VPS cron. */
  cronSecret: string | null;
}

export class ServerSecretsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerSecretsError";
  }
}

type Env = Record<string, string | undefined>;

function nonEmpty(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/**
 * Parses a `solana-keygen` keypair (a JSON array of 64 integers 0..255).
 * Returns null when unset; throws ServerSecretsError (without the value) when malformed.
 */
export function parseKeypairBytes(name: string, raw: string | undefined): Uint8Array | null {
  const text = nonEmpty(raw);
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ServerSecretsError(`${name} is malformed (expected a JSON array of 64 bytes)`);
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 64 ||
    !parsed.every((b) => typeof b === "number" && Number.isInteger(b) && b >= 0 && b <= 255)
  ) {
    throw new ServerSecretsError(`${name} is malformed (expected a JSON array of 64 bytes)`);
  }
  return Uint8Array.from(parsed as number[]);
}

/** The Helius key alone. Used by the RPC proxy and the Seeker check, which need nothing else. */
export function readHeliusApiKey(env: Env = process.env): string | null {
  return nonEmpty(env.HELIUS_API_KEY);
}

/** All server secrets. Throws ServerSecretsError if ATTESTOR_KEYPAIR is set but malformed. */
export function readServerSecrets(env: Env = process.env): ServerSecrets {
  return {
    heliusApiKey: readHeliusApiKey(env),
    attestorKeypairBytes: parseKeypairBytes("ATTESTOR_KEYPAIR", env.ATTESTOR_KEYPAIR),
    cronSecret: nonEmpty(env.CRON_SECRET),
  };
}
