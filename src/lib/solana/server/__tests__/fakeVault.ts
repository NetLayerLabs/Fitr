/**
 * Test double: an in-memory "cluster" holding vault accounts behind the subset of the Solana RPC
 * that attestor.ts / onchain.ts use. Sent transactions are decoded and applied with simplified
 * program rules (enough to exercise retries, idempotency and error mapping). Never touches a network.
 */
import {
  address,
  generateKeyPairSigner,
  getAddressDecoder,
  getBase58Decoder,
  getBase58Encoder,
  getBase64Decoder,
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  getU32Decoder,
  SolanaError,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  type Address,
  type KeyPairSigner,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { getPoolAddresses, getUserDayAddresses } from "@/lib/solana/vault/addresses";
import {
  ATTEST_COMPLETION_DISCRIMINATOR,
  CLOSE_MISSED_DISCRIMINATOR,
  CommitmentStatus,
  Exercise,
  FINALIZE_DAY_DISCRIMINATOR,
  FITR_VAULT_PROGRAM_ADDRESS,
  getCommitmentDecoder,
  getCommitmentEncoder,
  getDayStateDecoder,
  getDayStateEncoder,
  getPoolEncoder,
  SWEEP_DAY_DISCRIMINATOR,
  SYNC_CREW_DISCRIMINATOR,
  getPoolDecoder,
  type CommitmentArgs,
  type DayStateArgs,
  type PoolArgs,
} from "@/lib/solana/vault/generated";
import type { ServerSolana } from "../attestor";

export const MINT = address("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");
export const DAY_LEN = 86_400;
const ZERO = address("11111111111111111111111111111111");
const BLOCKHASH = "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn";

export interface SentTx {
  kind: "finalize" | "close_missed" | "sweep" | "attest" | "sync_crew" | "unknown";
  days: number[];
  users: Address[];
  signature: string;
  /** finalize_day: [pool, global_pool]. */
  pools?: Address[];
}

function eq(a: ArrayLike<number>, b: ArrayLike<number>, n = b.length): boolean {
  if (a.length < n) return false;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function poolArgs(attestor: Address, over: Partial<PoolArgs> = {}): PoolArgs {
  return {
    version: 1,
    bump: 255,
    vaultBump: 254,
    paused: false,
    requireSgt: false,
    mintDecimals: 6,
    authority: ZERO,
    pendingAuthority: ZERO,
    attestor,
    mint: MINT,
    vault: ZERO,
    dayLengthSecs: DAY_LEN,
    dayOffsetSecs: 0,
    commitCutoffSecs: 64_800,
    attestGraceSecs: 3_600,
    minStake: 1_000_000,
    maxStake: 10_000_000_000,
    feeBps: 500,
    streakBonusBps: 500,
    maxStreakBonusBps: 5000,
    goalLimits: Array.from({ length: 16 }, () => ({ min: 1, max: 1000 })),
    dailySponsorAmount: 0,
    reserve: 0,
    treasuryAccrued: 0,
    outstanding: 0,
    finalizeDelaySecs: 0,
    pausedSince: 0,
    totalPausedSecs: 0,
    crewId: 0,
    creator: ZERO,
    name: new Uint8Array(32),
    hasFixedExercise: false,
    fixedExercise: Exercise.Pushup,
    fixedGoalTarget: 0,
    rollover: 0,
    reserved: new Uint8Array(56),
    ...over,
  };
}

export class FakeVault {
  readonly accounts = new Map<string, Uint8Array>();
  readonly sent: SentTx[] = [];
  nowSecs = 20721 * DAY_LEN + 7200;
  /** finalize_day keeps failing with DayNotOver this many more times (chain clock lag). */
  dayNotOverLag = 0;
  /** Next sendTransaction throws this program error in preflight. */
  failNextWith: number | null = null;
  /** Next transaction lands but fails on-chain with this program error. */
  failOnChainWith: number | null = null;
  priorityFeeCalls = 0;
  private statuses = new Map<string, { err: unknown }>();
  private counter = 0;
  pool!: Address;
  signer!: KeyPairSigner;

  async init(over: Partial<PoolArgs> = {}): Promise<this> {
    this.signer = await generateKeyPairSigner();
    this.pool = (await getPoolAddresses(MINT, FITR_VAULT_PROGRAM_ADDRESS)).pool;
    this.accounts.set(this.pool, new Uint8Array(getPoolEncoder().encode(poolArgs(this.signer.address, over))));
    return this;
  }

  /** A crew pool (copied config, its own crew id) next to the global pool; returns its address. */
  async addCrew(crewId: bigint, over: Partial<PoolArgs> = {}): Promise<Address> {
    const { pool } = await getPoolAddresses(MINT, FITR_VAULT_PROGRAM_ADDRESS, crewId);
    this.accounts.set(pool, new Uint8Array(getPoolEncoder().encode(poolArgs(this.signer.address, { crewId, ...over }))));
    return pool;
  }

  async addCommitment(user: Address, day: number, over: Partial<CommitmentArgs> = {}, pool: Address = this.pool): Promise<Address> {
    const { commitment } = await getUserDayAddresses({ pool, user, dayIndex: day, programAddress: FITR_VAULT_PROGRAM_ADDRESS });
    const args: CommitmentArgs = {
      bump: 1,
      status: CommitmentStatus.Committed,
      pool,
      user,
      dayIndex: day,
      version: 1,
      exercise: Exercise.Pushup,
      goalTarget: 20,
      amount: 5_000_000,
      weight: 0,
      committedAt: day * DAY_LEN + 60,
      attestedAt: 0,
      sessionStartedAt: 0,
      reps: 0,
      sessionHash: new Uint8Array(32),
      device: ZERO,
      reserved: new Uint8Array(32),
      ...over,
    };
    this.accounts.set(commitment, new Uint8Array(getCommitmentEncoder().encode(args)));
    return commitment;
  }

  async addDay(day: number, over: Partial<DayStateArgs> = {}, pool: Address = this.pool): Promise<Address> {
    const { day: addr } = await getUserDayAddresses({ pool, user: ZERO, dayIndex: day, programAddress: FITR_VAULT_PROGRAM_ADDRESS });
    const args: DayStateArgs = {
      version: 1,
      bump: 1,
      finalized: false,
      voided: false,
      pool,
      dayIndex: day,
      rentPayer: ZERO,
      feeBps: 500,
      streakBonusBps: 500,
      maxStreakBonusBps: 5000,
      attestDeadline: (day + 1) * DAY_LEN + 3600,
      committedCount: 0,
      completedCount: 0,
      resolvedCount: 0,
      totalStaked: 0,
      completedStake: 0,
      completedWeight: 0,
      fee: 0,
      sponsor: 0,
      distributable: 0,
      principalPaid: 0,
      bonusPaid: 0,
      attestor: this.signer.address,
      sponsorCap: 0,
      finalizeDelaySecs: 0,
      pausedSecsBase: 0,
      revokedCount: 0,
      revokedStake: 0,
      globalPausedSecsBase: 0,
      rollover: 0,
      reserved: new Uint8Array(16),
      ...over,
    };
    this.accounts.set(addr, new Uint8Array(getDayStateEncoder().encode(args)));
    return addr;
  }

  dayState(addr: Address) {
    const d = this.accounts.get(addr);
    return d ? getDayStateDecoder().decode(d) : null;
  }

  commitment(addr: Address) {
    const d = this.accounts.get(addr);
    return d ? getCommitmentDecoder().decode(d) : null;
  }

  private setDay(addr: Address, patch: Partial<DayStateArgs>) {
    const cur = this.dayState(addr)!;
    this.accounts.set(addr, new Uint8Array(getDayStateEncoder().encode({ ...cur, ...patch })));
  }

  private programError(code: number): Error {
    return new Error("Transaction simulation failed", {
      cause: new SolanaError(SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM, { code, index: 2 }),
    });
  }

  private apply(wire: string): SentTx {
    const bytes = new Uint8Array(getBase64Encoder().encode(wire));
    const tx = getTransactionDecoder().decode(bytes);
    const msg = getCompiledTransactionMessageDecoder().decode(tx.messageBytes) as unknown as {
      staticAccounts: Address[];
      instructions: Array<{ programAddressIndex: number; accountIndices?: number[]; data?: Uint8Array }>;
    };
    const keys = msg.staticAccounts;
    const first = Object.values(tx.signatures)[0];
    const signature = first ? getBase58Decoder().decode(first) : `sig${++this.counter}`;
    const out: SentTx = { kind: "unknown", days: [], users: [], signature };
    const u32 = getU32Decoder();
    for (const ix of msg.instructions) {
      if (keys[ix.programAddressIndex] !== FITR_VAULT_PROGRAM_ADDRESS || !ix.data) continue;
      const data = ix.data;
      const acc = (i: number) => keys[ix.accountIndices![i]];
      if (eq(data, SYNC_CREW_DISCRIMINATOR)) {
        out.kind = "sync_crew";
        out.pools = [...(out.pools ?? []), acc(0)];
        const crew = getPoolDecoder().decode(this.accounts.get(acc(0))!);
        const global = getPoolDecoder().decode(this.accounts.get(acc(1))!);
        if (crew.crewId === 0n) throw this.programError(6030);
        this.accounts.set(
          acc(0),
          new Uint8Array(
            getPoolEncoder().encode({
              ...crew,
              authority: global.authority,
              attestor: global.attestor,
              requireSgt: global.requireSgt,
              pendingAuthority: ZERO,
            }),
          ),
        );
        continue;
      }
      const day = u32.decode(data, 8);
      out.days.push(day);
      if (eq(data, FINALIZE_DAY_DISCRIMINATOR)) {
        out.kind = "finalize";
        out.pools = [acc(1), acc(3)];
        const ds = this.dayState(acc(2))!;
        if (ds.finalized) throw this.programError(6010);
        if (this.dayNotOverLag > 0 || this.nowSecs <= Number(ds.attestDeadline)) {
          this.dayNotOverLag = Math.max(0, this.dayNotOverLag - 1);
          throw this.programError(6009);
        }
        this.setDay(acc(2), { finalized: true });
      } else if (eq(data, CLOSE_MISSED_DISCRIMINATOR)) {
        out.kind = "close_missed";
        out.users.push(acc(2));
        const ds = this.dayState(acc(3))!;
        if (!ds.finalized) throw this.programError(6011);
        const c = this.commitment(acc(4));
        if (!c || c.status !== CommitmentStatus.Committed) throw this.programError(6013);
        this.accounts.delete(acc(4));
        this.setDay(acc(3), { resolvedCount: ds.resolvedCount + 1 });
      } else if (eq(data, SWEEP_DAY_DISCRIMINATOR)) {
        out.kind = "sweep";
        const ds = this.dayState(acc(3))!;
        if (ds.resolvedCount !== ds.committedCount) throw this.programError(6018);
        this.accounts.delete(acc(3));
      } else if (eq(data, ATTEST_COMPLETION_DISCRIMINATOR)) {
        out.kind = "attest";
        out.users.push(acc(2));
        if (acc(0) !== this.signer.address) throw this.programError(6002);
        const c = this.commitment(acc(4))!;
        if (c.status !== CommitmentStatus.Committed) throw this.programError(6013);
        const reps = u32.decode(data, 12);
        if (reps < c.goalTarget) throw this.programError(6025);
        this.accounts.set(
          acc(4),
          new Uint8Array(getCommitmentEncoder().encode({ ...c, status: CommitmentStatus.Completed, reps })),
        );
      }
    }
    return out;
  }

  rpc(): Rpc<SolanaRpcApi> {
    const b64 = getBase64Decoder();
    const send = <T>(fn: () => T | Promise<T>) => ({ send: async () => fn() });
    const api = {
      getAccountInfo: (addr: Address) =>
        send(() => {
          const d = this.accounts.get(addr);
          return {
            context: { slot: 1n },
            value: d
              ? { data: [b64.decode(d), "base64"], executable: false, lamports: 1_000_000n, owner: FITR_VAULT_PROGRAM_ADDRESS, space: BigInt(d.length), rentEpoch: 0n }
              : null,
          };
        }),
      getLatestBlockhash: () => send(() => ({ context: { slot: 1n }, value: { blockhash: BLOCKHASH, lastValidBlockHeight: 1000n } })),
      sendTransaction: (wire: string) =>
        send(() => {
          if (this.failNextWith !== null) {
            const code = this.failNextWith;
            this.failNextWith = null;
            throw this.programError(code);
          }
          const snapshot = new Map(this.accounts);
          let tx: SentTx;
          try {
            tx = this.apply(wire);
          } catch (e) {
            this.accounts.clear();
            for (const [k, v] of snapshot) this.accounts.set(k, v);
            throw e;
          }
          this.sent.push(tx);
          if (this.failOnChainWith !== null) {
            this.statuses.set(tx.signature, { err: { InstructionError: [2, { Custom: this.failOnChainWith }] } });
            this.failOnChainWith = null;
            this.accounts.clear();
            for (const [k, v] of snapshot) this.accounts.set(k, v);
          } else {
            this.statuses.set(tx.signature, { err: null });
          }
          return tx.signature;
        }),
      getSignatureStatuses: (sigs: string[]) =>
        send(() => ({
          context: { slot: 1n },
          value: sigs.map((s) => {
            const st = this.statuses.get(s);
            return st ? { confirmationStatus: "confirmed", err: st.err, confirmations: 1n, slot: 1n, status: null } : null;
          }),
        })),
      getProgramAccounts: (_program: Address, cfg: { filters: Array<{ dataSize?: bigint; memcmp?: { offset: bigint; bytes: string } }> }) =>
        send(() => {
          const out: Array<{ pubkey: Address; account: { data: [string, "base64"] } }> = [];
          for (const [k, d] of this.accounts) {
            const ok = cfg.filters.every((f) => {
              if (f.dataSize !== undefined) return BigInt(d.length) === f.dataSize;
              if (f.memcmp) {
                const want = getBase58Encoder().encode(f.memcmp.bytes);
                const off = Number(f.memcmp.offset);
                return eq(d.subarray(off), want);
              }
              return true;
            });
            if (ok) out.push({ pubkey: address(k), account: { data: [b64.decode(d), "base64"] } });
          }
          return out;
        }),
      getSignaturesForAddress: () =>
        send(() => [...this.statuses.entries()].reverse().map(([signature, s]) => ({ signature, err: s.err }))),
    };
    return api as unknown as Rpc<SolanaRpcApi>;
  }

  context(): ServerSolana {
    const fetchImpl = (async () => {
      this.priorityFeeCalls++;
      return Response.json({ jsonrpc: "2.0", id: "fitr-fee", result: { priorityFeeEstimate: 25_000 } });
    }) as unknown as typeof fetch;
    return {
      rpc: this.rpc(),
      upstreamUrl: "https://mainnet.helius-rpc.com/?api-key=TEST_KEY",
      signer: this.signer,
      programAddress: FITR_VAULT_PROGRAM_ADDRESS,
      mint: MINT,
      fetchImpl,
    };
  }
}

export const addressDecoder = getAddressDecoder();
