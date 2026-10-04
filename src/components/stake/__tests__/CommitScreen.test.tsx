// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { address } from "@solana/kit";
import { dayConfigFromPool } from "@/lib/solana/vault/day";
import { CommitmentStatus } from "@/lib/solana/vault/generated";
import type { VaultEntry, VaultSnapshot } from "@/lib/solana/vault/read";
import { D0, T0, USER, ZERO, makeCommitment, makeDayState, makePool } from "@/lib/solana/vault/__tests__/fixtures";

const SGT_MINT = address("3SSQo28JgsmT3EHhSSBHTNGCRvEApRHRT27eCdzjxk9q");
const SGT_ACCOUNT = address("8spLgJeVtV8PM4AwGT2hMbpk7zpk6rDqVrFRY1TRXsYj");

const ready = <T,>(data: T) => ({ status: "ready" as const, data, error: null, refresh: () => {} });

const mocks = vi.hoisted(() => ({
  owner: null as string | null,
  seeker: null as unknown,
  vault: null as unknown,
  now: 0,
  run: vi.fn(),
  reset: vi.fn(),
  txState: { phase: "idle", did: null, signature: null, error: null, unconfirmed: false } as Record<string, unknown>,
}));

vi.mock("@/components/wallet/hooks", () => ({
  useSelectedWallet: () => ({
    owner: mocks.owner,
    account: mocks.owner ? { address: mocks.owner } : undefined,
    wallet: undefined,
    wallets: [],
    setAccount: () => {},
  }),
  useSeekerStatus: () => mocks.seeker,
  useSkrBalance: () => ({ status: "ready", data: { amount: 500_000_000n, decimals: 6, exists: true }, error: null, refresh: () => {} }),
  useSolBalance: () => ({ status: "ready", data: 50_000_000n, error: null, refresh: () => {} }),
  useSendingSigner: () => ({}),
  notifyBalancesChanged: () => {},
}));
vi.mock("@/hooks/useVault", () => ({ useVault: () => mocks.vault, notifyVaultChanged: () => {} }));
vi.mock("@/hooks/useSessions", () => ({ useHydrated: () => true, useNow: () => mocks.now }));
vi.mock("@/components/wallet/ConnectWalletList", () => ({ default: () => <p>Use Installed Wallet</p> }));
vi.mock("../useVaultTx", () => ({
  useVaultTx: () => ({ state: mocks.txState, run: mocks.run, reset: mocks.reset }),
  isBusy: (p: string) => ["preparing", "simulating", "signing", "confirming"].includes(p),
}));

import CommitScreen from "../CommitScreen";

const pool = makePool();
function snapshot(entries: Array<Partial<VaultEntry> & { day: number }> = [], deviceLock: unknown = null): VaultSnapshot {
  return {
    pool,
    poolAddress: ZERO,
    vaultAddress: ZERO,
    programAddress: ZERO,
    cfg: dayConfigFromPool(pool),
    nowSecs: T0 + 100,
    today: D0,
    entries: [D0 + 1, D0, D0 - 1].map((day) => ({ day, commitment: null, dayState: null, ...entries.find((e) => e.day === day) })),
    profile: null,
    deviceLock: deviceLock as VaultSnapshot["deviceLock"],
  };
}
const vaultReady = (s: VaultSnapshot) => ({ status: "ready", snapshot: s, error: null, refresh: () => {} });

beforeEach(() => {
  mocks.owner = USER;
  mocks.seeker = ready({ owner: USER, isSeeker: true, sgtMint: SGT_MINT, sgtTokenAccount: SGT_ACCOUNT, checkedAt: 1 });
  mocks.vault = vaultReady(snapshot());
  mocks.now = (T0 + 100) * 1000;
  mocks.run.mockReset();
  mocks.txState = { phase: "idle", did: null, signature: null, error: null, unconfirmed: false };
});
afterEach(cleanup);

describe("CommitScreen gates", () => {
  it("no wallet: connect prompt, how it works, and the pool when known", () => {
    mocks.owner = null;
    mocks.seeker = { status: "idle", data: null, error: null, refresh: () => {} };
    mocks.vault = vaultReady(snapshot([{ day: D0, dayState: makeDayState(D0, { committedCount: 12 }) }]));
    render(<CommitScreen />);
    expect(screen.getByRole("heading", { name: "Connect your wallet" })).toBeTruthy();
    expect(screen.getByText("Use Installed Wallet")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Committed" }).textContent).toMatch(/12/);
    expect(screen.queryByRole("button", { name: /^Commit/ })).toBeNull();
  });

  it("non-Seeker on a Seeker-gated pool: honest copy and what still works", () => {
    mocks.seeker = ready({ owner: USER, isSeeker: false, sgtMint: null, sgtTokenAccount: null, checkedAt: 1 });
    render(<CommitScreen />);
    expect(screen.getByRole("heading", { name: "Staking is Seeker-only" })).toBeTruthy();
    expect(screen.getByText(/All 16 workouts/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Browse workouts/ }).getAttribute("href")).toBe("/workouts");
  });

  it("vault not deployed: staking opens soon, the app still works", () => {
    mocks.vault = { status: "unavailable", snapshot: null, error: null, refresh: () => {} };
    render(<CommitScreen />);
    expect(screen.getByRole("heading", { name: "Staking opens soon" })).toBeTruthy();
    expect(screen.getByText(/Nothing can be staked, and nothing is/)).toBeTruthy();
  });

  it("vault read error: retry", () => {
    const refresh = vi.fn();
    mocks.vault = { status: "error", snapshot: null, error: "boom", refresh };
    render(<CommitScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalled();
  });
});

describe("CommitScreen staking", () => {
  it("commits today with the SGT, registering the device on first use", () => {
    mocks.vault = vaultReady(snapshot([{ day: D0, dayState: makeDayState(D0, { committedCount: 3, totalStaked: 300_000_000n }) }]));
    render(<CommitScreen />);
    expect(screen.getByRole("heading", { name: "Today's pool" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "At stake" }).textContent).toMatch(/300/);
    fireEvent.change(screen.getByLabelText("Stake"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /^Commit 25 SKR/ }));
    expect(mocks.run).toHaveBeenCalledWith({
      plan: { settle: null, commit: true },
      commit: { dayIndex: D0, amount: 25_000_000n, exercise: 0, goalTarget: 20 },
      sgt: { mint: SGT_MINT, tokenAccount: SGT_ACCOUNT },
      registerDevice: true,
    });
  });

  it("committed today: shows the goal with Start workout, and offers tomorrow", () => {
    mocks.vault = vaultReady(snapshot([{ day: D0, commitment: makeCommitment(D0, { goalTarget: 30 }), dayState: makeDayState(D0) }], {}));
    render(<CommitScreen />);
    expect(screen.getByText("You're committed today")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start workout/ }).getAttribute("href")).toBe("/workout/pushup");
    expect(screen.getByText("Tomorrow")).toBeTruthy();
  });

  it("claimable yesterday: Claim alone, or bundled into the commit", () => {
    const y = {
      day: D0 - 1,
      commitment: makeCommitment(D0 - 1, { status: CommitmentStatus.Completed, weight: 100_000_000n }),
      dayState: makeDayState(D0 - 1, { finalized: true, distributable: 95_000_000n }),
    };
    mocks.vault = vaultReady(snapshot([y]));
    render(<CommitScreen />);
    expect(screen.getByRole("heading", { name: "147.5 SKR" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Claim" }));
    expect(mocks.run).toHaveBeenLastCalledWith({
      plan: { settle: { day: D0 - 1, kind: "claim", needsFinalize: false }, commit: false },
      commit: null,
      sgt: null,
      registerDevice: false,
    });
    fireEvent.change(screen.getByLabelText("Stake"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Claim & commit 5 SKR/ }));
    expect(mocks.run.mock.calls.at(-1)?.[0]).toMatchObject({
      plan: { settle: { day: D0 - 1, kind: "claim" }, commit: true },
    });
  });

  it("shows progress, friendly errors and the lime success moment", () => {
    mocks.txState = { ...mocks.txState, phase: "signing" };
    const { rerender } = render(<CommitScreen />);
    expect(screen.getByRole("status").textContent).toMatch(/Approve in your wallet/);

    mocks.txState = { ...mocks.txState, phase: "error", error: "Cancelled in your wallet. Nothing was sent." };
    rerender(<CommitScreen />);
    expect(screen.getByRole("alert").textContent).toMatch(/Cancelled in your wallet/);

    mocks.txState = { phase: "idle", did: null, signature: null, error: null, unconfirmed: false };
    rerender(<CommitScreen />);
    fireEvent.change(screen.getByLabelText("Stake"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Commit 10 SKR/ }));
    mocks.txState = { phase: "done", did: { committed: true, settled: null }, signature: "5sig", error: null, unconfirmed: false };
    rerender(<CommitScreen />);
    expect(screen.getByRole("heading", { name: "You're in." })).toBeTruthy();
    expect(screen.getByText(/10 SKR staked/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /View on Solana Explorer/ }).getAttribute("href")).toContain("/tx/5sig");
  });
});
