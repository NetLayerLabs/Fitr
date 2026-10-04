/** In-memory chain for the Blinks / share card / dashboard tests. Never touches a network. */
import { address, getBase64Decoder, type Address, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { AccountState, getTokenEncoder, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getPoolAddresses, getUserDayAddresses, getDeviceLockAddress } from "@/lib/solana/vault/addresses";
import {
  FITR_VAULT_PROGRAM_ADDRESS,
  getCommitmentEncoder,
  getDayStateEncoder,
  getDeviceLockDiscriminatorBytes,
  getDeviceLockEncoder,
  getPoolEncoder,
  getUserProfileDiscriminatorBytes,
  getUserProfileEncoder,
  type Commitment,
  type DayState,
  type Pool,
  type UserProfile,
} from "@/lib/solana/vault/generated";
import { userTokenAccount } from "@/lib/solana/vault/instructions";
import type { SeekerStatus } from "@/lib/solana/types";
import { makePool, MINT, USER } from "@/lib/solana/vault/__tests__/fixtures";
import type { ActionsChain } from "../vaultActions";

export { MINT, USER };
export const PROGRAM = FITR_VAULT_PROGRAM_ADDRESS;
export const SGT_MINT = address("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
export const SGT_TOKEN = address("SysvarRent111111111111111111111111111111111");
const BLOCKHASH = "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn";

interface Acc {
  owner: Address;
  data: Uint8Array;
}

export interface SimResult {
  err: unknown;
  logs?: string[];
  unitsConsumed?: bigint;
}

const b64 = getBase64Decoder();

export class FakeChain {
  accounts = new Map<string, Acc>();
  sim: SimResult = { err: null, logs: [], unitsConsumed: 60_000n };
  simulated: string[] = [];
  gpaCalls: unknown[] = [];

  set(addr: Address, owner: Address, data: Uint8Array) {
    this.accounts.set(addr, { owner, data });
  }

  private info(a: string) {
    const acc = this.accounts.get(a);
    if (!acc) return null;
    return {
      data: [b64.decode(acc.data), "base64"],
      executable: false,
      lamports: 1_000_000n,
      owner: acc.owner,
      space: BigInt(acc.data.length),
      rentEpoch: 0n,
    };
  }

  rpc(): Rpc<SolanaRpcApi> {
    const send = <T>(v: () => T) => ({ send: async () => v() });
    const rpc = {
      getAccountInfo: (a: string) => send(() => ({ context: { slot: 1n }, value: this.info(a) })),
      getMultipleAccounts: (as: string[]) => send(() => ({ context: { slot: 1n }, value: as.map((a) => this.info(a)) })),
      getLatestBlockhash: () => send(() => ({ context: { slot: 1n }, value: { blockhash: BLOCKHASH, lastValidBlockHeight: 100n } })),
      simulateTransaction: (tx: string) =>
        send(() => {
          this.simulated.push(tx);
          return { context: { slot: 1n }, value: { err: this.sim.err, logs: this.sim.logs ?? [], unitsConsumed: this.sim.unitsConsumed ?? 0n } };
        }),
      getProgramAccounts: (program: string, cfg: { filters?: Array<Record<string, unknown>> }) =>
        send(() => {
          this.gpaCalls.push(cfg);
          const size = cfg.filters?.find((f) => "dataSize" in f)?.dataSize;
          const out = [];
          for (const [pubkey, acc] of this.accounts) {
            if (acc.owner !== program) continue;
            if (size !== undefined && BigInt(acc.data.length) !== size) continue;
            out.push({ pubkey, account: this.info(pubkey) });
          }
          return out;
        }),
    };
    return rpc as unknown as Rpc<SolanaRpcApi>;
  }
}

export async function seedPool(chain: FakeChain, over: Partial<Pool> = {}): Promise<{ pool: Address; vault: Address; data: Pool }> {
  const crewId = over.crewId ?? 0n;
  const { pool, vault } = await getPoolAddresses(MINT, PROGRAM, crewId);
  const data = makePool({ vault, ...over });
  chain.set(pool, PROGRAM, Uint8Array.from(getPoolEncoder().encode(data)));
  return { pool, vault, data };
}

export async function seedAta(chain: FakeChain, owner: Address, amount: bigint) {
  const ata = await userTokenAccount(owner, MINT);
  const data = getTokenEncoder().encode({
    mint: MINT,
    owner,
    amount,
    delegate: null,
    state: AccountState.Initialized,
    isNative: null,
    delegatedAmount: 0,
    closeAuthority: null,
  });
  chain.set(ata, TOKEN_PROGRAM_ADDRESS, Uint8Array.from(data));
  return ata;
}

export async function seedCommitment(chain: FakeChain, pool: Address, c: Commitment) {
  const { commitment } = await getUserDayAddresses({ pool, user: c.user, dayIndex: c.dayIndex, programAddress: PROGRAM });
  chain.set(commitment, PROGRAM, Uint8Array.from(getCommitmentEncoder().encode(c)));
  return commitment;
}

export async function seedProfile(chain: FakeChain, pool: Address, p: Omit<UserProfile, "discriminator" | "pool"> & { pool?: Address }) {
  const { profile } = await getUserDayAddresses({ pool, user: p.user, dayIndex: 0, programAddress: PROGRAM });
  chain.set(
    profile,
    PROGRAM,
    Uint8Array.from(getUserProfileEncoder().encode({ ...p, pool: p.pool ?? pool, discriminator: getUserProfileDiscriminatorBytes() } as UserProfile)),
  );
  return profile;
}

export function seedDayState(chain: FakeChain, at: Address, d: DayState) {
  chain.set(at, PROGRAM, Uint8Array.from(getDayStateEncoder().encode(d)));
}

export async function seedDeviceLock(chain: FakeChain, pool: Address) {
  const addr = await getDeviceLockAddress(pool, SGT_MINT, PROGRAM);
  chain.set(
    addr,
    PROGRAM,
    Uint8Array.from(
      getDeviceLockEncoder().encode({
        discriminator: getDeviceLockDiscriminatorBytes(),
        version: 1,
        bump: 255,
        pool,
        sgtMint: SGT_MINT,
        lastWallet: USER,
        commitCount: 1,
        recentDays: [0, 0],
        reserved: new Uint8Array(16),
      } as never),
    ),
  );
  return addr;
}

export function makeProfile(user: Address, over: Partial<UserProfile> = {}): Omit<UserProfile, "discriminator" | "pool"> {
  return {
    version: 1,
    bump: 255,
    user,
    currentStreak: 0,
    bestStreak: 0,
    hasCompleted: false,
    lastCompletedDay: 0,
    totalCommitted: 0,
    totalCompleted: 0,
    totalMissed: 0,
    totalBonusEarned: 0n,
    completedDaysMask: 0n,
    streakCarry: 0,
    lastCompletedAmount: 0n,
    reserved: new Uint8Array(32),
    ...over,
  };
}

export function seeker(owner: Address, isSeeker = true): SeekerStatus {
  return {
    owner,
    isSeeker,
    sgtMint: isSeeker ? SGT_MINT : null,
    sgtTokenAccount: isSeeker ? SGT_TOKEN : null,
    checkedAt: 0,
  };
}

export function actionsChain(chain: FakeChain, o: { nowSecs: number; seeker?: boolean; sgtThrows?: boolean }): ActionsChain {
  return {
    cluster: "mainnet",
    rpc: chain.rpc(),
    programAddress: PROGRAM,
    mint: MINT,
    tokenLabel: "SKR",
    findSgt: async (owner) => {
      if (o.sgtThrows) throw new Error("rpc down");
      return seeker(owner, o.seeker ?? true);
    },
    priorityFee: async () => 12_345n,
    nowSecs: () => o.nowSecs,
  };
}
