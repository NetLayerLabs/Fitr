/**
 * Onchain side of the attestor, injected so the verification core stays testable.
 *
 * The default export is the real vault adapter (createVaultOnchain): it reads the user's
 * Commitment with the generated decoders and submits attest_completion signed by
 * ATTESTOR_KEYPAIR through Helius with a priority fee, confirming by polling. When the server is
 * not configured (no Helius key in production, no ATTESTOR_KEYPAIR, no mint, no pool) every call
 * throws AttestNotConfiguredError and the API answers 503 "not_configured".
 */
import "server-only";
import { address, isAddress, type Address } from "@solana/kit";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";
import { dayConfigFromPool, dayIndexAt, dayStart, dayEnd } from "@/lib/solana/vault/day";
import { getPoolAddresses, getUserDayAddresses } from "@/lib/solana/vault/addresses";
import {
  CommitmentStatus as VaultCommitmentStatus,
  fetchMaybeCommitment,
  fetchMaybePool,
  getAttestCompletionInstructionAsync,
} from "@/lib/solana/vault/generated";
import {
  getServerSolana,
  loadPool,
  type LoadedPool,
  sendServerInstructions,
  ServerSolanaNotConfiguredError,
  ServerTxError,
  VAULT_ERR,
  type ServerSolana,
} from "@/lib/solana/server/attestor";
import { ServerSecretsError } from "@/lib/solana/server/secrets";

/** "revoked": the attestor withdrew a completion; principal is refundable, it can never be re-attested. */
export type CommitmentStatus = "committed" | "completed" | "revoked";

export interface OnchainCommitment {
  exercise: ExerciseKind;
  /** Reps, or seconds for the timed holds. */
  goalTarget: number;
  status: CommitmentStatus;
  /** Unix seconds (chain time) the commitment was made. */
  committedAt: number;
}

export interface SubmitAttestationParams {
  /** Base58 wallet address of the committer. */
  wallet: string;
  dayIndex: number;
  /** Server-verified count (reps, or whole seconds for the timed holds). */
  reps: number;
  /** 32-byte session hash (see trace.ts sessionHash). */
  sessionHash: Uint8Array;
  /** Unix seconds the server started the session (the onchain session_started_at). */
  sessionStartedAt: number;
  /** The pool: 0 / omitted = the global pool, else a crew (anchor/SPEC.md §2.7). */
  crewId?: bigint;
}

export interface AttestOnchain {
  /** The commitment in the global pool, or in crew `crewId` when given (and non-zero). */
  getCommitment(wallet: string, dayIndex: number, crewId?: bigint): Promise<OnchainCommitment | null>;
  submitAttestation(p: SubmitAttestationParams): Promise<{ signature: string }>;
  /**
   * Optional: the vault's current day index for a server epoch ms (pool.day_length_secs /
   * day_offset_secs). When provided, /start rejects sessions for any other day.
   */
  currentDayIndex?(nowMs: number): number;
}

export class AttestNotConfiguredError extends Error {
  constructor() {
    super("Attestor onchain access is not configured");
    this.name = "AttestNotConfiguredError";
  }
}

export const notConfiguredOnchain: AttestOnchain = {
  async getCommitment() {
    throw new AttestNotConfiguredError();
  },
  async submitAttestation() {
    throw new AttestNotConfiguredError();
  },
};

/** attest_completion measured 43,473 CU on the deployed binary; about 1.4x headroom. */
export const ATTEST_COMPUTE_UNITS = 60_000;

/** User-facing copy for the program errors attest_completion can hit. */
const ATTEST_ERROR_COPY: Record<number, string> = {
  [VAULT_ERR.Paused]: "The vault is paused right now",
  [VAULT_ERR.NotAttestor]: "This server is not the vault's attestor",
  [VAULT_ERR.AttestWindowClosed]: "The verification window for this day has closed",
  [VAULT_ERR.AlreadyFinalized]: "This day has already been settled",
  [VAULT_ERR.DayVoided]: "This day was voided; your stake can be claimed back",
  [VAULT_ERR.InvalidCommitmentState]: "This day is already verified",
  [VAULT_ERR.InvalidSessionTime]: "The workout was not inside this pool day",
  [VAULT_ERR.GoalNotMet]: "The verified count is below your goal",
};

/** Crew pools are cached like the global one (loadPool): a minute, bounded. */
const CREW_POOL_TTL_MS = 60_000;
const CREW_POOL_CACHE_MAX = 256;

export interface VaultOnchainDeps {
  /** Resolves the server context; default getServerSolana() from the environment. */
  context?: () => Promise<ServerSolana>;
  now?: () => number;
  /** Overrides for confirmation polling (tests). */
  send?: { timeoutMs?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number };
}

function asWallet(wallet: string): Address {
  if (!isAddress(wallet)) throw new Error("Invalid wallet");
  return address(wallet);
}

/**
 * The real adapter. getCommitment returns null for a day other than the pool's current one (the
 * program would reject the attestation with InvalidSessionTime anyway, so the user never works
 * out for a day that cannot be verified).
 */
export function createVaultOnchain(deps: VaultOnchainDeps = {}): AttestOnchain {
  const now = deps.now ?? Date.now;

  async function ctx(): Promise<ServerSolana> {
    try {
      return await (deps.context ?? (() => getServerSolana()))();
    } catch (e) {
      if (e instanceof ServerSolanaNotConfiguredError || e instanceof ServerSecretsError) {
        throw new AttestNotConfiguredError();
      }
      throw e;
    }
  }

  const crewPools = new Map<string, { at: number; pool: LoadedPool | null }>();

  /** A crew's pool (null when it does not exist), validated against the configured mint. */
  async function loadCrewPool(c: ServerSolana, crewId: bigint): Promise<LoadedPool | null> {
    const key = `${c.programAddress}:${c.mint}:${crewId}`;
    const t = now();
    const hit = crewPools.get(key);
    if (hit && t - hit.at < CREW_POOL_TTL_MS) return hit.pool;
    const { pool: address } = await getPoolAddresses(c.mint, c.programAddress, crewId);
    const acc = await fetchMaybePool(c.rpc, address);
    const pool = acc.exists && acc.data.mint === c.mint && acc.data.crewId === crewId ? { address, data: acc.data } : null;
    if (crewPools.size >= CREW_POOL_CACHE_MAX) crewPools.clear();
    crewPools.set(key, { at: t, pool });
    return pool;
  }

  /**
   * The global pool (crewId 0 / omitted) or a crew pool. A missing global pool means the vault is
   * not live (not configured); a missing crew is simply "no commitment" (null).
   */
  async function poolFor(c: ServerSolana, crewId: bigint | undefined): Promise<LoadedPool | null> {
    if (!crewId) {
      const pool = await loadPool(c, { nowMs: now() });
      if (!pool) throw new AttestNotConfiguredError();
      return pool;
    }
    return loadCrewPool(c, crewId);
  }

  return {
    async getCommitment(wallet, dayIndex, crewId) {
      const user = asWallet(wallet);
      const c = await ctx();
      const pool = await poolFor(c, crewId);
      if (!pool) return null;
      const cfg = dayConfigFromPool(pool.data);
      const nowSecs = Math.floor(now() / 1000);
      let today: number;
      try {
        today = dayIndexAt(nowSecs, cfg);
      } catch {
        return null;
      }
      if (dayIndex !== today) return null;
      const { commitment } = await getUserDayAddresses({ pool: pool.address, user, dayIndex, programAddress: c.programAddress });
      const acc = await fetchMaybeCommitment(c.rpc, commitment);
      if (!acc.exists) return null;
      const exercise = EXERCISE_KINDS[acc.data.exercise];
      if (!exercise) return null;
      return {
        exercise,
        goalTarget: acc.data.goalTarget,
        status:
          acc.data.status === VaultCommitmentStatus.Completed
            ? "completed"
            : acc.data.status === VaultCommitmentStatus.Revoked
              ? "revoked"
              : "committed",
        committedAt: Number(acc.data.committedAt),
      };
    },

    async submitAttestation(p) {
      const user = asWallet(p.wallet);
      if (p.sessionHash.length !== 32) throw new Error("sessionHash must be 32 bytes");
      const c = await ctx();
      const pool = await poolFor(c, p.crewId);
      if (!pool) throw new Error("No commitment for this wallet and day");
      // Every day (crew days included) snapshots the GLOBAL pool's attestor and every crew
      // instruction reads the global pool live (SPEC §2.7), so the global pool is what to check.
      const global = p.crewId ? await loadPool(c, { nowMs: now() }) : pool;
      if (!global) throw new AttestNotConfiguredError();
      if (global.data.attestor !== c.signer.address) {
        // Configuration mistake: never send a transaction that is bound to fail.
        throw new Error("ATTESTOR_KEYPAIR is not the pool's attestor");
      }
      const cfg = dayConfigFromPool(pool.data);
      if (p.sessionStartedAt < dayStart(p.dayIndex, cfg) || p.sessionStartedAt >= dayEnd(p.dayIndex, cfg)) {
        throw new Error(ATTEST_ERROR_COPY[VAULT_ERR.InvalidSessionTime]);
      }
      const { commitment, day, profile } = await getUserDayAddresses({
        pool: pool.address,
        user,
        dayIndex: p.dayIndex,
        programAddress: c.programAddress,
      });

      // Idempotent retry: a previous attempt may have landed after the client gave up waiting.
      const existing = await fetchMaybeCommitment(c.rpc, commitment);
      if (!existing.exists) throw new Error("No commitment for this wallet and day");
      if (existing.data.status === VaultCommitmentStatus.Completed) {
        const signature = await findLatestSignature(c, commitment);
        if (signature) return { signature };
        throw new Error(ATTEST_ERROR_COPY[VAULT_ERR.InvalidCommitmentState]);
      }
      if (existing.data.status === VaultCommitmentStatus.Revoked) {
        // Never re-attest a revoked day: the program would reject it anyway.
        throw new Error(ATTEST_ERROR_COPY[VAULT_ERR.InvalidCommitmentState]);
      }
      if (p.reps < existing.data.goalTarget) throw new Error(ATTEST_ERROR_COPY[VAULT_ERR.GoalNotMet]);

      const ix = await getAttestCompletionInstructionAsync(
        {
          attestor: c.signer,
          pool: pool.address,
          globalPool: global.address,
          user,
          day,
          commitment,
          profile,
          dayIndex: p.dayIndex,
          reps: p.reps,
          sessionHash: p.sessionHash,
          sessionStartedAt: BigInt(p.sessionStartedAt),
        },
        { programAddress: c.programAddress },
      );
      try {
        const signature = await sendServerInstructions(c, [ix], {
          computeUnitLimit: ATTEST_COMPUTE_UNITS,
          priorityAccounts: [day, commitment, profile],
          ...deps.send,
        });
        return { signature };
      } catch (e) {
        if (e instanceof ServerTxError) {
          const copy = e.customCode !== null ? ATTEST_ERROR_COPY[e.customCode] : undefined;
          if (copy) throw new Error(copy);
          if (e.kind === "timeout") throw new Error("Solana did not confirm the verification in time. Try again.");
          throw new Error("Could not submit the verification to Solana. Try again.");
        }
        throw e;
      }
    },
  };
}

async function findLatestSignature(c: ServerSolana, account: Address): Promise<string | null> {
  try {
    const sigs = await c.rpc.getSignaturesForAddress(account, { limit: 5 }).send();
    const ok = sigs.find((s) => s.err === null);
    return ok ? ok.signature : null;
  } catch {
    return null;
  }
}

const vaultOnchain: AttestOnchain = createVaultOnchain();

export default vaultOnchain;
