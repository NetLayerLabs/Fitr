// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { address } from "@solana/kit";
import { dayConfigFromPool } from "@/lib/solana/vault/day";
import { encodeCrewName } from "@/lib/solana/vault/crews";
import { CommitmentStatus, Exercise, type Pool } from "@/lib/solana/vault/generated";
import type { VaultSnapshot } from "@/lib/solana/vault/read";
import { D0, T0, USER, ZERO, makeCommitment, makeDayState, makePool } from "@/lib/solana/vault/__tests__/fixtures";
import { makeProfile } from "./fakeChain";

const OTHER = address("Vote111111111111111111111111111111111111111");
const CREW_POOL = address("SysvarC1ock11111111111111111111111111111111");

const mocks = vi.hoisted(() => ({
  closed: new Set<string>(),
  owner: null as string | null,
  vault: null as unknown,
  board: null as unknown,
  crews: [] as unknown[],
  push: vi.fn(),
  remember: vi.fn(),
  run: vi.fn(),
  createRun: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/crew/7" }));
vi.mock("@/components/wallet/hooks", () => ({
  useSelectedWallet: () => ({ owner: mocks.owner, account: mocks.owner ? { address: mocks.owner } : undefined }),
  useSeekerStatus: () => ({ status: "ready", data: { isSeeker: true, sgtMint: null, sgtTokenAccount: null }, error: null, refresh: () => {} }),
  useSkrBalance: () => ({ status: "ready", data: { amount: 500_000_000n, decimals: 6, exists: true }, error: null, refresh: () => {} }),
  useSolBalance: () => ({ status: "ready", data: 50_000_000n, error: null, refresh: () => {} }),
  useSendingSigner: () => ({}),
  notifyBalancesChanged: () => {},
}));
vi.mock("@/hooks/useVault", () => ({ useVault: () => mocks.vault, notifyVaultChanged: () => {}, useVaultVersion: () => 0 }));
vi.mock("@/hooks/useSessions", () => ({ useHydrated: () => true, useNow: () => (T0 + 3600) * 1000, useSessions: () => [] }));
vi.mock("@/components/wallet/ConnectWalletList", () => ({ default: () => <p>Use Installed Wallet</p> }));
vi.mock("@/components/crews/useCrews", () => ({
  useCrewBoard: () => mocks.board,
  useMyCrews: () => ({ status: "ready", data: mocks.crews, error: null, refresh: () => {} }),
  useCrewVaults: () => ({ status: "idle", data: undefined, error: null, refresh: () => {} }),
  rememberCrew: mocks.remember,
  useClosedCrews: () => mocks.closed,
  forgetCrew: () => {},
  refreshClosedCrews: () => {},
}));
vi.mock("@/components/stake/useVaultTx", () => ({
  useVaultTx: () => ({ state: { phase: "idle", did: null, signature: null, error: null, unconfirmed: false }, run: mocks.run, reset: () => {} }),
  isBusy: () => false,
}));
vi.mock("@/components/crews/useCreateCrew", () => ({
  useCreateCrew: () => ({ state: { phase: "idle", crewId: null, signature: null, error: null }, run: mocks.createRun, reset: () => {} }),
}));

import CrewScreen from "../CrewScreen";
import CrewHub from "../CrewHub";
import CommitmentsToday from "../CommitmentsToday";
import StakeForm from "@/components/stake/StakeForm";

function crewSnapshot(over: Partial<Pool> = {}, entries: VaultSnapshot["entries"] = []): VaultSnapshot {
  const pool = makePool({
    crewId: 7n,
    name: encodeCrewName("Run Club"),
    hasFixedExercise: true,
    fixedExercise: Exercise.Pushup,
    fixedGoalTarget: 25,
    ...over,
  });
  return {
    pool,
    poolAddress: CREW_POOL,
    vaultAddress: ZERO,
    programAddress: ZERO,
    cfg: dayConfigFromPool(pool),
    nowSecs: T0 + 3600,
    today: D0,
    entries: entries.length ? entries : [D0 + 1, D0, D0 - 1].map((day) => ({ day, commitment: null, dayState: null })),
    profile: null,
    deviceLock: null,
  };
}

beforeEach(() => {
  mocks.owner = USER;
  mocks.vault = { status: "ready", snapshot: crewSnapshot(), error: null, refresh: () => {} };
  mocks.board = {
    status: "ready",
    error: null,
    refresh: () => {},
    data: {
      today: [
        makeCommitment(D0, { user: USER, goalTarget: 25 }, CREW_POOL),
        makeCommitment(D0, { user: OTHER, goalTarget: 25, status: CommitmentStatus.Completed }, CREW_POOL),
      ],
      days: [makeDayState(D0 - 1, { committedCount: 2, completedCount: 2, finalized: true }, CREW_POOL)],
      profiles: [
        makeProfile(CREW_POOL, USER, { totalCompleted: 3, totalCommitted: 4, currentStreak: 1, hasCompleted: true, lastCompletedDay: D0 - 1, totalBonusEarned: 2_500_000n }),
        makeProfile(CREW_POOL, OTHER, { totalCompleted: 4, totalCommitted: 4, currentStreak: 4, hasCompleted: true, lastCompletedDay: D0 }),
      ],
    },
  };
  mocks.crews = [];
  mocks.closed = new Set();
  mocks.push.mockReset();
  mocks.remember.mockReset();
  mocks.run.mockReset();
  mocks.createRun.mockReset();
});
afterEach(cleanup);

describe("CrewScreen", () => {
  it("shows the challenge, invite link, today's members, streak and leaderboard, and remembers the crew", () => {
    render(<CrewScreen crewId={7n} />);
    expect(screen.getByRole("heading", { level: 1, name: "Run Club" })).toBeTruthy();
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByLabelText("Invite link").textContent).toBe("https://fitr.day/c/7");
    const today = screen.getByRole("heading", { name: "Today" }).closest("section")!;
    expect(within(today).getByText("You")).toBeTruthy();
    expect(within(today).getByText("Verified")).toBeTruthy();
    expect(within(today).getByText("Committed")).toBeTruthy();
    expect(screen.getByText("1/2")).toBeTruthy(); // verified today
    expect(screen.getByRole("group", { name: "Crew streak" }).textContent).toMatch(/^1/);
    const board = screen.getByRole("list", { name: "Crew leaderboard" });
    const rows = within(board).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText(/4 days verified · streak 4/)).toBeTruthy();
    expect(within(rows[1]).getByText("You")).toBeTruthy();
    expect(mocks.remember).toHaveBeenCalledWith(7n);
  });

  it("commits into the crew pool with the crew's exercise and goal locked", () => {
    mocks.board = { ...(mocks.board as object), data: { today: [], days: [], profiles: [] } };
    render(<CrewScreen crewId={7n} />);
    expect(screen.getByTestId("locked-exercise").textContent).toMatch(/Push-ups/i);
    expect(screen.getByTestId("locked-goal").textContent).toMatch(/25 push-ups/i);
    fireEvent.change(screen.getByLabelText("Stake"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Commit/ }));
    expect(mocks.run).toHaveBeenCalledTimes(1);
    const req = mocks.run.mock.calls[0][0];
    expect(req.crewId).toBe(7n);
    expect(req.commit).toMatchObject({ dayIndex: D0, exercise: Exercise.Pushup, goalTarget: 25, amount: 10_000_000n });
  });

  it("a deleted crew: notice, no invite link, no stake form", () => {
    mocks.closed = new Set(["7"]);
    render(<CrewScreen crewId={7n} />);
    expect(screen.getByRole("heading", { name: "This crew was deleted" })).toBeTruthy();
    expect(screen.queryByLabelText("Invite link")).toBeNull();
    expect(screen.queryByLabelText("Stake")).toBeNull();
    expect(mocks.remember).not.toHaveBeenCalled();
  });

  it("crew not found", () => {
    mocks.vault = { status: "unavailable", snapshot: null, error: null, refresh: () => {} };
    render(<CrewScreen crewId={7n} />);
    expect(screen.getByRole("heading", { name: "Crew not found" })).toBeTruthy();
    expect(mocks.remember).not.toHaveBeenCalled();
  });

  it("asks to connect a wallet before committing", () => {
    mocks.owner = null;
    render(<CrewScreen crewId={7n} />);
    expect(screen.getByText("Use Installed Wallet")).toBeTruthy();
  });
});

describe("CrewHub", () => {
  const globalPool = makePool();

  it("lists your crews and opens an invite you paste", () => {
    mocks.crews = [
      { crewId: 7n, name: "Run Club", fixedExercise: "pushup", fixedGoal: 25, creator: USER, poolAddress: CREW_POOL, requireSgt: true, paused: false },
      { crewId: 9n, name: "", fixedExercise: null, fixedGoal: null, creator: OTHER, poolAddress: OTHER, requireSgt: true, paused: false },
    ];
    render(<CrewHub account={{ address: USER } as never} owner={USER} globalPool={globalPool} />);
    const list = screen.getByRole("heading", { name: "Your crews" }).parentElement!;
    expect(within(list).getByRole("link", { name: /Run Club.*25 push-ups for everyone.*Yours/ }).getAttribute("href")).toBe("/crew/7");
    expect(within(list).getByRole("link", { name: /Crew 9/ }).getAttribute("href")).toBe("/crew/9");

    const input = screen.getByRole("textbox", { name: "Invite link or crew number" });
    fireEvent.change(input, { target: { value: "evil.example/c/1" } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText(/Paste an invite link/)).toBeTruthy();
    fireEvent.change(input, { target: { value: "https://fitr.day/c/123" } });
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(mocks.push).toHaveBeenCalledWith("/crew/123");
  });

  it("creates a crew with an optional fixed exercise and goal", async () => {
    mocks.createRun.mockResolvedValue(555n);
    render(<CrewHub account={{ address: USER } as never} owner={USER} globalPool={globalPool} />);
    fireEvent.click(screen.getByRole("button", { name: "Create crew" }));
    expect(screen.getByText("Give your crew a name.")).toBeTruthy();
    expect(mocks.createRun).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Crew name" }), { target: { value: "Morning Movers" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Everyone does the same exercise" }));
    fireEvent.click(screen.getByRole("radio", { name: /Squat/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Same goal for everyone" }));
    fireEvent.click(screen.getByRole("button", { name: "Create crew" }));
    await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/crew/555"));
    expect(mocks.createRun).toHaveBeenCalledWith({ name: "Morning Movers", exercise: "squat", goalTarget: 25 });
  });
});

describe("CommitmentsToday", () => {
  it("lists every pool once a crew is involved, linking the open one to its workout", () => {
    render(
      <CommitmentsToday
        pools={[
          { state: "verified", exercise: "pushup", goalTarget: 20, amountLabel: "10 SKR", forDay: "today", crewId: 0n, crewName: "" },
          { state: "committed", exercise: "squat", goalTarget: 30, amountLabel: "5 SKR", forDay: "today", crewId: 7n, crewName: "Run Club" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/workout/squat?crew=7", "/commit"]);
    expect(links[0].textContent).toMatch(/Run Club.*30 squats.*To do/);
  });

  it("renders nothing for the global pool alone", () => {
    const { container } = render(
      <CommitmentsToday pools={[{ state: "committed", exercise: "pushup", goalTarget: 20, forDay: "today", crewId: 0n, crewName: "" }]} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("StakeForm locked fields", () => {
  it("free crews keep the picker; a fixed exercise without a goal keeps the stepper", () => {
    const pool = makePool();
    const cfg = dayConfigFromPool(pool);
    const base = { pool, cfg, targetDay: D0, isTomorrow: false, decimals: 6, label: "SKR", balance: 10n ** 9n, solShortfall: null, bundledClaim: null, busy: false, onSubmit: () => {} };
    const { unmount } = render(<StakeForm {...base} fixedExercise="plank" fixedGoal={null} crewName="Core" />);
    expect(screen.getByTestId("locked-exercise").textContent).toMatch(/Plank/);
    expect(screen.queryByTestId("locked-goal")).toBeNull();
    expect(screen.getByRole("heading", { name: "Commit with the crew" })).toBeTruthy();
    unmount();
    render(<StakeForm {...base} />);
    expect(screen.queryByTestId("locked-exercise")).toBeNull();
    expect(screen.getByRole("heading", { name: "Set your commitment" })).toBeTruthy();
  });
});
