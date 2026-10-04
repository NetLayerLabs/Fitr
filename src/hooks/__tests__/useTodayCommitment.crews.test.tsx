// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayConfigFromPool } from "@/lib/solana/vault/day";
import { encodeCrewName } from "@/lib/solana/vault/crews";
import { CommitmentStatus, Exercise } from "@/lib/solana/vault/generated";
import type { VaultSnapshot } from "@/lib/solana/vault/read";
import { D0, T0, USER, ZERO, makeCommitment, makeDayState, makePool } from "@/lib/solana/vault/__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  global: null as unknown,
  crews: [] as unknown[],
  crewSnaps: undefined as Map<string, unknown> | undefined,
}));

vi.mock("@/components/wallet/hooks", () => ({
  useSelectedWallet: () => ({ owner: USER }),
  useSeekerStatus: () => ({ status: "ready", data: { isSeeker: true, sgtMint: null, sgtTokenAccount: null }, error: null, refresh: () => {} }),
}));
vi.mock("../useVault", () => ({ useVault: () => mocks.global }));
vi.mock("../useSessions", () => ({ useNow: () => (T0 + 100) * 1000, useSessions: () => [] }));
vi.mock("@/components/crews/useCrews", () => ({
  useMyCrews: () => ({ status: "ready", data: mocks.crews, error: null, refresh: () => {} }),
  useCrewVaults: () => ({ status: "ready", data: mocks.crewSnaps, error: null, refresh: () => {} }),
}));

import { useTodayCommitment, useTodayCommitments } from "../useTodayCommitment";

function snap(crewId: bigint, entries: VaultSnapshot["entries"]): VaultSnapshot {
  const pool = makePool({ crewId, name: crewId ? encodeCrewName(`Crew ${crewId}`) : new Uint8Array(32) });
  return { pool, poolAddress: ZERO, vaultAddress: ZERO, programAddress: ZERO, cfg: dayConfigFromPool(pool), nowSecs: T0, today: D0, entries, profile: null, deviceLock: null };
}
const crewInfo = (crewId: bigint) => ({ crewId, name: `Crew ${crewId}`, poolAddress: ZERO, creator: ZERO, fixedExercise: null, fixedGoal: null, requireSgt: true, paused: false });

beforeEach(() => {
  mocks.global = { status: "ready", snapshot: snap(0n, [{ day: D0, commitment: makeCommitment(D0, { status: CommitmentStatus.Completed }), dayState: makeDayState(D0) }]), error: null, refresh: () => {} };
  mocks.crews = [crewInfo(5n)];
  mocks.crewSnaps = new Map([["5", snap(5n, [{ day: D0, commitment: makeCommitment(D0, { exercise: Exercise.Squat, goalTarget: 30 }), dayState: makeDayState(D0) }])]]);
});
afterEach(cleanup);

describe("useTodayCommitments (multi-pool)", () => {
  it("shows the open crew goal over a verified global day, with the crew attached", () => {
    const { result } = renderHook(() => useTodayCommitment());
    expect(result.current).toMatchObject({ state: "committed", exercise: "squat", goalTarget: 30, crewId: "5", crewName: "Crew 5" });
  });

  it("lists every pool, global first", () => {
    const { result } = renderHook(() => useTodayCommitments());
    expect(result.current.pools.map((p) => [p.crewId, p.state])).toEqual([
      [0n, "verified"],
      [5n, "committed"],
    ]);
  });

  it("without crews the global summary is returned untouched", () => {
    mocks.crews = [];
    mocks.crewSnaps = undefined;
    const { result } = renderHook(() => useTodayCommitment());
    expect(result.current.state).toBe("verified");
    expect(result.current).not.toHaveProperty("crewId");
  });

  it("a crew whose snapshot is missing is skipped", () => {
    mocks.crewSnaps = new Map([["5", null]]);
    const { result } = renderHook(() => useTodayCommitments());
    expect(result.current.pools).toHaveLength(1);
  });
});
