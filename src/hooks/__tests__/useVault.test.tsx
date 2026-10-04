// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayConfigFromPool } from "@/lib/solana/vault/day";
import { CommitmentStatus } from "@/lib/solana/vault/generated";
import type { VaultSnapshot } from "@/lib/solana/vault/read";
import { D0, T0, USER, ZERO, makeCommitment, makeDayState, makePool } from "@/lib/solana/vault/__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  fetchSnapshot: vi.fn(),
  owner: null as string | null,
  sessions: [] as unknown[],
}));

vi.mock("@/lib/solana/rpc", () => ({ getBrowserRpc: () => ({}) }));
vi.mock("@/lib/solana/vault/read", () => ({ fetchVaultSnapshot: mocks.fetchSnapshot }));
vi.mock("@/components/wallet/hooks", () => ({
  useSelectedWallet: () => ({ owner: mocks.owner }),
  useSeekerStatus: () => ({ status: "ready", data: { isSeeker: true, sgtMint: null, sgtTokenAccount: null }, error: null, refresh: () => {} }),
}));
vi.mock("../useSessions", () => ({ useNow: () => (T0 + 100) * 1000, useSessions: () => mocks.sessions }));

import { notifyVaultChanged, useVault } from "../useVault";
import { useTodayCommitment } from "../useTodayCommitment";

const pool = makePool();
function snap(): VaultSnapshot {
  return {
    pool,
    poolAddress: ZERO,
    vaultAddress: ZERO,
    programAddress: ZERO,
    cfg: dayConfigFromPool(pool),
    nowSecs: T0,
    today: D0,
    entries: [{ day: D0, commitment: makeCommitment(D0, { status: CommitmentStatus.Committed }), dayState: makeDayState(D0) }],
    profile: null,
    deviceLock: null,
  };
}

beforeEach(() => {
  mocks.fetchSnapshot.mockReset();
  mocks.owner = USER;
  mocks.sessions = [];
});
afterEach(cleanup);

describe("useVault", () => {
  it("unavailable when the pool account is missing", async () => {
    mocks.fetchSnapshot.mockResolvedValue(null);
    const { result } = renderHook(() => useVault(null));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("ready with the snapshot, refetches on notifyVaultChanged and keeps data on a failed refresh", async () => {
    mocks.fetchSnapshot.mockResolvedValueOnce(snap()).mockRejectedValueOnce(new Error("rate limited"));
    const { result } = renderHook(() => useVault(USER as never));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mocks.fetchSnapshot.mock.calls[0][1]).toMatchObject({ user: USER });
    act(() => notifyVaultChanged());
    await waitFor(() => expect(result.current.error).toBe("rate limited"));
    expect(result.current.status).toBe("ready");
    expect(result.current.snapshot?.today).toBe(D0);
  });
});

describe("useTodayCommitment", () => {
  it("no_wallet without an account", () => {
    mocks.owner = null;
    mocks.fetchSnapshot.mockResolvedValue(null);
    const { result } = renderHook(() => useTodayCommitment());
    expect(result.current).toEqual({ state: "no_wallet" });
  });

  it("committed, then verifying once a local session met the goal", async () => {
    mocks.fetchSnapshot.mockResolvedValue(snap());
    const { result, rerender } = renderHook(() => useTodayCommitment());
    await waitFor(() => expect(result.current.state).toBe("committed"));
    expect(result.current).toMatchObject({ exercise: "pushup", goalTarget: 20, amountLabel: "100 SKR" });
    mocks.sessions = [{ exercise: "pushup", endedAt: (T0 + 50) * 1000, summary: { reps: 21, holdMs: 0 } }];
    rerender();
    expect(result.current.state).toBe("verifying");
  });
});
