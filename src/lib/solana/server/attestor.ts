/**
 * Server-side Solana plumbing for the attestor and the crank: the ATTESTOR_KEYPAIR signer, a
 * Helius RPC client, priority-fee estimation, send + confirm of server-signed transactions, and
 * the permissionless day crank (finalize_day / close_missed / sweep_day). Server only.
 *
 * Nothing here runs at import time; every network call goes through an injectable `ServerSolana`
 * context so tests drive it with a fake RPC and never touch a cluster.
 */
import "server-only";
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getSignatureFromTransaction,
  isSolanaError,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  type Address,
  type Base58EncodedBytes,
  type Instruction,
  type KeyPairSigner,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { solanaConfig, type SolanaCluster } from "../config";
import { commitmentsForDayFilters, getPoolAddresses, vaultProgramAddress } from "../vault/addresses";
import { POOL_OFFSETS, POOL_SIZE } from "../vault/crews";
import { dayConfigFromPool, finalizeAfterOf, withGlobalPause } from "../vault/day";
import {
  fetchMaybeDayState,
  fetchMaybePool,
  getPoolDecoder,
  getCloseMissedInstructionAsync,
  getCommitmentDecoder,
  getDayStateDecoder,
  getDayStateSize,
  getFinalizeDayInstructionAsync,
  getSweepDayInstructionAsync,
  getSyncCrewInstruction,
  type DayState,
  type Pool,
} from "../vault/generated";
import { pollSignature } from "./confirm";
import { readServerSecrets } from "./secrets";
import { upstreamRpcUrl } from "./upstream";

// ---------------------------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------------------------

export interface ServerSolana {
  rpc: Rpc<SolanaRpcApi>;
  /** Upstream JSON-RPC URL (carries the Helius key: never log or return it). */
  upstreamUrl: string;
  /** ATTESTOR_KEYPAIR: attests completions and pays for crank transactions. */
  signer: KeyPairSigner;
  programAddress: Address;
  mint: Address;
  /** Used for Helius-only JSON-RPC methods (getPriorityFeeEstimate). */
  fetchImpl: typeof fetch;
}

/** A required server secret or public setting is missing; routes answer 503 not_configured. */
export class ServerSolanaNotConfiguredError extends Error {
  constructor(what: string) {
    super(`Server Solana access is not configured (${what})`);
    this.name = "ServerSolanaNotConfiguredError";
  }
}

type Env = Record<string, string | undefined>;

interface ContextCache {
  key: string;
  ctx: Promise<ServerSolana>;
}

const G = globalThis as typeof globalThis & { __fitrServerSolana?: ContextCache | null };

/**
 * The process-wide context built from the environment: Helius (or the public RPC outside
 * production), the attestor signer, the configured vault program and staking mint. Rebuilt when
 * the relevant environment changes. Throws ServerSolanaNotConfiguredError when anything is
 * missing, and ServerSecretsError (no values) when ATTESTOR_KEYPAIR is malformed.
 */
export async function getServerSolana(
  env: Env = process.env,
  opts: { cluster?: SolanaCluster; mint?: Address | null; programAddress?: Address; fetchImpl?: typeof fetch } = {},
): Promise<ServerSolana> {
  const secrets = readServerSecrets(env);
  const cluster = opts.cluster ?? solanaConfig.cluster;
  const upstreamUrl = upstreamRpcUrl(cluster, secrets.heliusApiKey, env.NODE_ENV);
  if (!upstreamUrl) throw new ServerSolanaNotConfiguredError("HELIUS_API_KEY");
  const bytes = secrets.attestorKeypairBytes;
  if (!bytes) throw new ServerSolanaNotConfiguredError("ATTESTOR_KEYPAIR");
  const mint = opts.mint === undefined ? solanaConfig.skrMint : opts.mint;
  if (!mint) throw new ServerSolanaNotConfiguredError("staking mint");
  const programAddress = opts.programAddress ?? vaultProgramAddress();

  // The key never leaves this module; it is only compared to decide whether to rebuild.
  const key = [cluster, upstreamUrl, programAddress, mint, Array.from(bytes).join(",")].join("|");
  const cached = G.__fitrServerSolana;
  if (cached && cached.key === key && !opts.fetchImpl) return cached.ctx;
  const ctx = (async (): Promise<ServerSolana> => ({
    rpc: createSolanaRpc(upstreamUrl),
    upstreamUrl,
    signer: await createKeyPairSignerFromBytes(bytes),
    programAddress,
    mint,
    fetchImpl: opts.fetchImpl ?? fetch,
  }))();
  if (!opts.fetchImpl) {
    G.__fitrServerSolana = { key, ctx };
    // A failed build (e.g. a bad key) must not stick.
    ctx.catch(() => {
      if (G.__fitrServerSolana?.ctx === ctx) G.__fitrServerSolana = null;
    });
  }
  return ctx;
}

/** Tests only. */
export function resetServerSolana(): void {
  G.__fitrServerSolana = null;
}

// ---------------------------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------------------------

export interface LoadedPool {
  address: Address;
  data: Pool;
}

const POOL_TTL_MS = 60_000;
const poolCache = new WeakMap<ServerSolana, { at: number; pool: LoadedPool }>();

/** The vault Pool for ctx.mint, cached for a minute (pass fresh to bypass). Null when absent. */
export async function loadPool(ctx: ServerSolana, o: { fresh?: boolean; nowMs?: number } = {}): Promise<LoadedPool | null> {
  const now = o.nowMs ?? Date.now();
  const hit = poolCache.get(ctx);
  if (!o.fresh && hit && now - hit.at < POOL_TTL_MS) return hit.pool;
  const { pool } = await getPoolAddresses(ctx.mint, ctx.programAddress);
  const acc = await fetchMaybePool(ctx.rpc, pool);
  if (!acc.exists) {
    poolCache.delete(ctx);
    return null;
  }
  const loaded = { address: pool, data: acc.data };
  poolCache.set(ctx, { at: now, pool: loaded });
  return loaded;
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

export type ServerTxFailure = "preflight" | "failed" | "timeout" | "rpc";

export class ServerTxError extends Error {
  constructor(
    readonly kind: ServerTxFailure,
    /** Custom program error code (6000+ for the vault), when one could be read. */
    readonly customCode: number | null,
    readonly signature: string | null,
    message: string,
  ) {
    super(message);
    this.name = "ServerTxError";
  }
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return null;
}

/** Reads a custom program error code from an RPC TransactionError value ({InstructionError: [i, {Custom: n}]}). */
export function customCodeFromTransactionError(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const ie = (err as { InstructionError?: unknown }).InstructionError;
  if (Array.isArray(ie) && ie.length === 2 && ie[1] && typeof ie[1] === "object") {
    return toNum((ie[1] as { Custom?: unknown }).Custom);
  }
  return null;
}

/** Custom program error code from a thrown kit error (walks the cause chain), or null. */
export function extractCustomErrorCode(e: unknown): number | null {
  let cur: unknown = e;
  for (let depth = 0; cur && depth < 8; depth++) {
    if (isSolanaError(cur, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) return toNum(cur.context.code);
    const fromValue = customCodeFromTransactionError(cur);
    if (fromValue !== null) return fromValue;
    if (cur instanceof Error) {
      const m = /custom program error: (0x[0-9a-f]+|\d+)/i.exec(cur.message);
      if (m) return Number(m[1]);
      cur = cur.cause;
    } else {
      break;
    }
  }
  return null;
}

// Vault error codes this module reacts to (anchor/SPEC.md §7).
export const VAULT_ERR = {
  Paused: 6000,
  NotAttestor: 6002,
  AttestWindowClosed: 6008,
  DayNotOver: 6009,
  AlreadyFinalized: 6010,
  NotFinalized: 6011,
  DayVoided: 6012,
  InvalidCommitmentState: 6013,
  InvalidSessionTime: 6014,
  DayNotResolved: 6018,
  GoalNotMet: 6025,
} as const;

// ---------------------------------------------------------------------------------------------
// Priority fee + send
// ---------------------------------------------------------------------------------------------

export const DEFAULT_PRIORITY_MICROLAMPORTS = 10_000n;
/** Never pay more than this per CU (2,000,000 µL × 25k CU ≈ 0.00005 SOL). */
export const MAX_PRIORITY_MICROLAMPORTS = 2_000_000n;

/**
 * Helius getPriorityFeeEstimate ("Medium") for the accounts the transaction writes. Falls back
 * to DEFAULT_PRIORITY_MICROLAMPORTS on any error (the public RPC does not have the method).
 */
export async function estimatePriorityFee(ctx: ServerSolana, accountKeys: readonly Address[]): Promise<bigint> {
  try {
    const res = await ctx.fetchImpl(ctx.upstreamUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "fitr-fee",
        method: "getPriorityFeeEstimate",
        params: [{ accountKeys, options: { priorityLevel: "Medium" } }],
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return DEFAULT_PRIORITY_MICROLAMPORTS;
    const body = (await res.json()) as { result?: { priorityFeeEstimate?: unknown } };
    const est = toNum(body.result?.priorityFeeEstimate);
    if (est === null || est < 0) return DEFAULT_PRIORITY_MICROLAMPORTS;
    const v = BigInt(Math.ceil(est));
    if (v < 1_000n) return 1_000n;
    return v > MAX_PRIORITY_MICROLAMPORTS ? MAX_PRIORITY_MICROLAMPORTS : v;
  } catch {
    return DEFAULT_PRIORITY_MICROLAMPORTS;
  }
}

export interface SendServerOptions {
  computeUnitLimit: number;
  /** Writable accounts for the priority-fee estimate. */
  priorityAccounts?: readonly Address[];
  /** Confirmation wait. Default 60 s. */
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

/**
 * Builds [CU limit, CU price, ...instructions], fee payer + signer ctx.signer, sends through
 * the upstream (Helius) with preflight, and polls until confirmed. Throws ServerTxError with the
 * custom program error when the preflight or the transaction fails.
 */
export async function sendServerInstructions(
  ctx: ServerSolana,
  instructions: readonly Instruction[],
  o: SendServerOptions,
): Promise<Signature> {
  const microLamports = await estimatePriorityFee(ctx, o.priorityAccounts ?? []);
  let latest;
  try {
    latest = (await ctx.rpc.getLatestBlockhash({ commitment: "confirmed" }).send()).value;
  } catch {
    throw new ServerTxError("rpc", null, null, "Could not fetch a recent blockhash");
  }
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(ctx.signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latest, m),
    (m) =>
      appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction({ units: o.computeUnitLimit }),
          getSetComputeUnitPriceInstruction({ microLamports }),
          ...instructions,
        ],
        m,
      ),
  );
  const tx = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(tx);
  try {
    await ctx.rpc
      .sendTransaction(getBase64EncodedWireTransaction(tx), {
        encoding: "base64",
        preflightCommitment: "confirmed",
        maxRetries: 5n,
      })
      .send();
  } catch (e) {
    const code = extractCustomErrorCode(e);
    throw new ServerTxError(
      code === null ? "rpc" : "preflight",
      code,
      null,
      code === null ? "Transaction was not accepted by the RPC" : `Transaction rejected (program error ${code})`,
    );
  }
  const outcome = await pollSignature(ctx.rpc, signature, {
    commitment: "confirmed",
    timeoutMs: o.timeoutMs ?? 60_000,
    intervalMs: o.intervalMs,
    sleep: o.sleep,
    now: o.now,
  });
  if (outcome === "failed") {
    let code: number | null = null;
    try {
      const { value } = await ctx.rpc.getSignatureStatuses([signature]).send();
      code = customCodeFromTransactionError(value[0]?.err);
    } catch {
      // Keep code null.
    }
    throw new ServerTxError(
      "failed",
      code,
      signature,
      code === null ? "Transaction failed onchain" : `Transaction failed onchain (program error ${code})`,
    );
  }
  if (outcome === "timeout") {
    throw new ServerTxError("timeout", null, signature, "Transaction was not confirmed in time");
  }
  return signature;
}

// ---------------------------------------------------------------------------------------------
// Crank: finalize_day -> close_missed -> sweep_day (anchor/SPEC.md §3, §4)
// ---------------------------------------------------------------------------------------------

/** DayState: pool at offset 12 (SPEC §2.4). */
const DAY_STATE_POOL_OFFSET = 12n;
// Measured on the deployed binary: finalize 35,930, close_missed 28,845, sweep 22,878.
const FINALIZE_CU = 50_000;
const CLOSE_MISSED_CU_EACH = 40_000;
const SWEEP_CU = 32_000;
const SYNC_CREW_CU_EACH = 20_000;
/** sync_crew instructions per transaction (2 accounts each; SPEC: about 10 fit). */
export const SYNC_CREW_BATCH = 8;
const NO_PENDING_AUTHORITY = "11111111111111111111111111111111";
/** close_missed instructions per transaction (fits the size limit with room to spare). */
export const CLOSE_MISSED_BATCH = 5;

export type FinalizeOutcome = "finalized" | "already" | "voided" | "not_over" | "error";

export interface CrankDayReport {
  day: number;
  /** Crew id (decimal) for a crew pool's day; absent for the global pool. */
  crewId?: string;
  finalize: FinalizeOutcome;
  /** Missed commitments closed by this run. */
  closedMissed: number;
  /** Missed commitments still open after this run. */
  missedLeft: number;
  swept: boolean;
  signatures: string[];
  errors: string[];
}

export interface CrankReport {
  /** Pool day index at nowSecs. */
  today: number;
  days: CrankDayReport[];
  /** True when maxTransactions was reached before all work was done. */
  truncated: boolean;
  /** Crew pools visited this run (the global pool is always visited first). */
  crewsScanned: number;
  /** Crews brought back in line with the global authority / attestor / require_sgt (sync_crew). */
  crewsSynced: number;
  /** Problems listing crews or their days; the global pool's work still ran. */
  errors: string[];
}

export interface CrankOptions {
  nowSecs?: number;
  /** Hard cap on transactions per run. Default 40. */
  maxTransactions?: number;
  /** Stop starting new transactions after this long (the cron's curl gives up at 120 s). Default 90 s. */
  budgetMs?: number;
  /** Wall clock for the budget (tests). */
  clock?: () => number;
  /** Extra finalize attempts after DayNotOver (6009, chain clock behind). Default 2. */
  dayNotOverRetries?: number;
  dayNotOverDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Overrides for the confirmation polling (tests). */
  send?: Partial<Omit<SendServerOptions, "computeUnitLimit" | "priorityAccounts">>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function base64Bytes(data: unknown): Uint8Array {
  const b64 = Array.isArray(data) ? data[0] : data;
  return new Uint8Array(getBase64Encoder().encode(String(b64)));
}

async function listDayStates(ctx: ServerSolana, pool: Address): Promise<Array<{ address: Address; data: DayState }>> {
  const accounts = await ctx.rpc
    .getProgramAccounts(ctx.programAddress, {
      encoding: "base64",
      filters: [
        { dataSize: BigInt(getDayStateSize()) },
        {
          memcmp: {
            offset: DAY_STATE_POOL_OFFSET,
            bytes: getBase58Decoder().decode(getAddressEncoder().encode(pool)) as Base58EncodedBytes,
            encoding: "base58",
          },
        },
      ],
    })
    .send();
  const out: Array<{ address: Address; data: DayState }> = [];
  for (const a of accounts as unknown as Array<{ pubkey: Address; account: { data: unknown } }>) {
    try {
      out.push({ address: a.pubkey, data: getDayStateDecoder().decode(base64Bytes(a.account.data)) });
    } catch {
      // Not a DayState (size collision): ignore.
    }
  }
  return out.sort((x, y) => x.data.dayIndex - y.data.dayIndex);
}

async function listMissed(ctx: ServerSolana, pool: Address, day: number): Promise<Address[]> {
  const accounts = await ctx.rpc
    .getProgramAccounts(ctx.programAddress, {
      encoding: "base64",
      filters: commitmentsForDayFilters(pool, day, { onlyUnattested: true }),
    })
    .send();
  const users: Address[] = [];
  for (const a of accounts as unknown as Array<{ account: { data: unknown } }>) {
    try {
      const c = getCommitmentDecoder().decode(base64Bytes(a.account.data));
      if (c.status === 0 && c.dayIndex === day && c.pool === pool) users.push(c.user);
    } catch {
      // ignore undecodable accounts
    }
  }
  return users;
}

function describe(e: unknown): string {
  if (e instanceof ServerTxError) return e.message;
  return "RPC error";
}

/** Every crew pool (crew_id != 0) of ctx.mint, by crew id. Program-owned accounts only. */
async function listCrewPools(ctx: ServerSolana): Promise<LoadedPool[]> {
  const accounts = await ctx.rpc
    .getProgramAccounts(ctx.programAddress, {
      encoding: "base64",
      filters: [
        { dataSize: BigInt(POOL_SIZE) },
        {
          memcmp: {
            offset: BigInt(POOL_OFFSETS.mint),
            bytes: getBase58Decoder().decode(getAddressEncoder().encode(ctx.mint)) as Base58EncodedBytes,
            encoding: "base58",
          },
        },
      ],
    })
    .send();
  const out: LoadedPool[] = [];
  for (const a of accounts as unknown as Array<{ pubkey: Address; account: { data: unknown } }>) {
    try {
      const data = getPoolDecoder().decode(base64Bytes(a.account.data));
      if (data.mint !== ctx.mint || BigInt(data.crewId) === 0n) continue;
      // Only the canonical PDA for its crew id (never a look-alike account).
      const { pool } = await getPoolAddresses(ctx.mint, ctx.programAddress, BigInt(data.crewId));
      if (pool !== a.pubkey) continue;
      out.push({ address: a.pubkey, data });
    } catch {
      // Not a Pool (size collision): ignore.
    }
  }
  return out.sort((x, y) => (BigInt(x.data.crewId) < BigInt(y.data.crewId) ? -1 : 1));
}

/**
 * One idempotent crank pass over every pool (the global pool, then each crew) and every live
 * DayState whose attest deadline has passed: finalize (retrying DayNotOver), close the missed
 * commitments, then sweep once every commitment is resolved. Safe to run repeatedly and
 * concurrently with users' own claims: every "already done" program error is treated as success.
 * maxTransactions / budgetMs cap the whole run; the global pool goes first, so a large number of
 * crews can never starve it.
 */
export async function runCrank(ctx: ServerSolana, o: CrankOptions = {}): Promise<CrankReport> {
  const nowSecs = o.nowSecs ?? Math.floor(Date.now() / 1000);
  const maxTx = o.maxTransactions ?? 40;
  const retries = o.dayNotOverRetries ?? 2;
  const delay = o.dayNotOverDelayMs ?? 5_000;
  const sleep = o.sleep ?? defaultSleep;
  let txCount = 0;
  const clock = o.clock ?? Date.now;
  const t0 = clock();
  const budget = o.budgetMs ?? 90_000;
  const exhausted = () => txCount >= maxTx || clock() - t0 > budget;

  const global = await loadPool(ctx, { fresh: true });
  if (!global) throw new ServerSolanaNotConfiguredError("vault pool not initialized");
  const len = Number(global.data.dayLengthSecs);
  const off = Number(global.data.dayOffsetSecs);
  const today = Math.floor((nowSecs - off) / len);

  const send = async (ixs: Instruction[], cu: number, accounts: Address[]) => {
    txCount++;
    return sendServerInstructions(ctx, ixs, { computeUnitLimit: cu, priorityAccounts: accounts, ...o.send });
  };

  const report: CrankReport = { today, days: [], truncated: false, crewsScanned: 0, crewsSynced: 0, errors: [] };
  const run = { send, exhausted, retries, delay, sleep, nowSecs };
  await crankPool(ctx, global, global, run, report);
  if (report.truncated) return report;

  let crews: LoadedPool[] = [];
  try {
    crews = await listCrewPools(ctx);
  } catch {
    report.errors.push("crews: could not list crew pools");
  }
  // Permissionless sync_crew for crews whose copied authority / attestor / require_sgt went stale
  // (after a global rotation, SPEC §2.7). The program already reads the global pool live where it
  // matters; this keeps crew accounts honest for readers and drops stale authority transfers.
  const stale = crews.filter((c) => crewNeedsSync(c.data, global.data));
  for (let i = 0; i < stale.length; i += SYNC_CREW_BATCH) {
    if (exhausted()) {
      report.truncated = true;
      return report;
    }
    const batch = stale.slice(i, i + SYNC_CREW_BATCH);
    try {
      const ixs = batch.map((c) => getSyncCrewInstruction({ pool: c.address, globalPool: global.address }, { programAddress: ctx.programAddress }));
      await send(ixs, SYNC_CREW_CU_EACH * batch.length, [global.address, ...batch.map((c) => c.address)]);
      report.crewsSynced += batch.length;
    } catch (e) {
      report.errors.push(`sync_crew: ${describe(e)}`);
    }
  }

  for (const crew of crews) {
    if (exhausted()) {
      report.truncated = true;
      break;
    }
    report.crewsScanned++;
    try {
      await crankPool(ctx, crew, global, run, report);
    } catch {
      report.errors.push(`crew ${crew.data.crewId.toString()}: could not list days`);
    }
    if (report.truncated) break;
  }
  return report;
}

/** A crew whose copied authority, attestor or require_sgt differs from the global pool's. */
export function crewNeedsSync(
  crew: Pick<Pool, "authority" | "pendingAuthority" | "attestor" | "requireSgt">,
  global: Pick<Pool, "authority" | "attestor" | "requireSgt">,
): boolean {
  return (
    crew.authority !== global.authority ||
    crew.attestor !== global.attestor ||
    crew.requireSgt !== global.requireSgt ||
    crew.pendingAuthority !== NO_PENDING_AUTHORITY
  );
}

interface CrankRun {
  send: (ixs: Instruction[], cu: number, accounts: Address[]) => Promise<string>;
  exhausted: () => boolean;
  retries: number;
  delay: number;
  sleep: (ms: number) => Promise<void>;
  nowSecs: number;
}

/** One pool's pass of runCrank (appends to report.days; sets report.truncated). */
async function crankPool(ctx: ServerSolana, pool: LoadedPool, global: LoadedPool, run: CrankRun, report: CrankReport): Promise<void> {
  const { send, exhausted, retries, delay, sleep, nowSecs } = run;
  const cfg = { programAddress: ctx.programAddress };
  const isCrew = BigInt(pool.data.crewId) !== 0n;
  const dayCfg = withGlobalPause(dayConfigFromPool(pool.data), global.data, isCrew);
  const paused = pool.data.paused || (isCrew && global.data.paused);
  const days = report.days;
  for (const ds of await listDayStates(ctx, pool.address)) {
    if (nowSecs <= Number(ds.data.attestDeadline)) continue; // day (or its grace) still open
    if (!ds.data.finalized && !ds.data.voided) {
      // finalize_day waits for the pause-extended deadline + the day's review window, and never
      // runs while the pool is paused (SPEC §3).
      if (paused || nowSecs <= finalizeAfterOf(ds.data, dayCfg, nowSecs)) continue;
    }
    if (exhausted()) {
      report.truncated = true;
      return;
    }
    const d = ds.data.dayIndex;
    const r: CrankDayReport = { day: d, finalize: "already", closedMissed: 0, missedLeft: 0, swept: false, signatures: [], errors: [] };
    if (isCrew) r.crewId = pool.data.crewId.toString();
    days.push(r);
    let finalized = ds.data.finalized;
    const voided = ds.data.voided;

    // 1. finalize_day
    if (voided) r.finalize = "voided";
    else if (!finalized) {
      for (let attempt = 0; ; attempt++) {
        try {
          // Every pool reads the global pool live (for the global pool it is itself; SPEC §2.7).
          const ix = await getFinalizeDayInstructionAsync(
            { cranker: ctx.signer, pool: pool.address, globalPool: global.address, day: ds.address, dayIndex: d },
            cfg,
          );
          r.signatures.push(await send([ix], FINALIZE_CU, [pool.address, ds.address]));
          r.finalize = "finalized";
          finalized = true;
          break;
        } catch (e) {
          const code = e instanceof ServerTxError ? e.customCode : null;
          if (code === VAULT_ERR.AlreadyFinalized) {
            r.finalize = "already";
            finalized = true;
            break;
          }
          if (code === VAULT_ERR.DayVoided) {
            r.finalize = "voided";
            break;
          }
          if (code === VAULT_ERR.DayNotOver && attempt < retries && !exhausted()) {
            await sleep(delay);
            continue;
          }
          r.finalize = code === VAULT_ERR.DayNotOver ? "not_over" : "error";
          if (r.finalize === "error") r.errors.push(`finalize: ${describe(e)}`);
          break;
        }
      }
    }
    if (!finalized && r.finalize !== "voided") continue;

    // 2. close_missed (finalized days only; on a voided day users claim their principal)
    if (finalized) {
      let missed: Address[] = [];
      try {
        missed = await listMissed(ctx, pool.address, d);
      } catch {
        r.errors.push("close_missed: could not list commitments");
      }
      for (let i = 0; i < missed.length; i += CLOSE_MISSED_BATCH) {
        if (exhausted()) {
          report.truncated = true;
          break;
        }
        const batch = missed.slice(i, i + CLOSE_MISSED_BATCH);
        try {
          const ixs = await Promise.all(
            batch.map((user) =>
              getCloseMissedInstructionAsync({ cranker: ctx.signer, pool: pool.address, user, day: ds.address, dayIndex: d }, cfg),
            ),
          );
          r.signatures.push(await send(ixs, CLOSE_MISSED_CU_EACH * batch.length, [ds.address, ...batch]));
          r.closedMissed += batch.length;
        } catch (e) {
          // InvalidCommitmentState: one of them was closed meanwhile; the next run picks up the rest.
          const code = e instanceof ServerTxError ? e.customCode : null;
          if (code !== VAULT_ERR.InvalidCommitmentState) r.errors.push(`close_missed: ${describe(e)}`);
        }
      }
      r.missedLeft = Math.max(0, missed.length - r.closedMissed);
    }

    // 3. sweep_day once every commitment is resolved
    if (exhausted()) {
      report.truncated = true;
      continue;
    }
    try {
      const fresh = await fetchMaybeDayState(ctx.rpc, ds.address);
      if (!fresh.exists) {
        r.swept = true; // already swept by someone else
        continue;
      }
      if (fresh.data.resolvedCount !== fresh.data.committedCount) continue; // claims outstanding
      const ix = await getSweepDayInstructionAsync(
        { cranker: ctx.signer, pool: pool.address, rentPayer: fresh.data.rentPayer, day: ds.address, dayIndex: d },
        cfg,
      );
      r.signatures.push(await send([ix], SWEEP_CU, [pool.address, ds.address, fresh.data.rentPayer]));
      r.swept = true;
    } catch (e) {
      const code = e instanceof ServerTxError ? e.customCode : null;
      if (code !== VAULT_ERR.DayNotResolved) r.errors.push(`sweep: ${describe(e)}`);
    }
  }
}
