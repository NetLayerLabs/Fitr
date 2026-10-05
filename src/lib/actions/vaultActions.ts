/**
 * The two Blinks ("Commit with me" and "Sponsor a day"): GET metadata and POST transaction
 * building over an injected chain context, so tests run them against an in-memory RPC.
 *
 * Every POST returns an UNSIGNED v0 transaction whose fee payer (and only signer) is the posted
 * account, simulated first: a transaction that would fail onchain is never returned; the user
 * gets a clear ActionError instead (no Seeker, pool missing, not enough SKR, already committed…).
 */
import {
  address,
  compileTransaction,
  createNoopSigner,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  getBase64EncodedWireTransaction,
  isAddress,
  type Address,
  type GetAccountInfoApi,
  type GetLatestBlockhashApi,
  type GetMultipleAccountsApi,
  type Instruction,
  type Rpc,
  type SimulateTransactionApi,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS, getTokenDecoder } from "@solana-program/token";
import type { ExerciseKind } from "@/lib/pose/types";
import type { SolanaCluster } from "@/lib/solana/config";
import type { SeekerStatus } from "@/lib/solana/types";
import { getDeviceLockAddress, getPoolAddresses, getUserDayAddresses } from "@/lib/solana/vault/addresses";
import { canCommitAt, dayConfigFromPool, dayIndexAt, dayStart } from "@/lib/solana/vault/day";
import { extractCustomErrorCode, extractVaultErrorCode, vaultErrorMessage } from "@/lib/solana/vault/errors";
import {
  getCommitInstructionAsync,
  getFundReserveInstruction,
  getPoolDecoder,
  getPoolDiscriminatorBytes,
  getRegisterDeviceInstructionAsync,
  type Pool,
} from "@/lib/solana/vault/generated";
import {
  composeUserTransaction,
  computeUnitLimitFromSimulation,
  CU_ESTIMATES,
  userTokenAccount,
} from "@/lib/solana/vault/instructions";
import { decodeOwned } from "@/lib/solana/vault/read";
import type { ActionGetResponse, ActionPostResponse, LinkedAction } from "./spec";
import {
  challengeLabel,
  crewName,
  exerciseCodeOf,
  parseExerciseKind,
  parseGoal,
  parseSkrAmount,
  resolveChallenge,
  skrPlain,
  skrPretty,
  type ResolvedChallenge,
} from "./challenge";
import {
  ACTION_ICON_URL,
  APK_URL,
  COMMIT_ACTION_PATH,
  exerciseIconUrl,
  SPONSOR_ACTION_PATH,
} from "./links";

export type ActionsRpc = Rpc<GetAccountInfoApi & GetMultipleAccountsApi & GetLatestBlockhashApi & SimulateTransactionApi>;

export interface ActionsChain {
  cluster: SolanaCluster;
  rpc: ActionsRpc;
  programAddress: Address;
  /** Staking mint (real SKR on mainnet). */
  mint: Address;
  tokenLabel: string;
  /** Seeker Genesis Token lookup (always against mainnet). */
  findSgt(owner: Address): Promise<SeekerStatus>;
  /** µ-lamports per CU for this base64 transaction; must never throw (fallback inside). */
  priorityFee(txBase64: string): Promise<bigint>;
  nowSecs(): number;
}

export type ActionResult<T> = { ok: true; body: T } | { ok: false; status: number; message: string };

const fail = (status: number, message: string): ActionResult<never> => ({ ok: false, status, message });

export const SEEKER_ONLY_MESSAGE = "Staking is Seeker-only — download Fitr on your Seeker to commit.";
export const OPENS_SOON_MESSAGE = "Fitr's vault opens soon. Download Fitr on your Seeker to be ready.";

/* ------------------------------------------------------------------------------------------ */
/* Pool                                                                                        */
/* ------------------------------------------------------------------------------------------ */

export type PoolLookup =
  | { kind: "ok"; address: Address; pool: Pool }
  | { kind: "missing" }
  | { kind: "invalid"; message: string };

/** The pool named by `?pool=` (default: the global pool). Only vault pools for chain.mint count. */
export async function lookupPool(chain: ActionsChain, poolParam: string | null): Promise<PoolLookup> {
  let poolAddress: Address;
  if (poolParam && poolParam.trim()) {
    if (!isAddress(poolParam.trim())) return { kind: "invalid", message: "That pool link is not valid." };
    poolAddress = address(poolParam.trim());
  } else {
    poolAddress = (await getPoolAddresses(chain.mint, chain.programAddress)).pool;
  }
  const acc = await fetchEncodedAccount(chain.rpc, poolAddress, { commitment: "confirmed" });
  const pool = decodeOwned(acc, chain.programAddress, getPoolDiscriminatorBytes(), getPoolDecoder());
  if (!pool) return poolParam ? { kind: "invalid", message: "That Fitr pool does not exist (yet)." } : { kind: "missing" };
  if (pool.mint !== chain.mint) return { kind: "invalid", message: "That pool is not a Fitr SKR pool." };
  return { kind: "ok", address: poolAddress, pool };
}

/* ------------------------------------------------------------------------------------------ */
/* Commit with me                                                                              */
/* ------------------------------------------------------------------------------------------ */

/** Quick-pick stakes (whole SKR) offered as buttons, filtered to the pool's stake rails. */
export const COMMIT_PRESETS_SKR = [10n, 25n, 50n] as const;
export const SPONSOR_PRESETS_SKR = [100n, 500n, 1000n] as const;
const UNIT = 1_000_000n;

export interface CommitQuery {
  pool: string | null;
  exercise: ExerciseKind | null;
  goal: number | null;
}

export function parseCommitQuery(url: URL): CommitQuery {
  const sp = url.searchParams;
  return { pool: sp.get("pool"), exercise: parseExerciseKind(sp.get("exercise")), goal: parseGoal(sp.get("goal")) };
}

function commitHref(poolAddress: Address, c: ResolvedChallenge, amount: string, isGlobal: boolean): string {
  const q = new URLSearchParams();
  if (!isGlobal) q.set("pool", poolAddress);
  q.set("exercise", c.kind);
  q.set("goal", String(c.goal));
  // `{amount}` must survive literally for the parameter placeholder.
  return `${COMMIT_ACTION_PATH}?${q.toString()}&amount=${amount}`;
}

const COMMIT_EXPLAINER =
  "Put your own SKR on the same daily goal. Fitr's on-device AI counts every rep on your Seeker and a verifier re-checks it with live challenges. Finish and you get your stake back plus a share of what no-shows forfeit; miss it and your stake goes to the people who showed up.";

export function commitMetadata(
  lookup: PoolLookup,
  query: CommitQuery,
  tokenLabel = "SKR",
): ActionGetResponse {
  const requestedKind = query.exercise ?? "pushup";
  if (lookup.kind !== "ok") {
    const message = lookup.kind === "missing" ? OPENS_SOON_MESSAGE : lookup.message;
    return {
      type: "action",
      icon: exerciseIconUrl(requestedKind),
      title: "Commit with me on Fitr",
      description: `${COMMIT_EXPLAINER} Staking is Seeker-only. Get the app: ${APK_URL}`,
      label: lookup.kind === "missing" ? "Opens soon" : "Unavailable",
      disabled: true,
      error: { message },
    };
  }
  const { pool, address: poolAddress } = lookup;
  const challenge = resolveChallenge(pool, { kind: query.exercise, goal: query.goal });
  const crew = crewName(pool);
  const where = crew ? ` in the "${crew}" crew` : "";
  if (!challenge) {
    return {
      type: "action",
      icon: ACTION_ICON_URL,
      title: "Commit with me on Fitr",
      description: COMMIT_EXPLAINER,
      label: "Unavailable",
      disabled: true,
      error: { message: "This challenge is not available." },
    };
  }
  const label = challengeLabel(challenge.kind, challenge.goal);
  const min = pool.minStake;
  const max = pool.maxStake;
  const range = `${skrPretty(min)}–${skrPretty(max)} ${tokenLabel}`;
  const description = `${COMMIT_EXPLAINER} Daily goal: ${label}${where}. Stake ${range}. Staking is Seeker-only (one stake per phone per day).`;
  const base: ActionGetResponse = {
    type: "action",
    icon: exerciseIconUrl(challenge.kind),
    title: `Commit with me: ${label}`,
    description,
    label: "Commit",
  };
  if (pool.paused) {
    return { ...base, label: "Paused", disabled: true, error: { message: vaultErrorMessage(6000) ?? "Staking is paused." } };
  }
  const isGlobal = pool.crewId === 0n;
  const actions: LinkedAction[] = COMMIT_PRESETS_SKR.map((s) => s * UNIT)
    .filter((a) => a >= min && a <= max)
    .map((a) => ({
      type: "transaction" as const,
      label: `Stake ${skrPlain(a)} ${tokenLabel}`,
      href: commitHref(poolAddress, challenge, skrPlain(a), isGlobal),
    }));
  actions.push({
    type: "transaction",
    label: "Commit",
    href: commitHref(poolAddress, challenge, "{amount}", isGlobal),
    parameters: [
      {
        type: "number",
        name: "amount",
        label: `${tokenLabel} to stake (${skrPlain(min)}–${skrPlain(max)})`,
        required: true,
        min: Number(skrPlain(min)),
        max: Number(skrPlain(max)),
      },
    ],
  });
  return { ...base, links: { actions } };
}

interface Built {
  ixs: Instruction[];
  /** Initial CU limit; replaced by the simulation's units × 1.2. */
  unitLimit: number;
}

/** Compose + simulate (CU from the simulation) + priority fee → unsigned base64 transaction. */
async function finalizeTransaction(
  chain: ActionsChain,
  account: Address,
  built: Built,
): Promise<ActionResult<string>> {
  const feePayer = createNoopSigner(account);
  const { value: latestBlockhash } = await chain.rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const compose = (unitLimit: number, microLamportsPerCu: bigint) =>
    getBase64EncodedWireTransaction(
      compileTransaction(composeUserTransaction({ feePayer, latestBlockhash, ixs: built.ixs, unitLimit, microLamportsPerCu })),
    );
  const draft = compose(built.unitLimit, 0n);
  const [priority, sim] = await Promise.all([
    chain.priorityFee(draft),
    chain.rpc
      .simulateTransaction(draft, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" })
      .send(),
  ]);
  if (sim.value.err) return fail(422, simulationMessage(sim.value.err, sim.value.logs ?? null));
  const unitLimit = computeUnitLimitFromSimulation(sim.value.unitsConsumed ?? 0n, built.unitLimit);
  return { ok: true, body: compose(unitLimit, priority) };
}

/** User copy for a failed simulation. */
export function simulationMessage(err: unknown, logs: readonly string[] | null): string {
  const code = extractVaultErrorCode({ err, logs });
  if (code !== null) {
    const msg = vaultErrorMessage(code);
    if (msg) return msg;
  }
  // SPL Token error 1 = InsufficientFunds.
  if (extractCustomErrorCode({ err, logs }) === 1) return "Not enough SKR in your wallet for that amount.";
  const text = JSON.stringify(err, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) ?? "";
  const logText = (logs ?? []).join("\n");
  if (/InsufficientFundsForFee|insufficient lamports|AccountNotFound/i.test(text + logText)) {
    return "Your wallet needs a little SOL (about 0.01) to pay the network fee and account rent.";
  }
  if (/insufficient funds/i.test(logText)) return "Not enough SKR in your wallet for that amount.";
  return "This transaction would fail right now. Please try again in a minute.";
}

function parseAccount(account: unknown): Address | null {
  return typeof account === "string" && isAddress(account) ? address(account) : null;
}

/** SKR balance of the account's ATA (0 when missing). */
function tokenBalance(data: Uint8Array | null, owner: Address, mint: Address): bigint {
  if (!data) return 0n;
  try {
    const t = getTokenDecoder().decode(data);
    return t.owner === owner && t.mint === mint ? t.amount : 0n;
  } catch {
    return 0n;
  }
}

export async function commitTransaction(
  chain: ActionsChain,
  url: URL,
  rawAccount: unknown,
): Promise<ActionResult<ActionPostResponse>> {
  const account = parseAccount(rawAccount);
  if (!account) return fail(400, "Connect a valid Solana wallet first.");
  const query = parseCommitQuery(url);
  const amount = parseSkrAmount(url.searchParams.get("amount"));
  if (amount === null) return fail(400, "Enter how much SKR to stake.");

  const lookup = await lookupPool(chain, query.pool);
  if (lookup.kind === "missing") return fail(404, OPENS_SOON_MESSAGE);
  if (lookup.kind === "invalid") return fail(400, lookup.message);
  const { pool, address: poolAddress } = lookup;
  if (pool.paused) return fail(409, vaultErrorMessage(6000) ?? "Staking is paused.");
  if (amount < pool.minStake || amount > pool.maxStake) {
    return fail(400, `Stake between ${skrPretty(pool.minStake)} and ${skrPretty(pool.maxStake)} ${chain.tokenLabel}.`);
  }
  const challenge = resolveChallenge(pool, { kind: query.exercise, goal: query.goal });
  if (!challenge) return fail(400, "This challenge is not available.");

  // Seeker gate first: a non-Seeker wallet gets a clear answer instead of a doomed transaction.
  let sgt: SeekerStatus | null = null;
  if (pool.requireSgt) {
    try {
      sgt = await chain.findSgt(account);
    } catch {
      return fail(503, "Couldn't check for a Seeker right now. Please try again in a minute.");
    }
    if (!sgt.isSeeker || !sgt.sgtMint || !sgt.sgtTokenAccount) return fail(403, SEEKER_ONLY_MESSAGE);
  }

  const cfg = dayConfigFromPool(pool);
  const now = chain.nowSecs();
  let today: number;
  try {
    today = dayIndexAt(now, cfg);
  } catch {
    return fail(409, "The pool has not started yet.");
  }
  const ata = await userTokenAccount(account, chain.mint);
  const [todayAddrs, tomorrowAddrs, deviceLock] = await Promise.all([
    getUserDayAddresses({ pool: poolAddress, user: account, dayIndex: today, programAddress: chain.programAddress }),
    getUserDayAddresses({ pool: poolAddress, user: account, dayIndex: today + 1, programAddress: chain.programAddress }),
    sgt?.sgtMint ? getDeviceLockAddress(poolAddress, sgt.sgtMint, chain.programAddress) : Promise.resolve(null),
  ]);
  const addrs: Address[] = [todayAddrs.commitment, tomorrowAddrs.commitment, ata];
  if (deviceLock) addrs.push(deviceLock);
  const accs = await fetchEncodedAccounts(chain.rpc, addrs, { commitment: "confirmed" });
  const committed = [accs[0].exists, accs[1].exists];
  const ataAcc = accs[2];
  const balance = ataAcc.exists && ataAcc.programAddress === TOKEN_PROGRAM_ADDRESS ? tokenBalance(Uint8Array.from(ataAcc.data), account, chain.mint) : 0n;
  if (balance < amount) {
    return fail(400, `Not enough ${chain.tokenLabel}: you have ${skrPretty(balance)}, the stake is ${skrPretty(amount)}.`);
  }

  let dayIndex: number | null = null;
  if (!committed[0] && canCommitAt(today, cfg, now)) dayIndex = today;
  else if (!committed[1] && canCommitAt(today + 1, cfg, now)) dayIndex = today + 1;
  if (dayIndex === null) {
    return fail(409, "You already have a commitment for today and tomorrow in this pool.");
  }

  const user = createNoopSigner(account);
  const ixs: Instruction[] = [];
  const needsRegister = Boolean(sgt && deviceLock && !accs[3]?.exists);
  if (sgt?.sgtMint && sgt.sgtTokenAccount && needsRegister) {
    ixs.push(
      await getRegisterDeviceInstructionAsync(
        { user, pool: poolAddress, sgtMint: sgt.sgtMint, sgtToken: sgt.sgtTokenAccount },
        { programAddress: chain.programAddress },
      ),
    );
  }
  ixs.push(
    await getCommitInstructionAsync(
      {
        user,
        pool: poolAddress,
        mint: chain.mint,
        userToken: ata,
        vault: pool.vault,
        sgtToken: sgt?.sgtTokenAccount ?? undefined,
        device: deviceLock ?? undefined,
        dayIndex,
        amount,
        exercise: exerciseCodeOf(challenge.kind),
        goalTarget: challenge.goal,
      },
      { programAddress: chain.programAddress },
    ),
  );
  const unitLimit = Math.max(120_000, Math.ceil((CU_ESTIMATES.commit + (needsRegister ? CU_ESTIMATES.registerDevice : 0)) * 1.2));
  const tx = await finalizeTransaction(chain, account, { ixs, unitLimit });
  if (!tx.ok) return tx;

  const when = dayIndex === today ? "today" : `tomorrow (starts ${new Date(dayStart(dayIndex, cfg) * 1000).toUTCString().slice(17, 22)} UTC)`;
  const label = challengeLabel(challenge.kind, challenge.goal);
  return {
    ok: true,
    body: {
      type: "transaction",
      transaction: tx.body,
      message: `You're in: ${skrPretty(amount)} ${chain.tokenLabel} on ${label} ${when}. Open Fitr on your Seeker and finish before the deadline to get it back plus your share.`,
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Sponsor a day                                                                               */
/* ------------------------------------------------------------------------------------------ */

export function sponsorMetadata(lookup: PoolLookup, tokenLabel = "SKR"): ActionGetResponse {
  const title = "Sponsor a day on Fitr";
  if (lookup.kind !== "ok") {
    return {
      type: "action",
      icon: ACTION_ICON_URL,
      title,
      description: "Add SKR to the bonus for people who show up and finish their workout on Fitr.",
      label: lookup.kind === "missing" ? "Opens soon" : "Unavailable",
      disabled: true,
      error: { message: lookup.kind === "missing" ? "Fitr's vault opens soon." : lookup.message },
    };
  }
  const { pool, address: poolAddress } = lookup;
  const crew = crewName(pool);
  const perDay = pool.dailySponsorAmount;
  const description =
    `Boost the bonus for people who show up${crew ? ` in the "${crew}" crew` : ""}. Your SKR goes into this pool's sponsor reserve, ` +
    `which adds up to ${skrPretty(perDay)} ${tokenLabel} to each day's bonus — only on days where at least one person completes their workout. ` +
    `It is a gift, not an investment: it cannot be withdrawn by you or by Fitr, and it earns you nothing back. ` +
    `Reserve now: ${skrPretty(pool.reserve)} ${tokenLabel}.`;
  const base: ActionGetResponse = { type: "action", icon: ACTION_ICON_URL, title, description, label: "Sponsor" };
  if (perDay === 0n) {
    return {
      ...base,
      description:
        "Sponsored days are not switched on for this pool yet: deposits would sit in the reserve until a daily sponsor amount is set. Check back soon.",
      label: "Not open yet",
      disabled: true,
      error: { message: "Sponsoring is not open for this pool yet." },
    };
  }
  const isGlobal = pool.crewId === 0n;
  const href = (amount: string) => `${SPONSOR_ACTION_PATH}?${isGlobal ? "" : `pool=${poolAddress}&`}amount=${amount}`;
  const actions: LinkedAction[] = SPONSOR_PRESETS_SKR.map((s) => ({
    type: "transaction" as const,
    label: `Sponsor ${s} ${tokenLabel}`,
    href: href(String(s)),
  }));
  actions.push({
    type: "transaction",
    label: "Sponsor",
    href: href("{amount}"),
    parameters: [{ type: "number", name: "amount", label: `${tokenLabel} to add to the bonus`, required: true, min: 1 }],
  });
  return { ...base, links: { actions } };
}

/** Largest single sponsor deposit accepted through the Blink (a typo guard, not a program rule). */
export const MAX_SPONSOR_SKR = 10_000_000n * UNIT;

export async function sponsorTransaction(
  chain: ActionsChain,
  url: URL,
  rawAccount: unknown,
): Promise<ActionResult<ActionPostResponse>> {
  const account = parseAccount(rawAccount);
  if (!account) return fail(400, "Connect a valid Solana wallet first.");
  const amount = parseSkrAmount(url.searchParams.get("amount"));
  if (amount === null) return fail(400, "Enter how much SKR to sponsor.");
  if (amount > MAX_SPONSOR_SKR) return fail(400, "That amount is too large for one sponsorship.");
  const lookup = await lookupPool(chain, url.searchParams.get("pool"));
  if (lookup.kind === "missing") return fail(404, "Fitr's vault opens soon.");
  if (lookup.kind === "invalid") return fail(400, lookup.message);
  const { pool, address: poolAddress } = lookup;
  if (pool.dailySponsorAmount === 0n) return fail(409, "Sponsoring is not open for this pool yet.");

  const ata = await userTokenAccount(account, chain.mint);
  const ataAcc = await fetchEncodedAccount(chain.rpc, ata, { commitment: "confirmed" });
  const balance = ataAcc.exists && ataAcc.programAddress === TOKEN_PROGRAM_ADDRESS ? tokenBalance(Uint8Array.from(ataAcc.data), account, chain.mint) : 0n;
  if (balance < amount) {
    return fail(400, `Not enough ${chain.tokenLabel}: you have ${skrPretty(balance)}.`);
  }
  const ix = getFundReserveInstruction(
    { funder: createNoopSigner(account), pool: poolAddress, mint: chain.mint, funderToken: ata, vault: pool.vault, amount },
    { programAddress: chain.programAddress },
  );
  const tx = await finalizeTransaction(chain, account, { ixs: [ix], unitLimit: 60_000 });
  if (!tx.ok) return tx;
  return {
    ok: true,
    body: {
      type: "transaction",
      transaction: tx.body,
      message: `Thank you! ${skrPretty(amount)} ${chain.tokenLabel} goes to the bonus for people who show up and finish.`,
    },
  };
}
