/**
 * In-memory vault accounts behind the three RPC methods the crew readers use (getAccountInfo,
 * getMultipleAccounts, getProgramAccounts with dataSize + memcmp filters). Test helper.
 */
import {
  getBase58Encoder,
  getBase64Decoder,
  type Address,
} from "@solana/kit";
import { getPoolAddresses, getUserDayAddresses } from "@/lib/solana/vault/addresses";
import {
  FITR_VAULT_PROGRAM_ADDRESS,
  getCommitmentEncoder,
  getDayStateEncoder,
  getPoolEncoder,
  getUserProfileEncoder,
  type Commitment,
  type DayState,
  type Pool,
  type UserProfile,
} from "@/lib/solana/vault/generated";
import { MINT, makeCommitment, makeDayState, makePool } from "@/lib/solana/vault/__tests__/fixtures";

export const PROGRAM = FITR_VAULT_PROGRAM_ADDRESS;

type Filter = { dataSize?: bigint | number; memcmp?: { offset: bigint | number; bytes: string } };

const b64 = getBase64Decoder();
const b58 = getBase58Encoder();

function rpcAccount(data: Uint8Array, owner: Address) {
  return { data: [b64.decode(data), "base64"], executable: false, lamports: 1_000_000n, owner, space: BigInt(data.length), rentEpoch: 0n };
}

export function makeProfile(pool: Address, user: Address, over: Partial<UserProfile> = {}): UserProfile {
  return {
    discriminator: new Uint8Array(8),
    version: 1,
    bump: 255,
    pool,
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

export class FakeChain {
  readonly accounts = new Map<Address, { data: Uint8Array; owner: Address }>();
  calls: string[] = [];
  failProgramAccounts = false;

  set(addr: Address, data: Uint8Array, owner: Address = PROGRAM) {
    this.accounts.set(addr, { data, owner });
  }

  async pool(crewId: bigint, over: Partial<Pool> = {}): Promise<Address> {
    const { pool } = await getPoolAddresses(MINT, PROGRAM, crewId);
    this.set(pool, new Uint8Array(getPoolEncoder().encode(makePool({ crewId, ...over }))));
    return pool;
  }

  async commitment(pool: Address, user: Address, day: number, over: Partial<Commitment> = {}): Promise<Address> {
    const { commitment } = await getUserDayAddresses({ pool, user, dayIndex: day, programAddress: PROGRAM });
    this.set(commitment, new Uint8Array(getCommitmentEncoder().encode(makeCommitment(day, { user, ...over }, pool))));
    return commitment;
  }

  async day(pool: Address, day: number, over: Partial<DayState> = {}): Promise<Address> {
    const { day: addr } = await getUserDayAddresses({ pool, user: pool, dayIndex: day, programAddress: PROGRAM });
    this.set(addr, new Uint8Array(getDayStateEncoder().encode(makeDayState(day, over, pool))));
    return addr;
  }

  async profile(pool: Address, user: Address, over: Partial<UserProfile> = {}): Promise<Address> {
    const { profile } = await getUserDayAddresses({ pool, user, dayIndex: 0, programAddress: PROGRAM });
    this.set(profile, new Uint8Array(getUserProfileEncoder().encode(makeProfile(pool, user, over))));
    return profile;
  }

  private matches(data: Uint8Array, filters: Filter[]): boolean {
    for (const f of filters) {
      if (f.dataSize !== undefined && data.length !== Number(f.dataSize)) return false;
      if (f.memcmp) {
        const want = b58.encode(f.memcmp.bytes);
        const off = Number(f.memcmp.offset);
        for (let i = 0; i < want.length; i++) if (data[off + i] !== want[i]) return false;
      }
    }
    return true;
  }

  rpc() {
    const send = <T>(v: T) => ({ send: async () => v });
    return {
      getAccountInfo: (addr: Address) => {
        this.calls.push("getAccountInfo");
        const a = this.accounts.get(addr);
        return send({ context: { slot: 1n }, value: a ? rpcAccount(a.data, a.owner) : null });
      },
      getMultipleAccounts: (addrs: Address[]) => {
        this.calls.push("getMultipleAccounts");
        return send({
          context: { slot: 1n },
          value: addrs.map((x) => {
            const a = this.accounts.get(x);
            return a ? rpcAccount(a.data, a.owner) : null;
          }),
        });
      },
      getProgramAccounts: (program: Address, cfg: { filters?: Filter[] }) => {
        this.calls.push("getProgramAccounts");
        if (this.failProgramAccounts) return { send: async () => Promise.reject(new Error("gPA disabled")) };
        const rows = [...this.accounts.entries()]
          .filter(([, a]) => a.owner === program && this.matches(a.data, cfg.filters ?? []))
          .map(([pubkey, a]) => ({ pubkey, account: rpcAccount(a.data, a.owner) }));
        return send(rows);
      },
    } as never;
  }
}
