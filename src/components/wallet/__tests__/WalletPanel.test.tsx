// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { address } from "@solana/kit";
import type { AsyncState } from "@/lib/solana/types";

const OWNER = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

function state<T>(status: AsyncState<T>["status"], data: T | null, error: string | null = null): AsyncState<T> {
  return { status, data, error, refresh: vi.fn() };
}

const mocks = vi.hoisted(() => ({
  connected: true,
  skr: null as unknown,
  sol: null as unknown,
  seeker: null as unknown,
  disconnect: vi.fn(() => Promise.resolve()),
}));

vi.mock("../hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks")>();
  return {
    ...actual,
    usePlatform: () => "android",
    useSelectedWallet: () =>
      mocks.connected
        ? {
            account: { address: OWNER },
            wallet: { name: "Mobile Wallet Adapter", features: [] },
            owner: OWNER,
            wallets: [],
            setAccount: vi.fn(),
          }
        : { account: undefined, wallet: undefined, owner: null, wallets: [], setAccount: vi.fn() },
    useSkrBalance: () => mocks.skr,
    useSolBalance: () => mocks.sol,
    useSeekerStatus: () => mocks.seeker,
    useDisconnectWallet: () => ({ disconnecting: false, disconnect: mocks.disconnect }),
  };
});
vi.mock("@solana-mobile/wallet-standard-mobile", () => ({
  SolanaMobileWalletAdapterWalletName: "Mobile Wallet Adapter",
  SolanaMobileWalletAdapterRemoteWalletName: "Remote Mobile Wallet Adapter",
}));

import WalletPanel from "../WalletPanel";

beforeEach(() => {
  mocks.connected = true;
  mocks.skr = state("ready", { owner: OWNER, mint: OWNER, ata: OWNER, amount: 1_234_567_890n, decimals: 6, exists: true });
  mocks.sol = state("ready", 50_000_000n);
  mocks.seeker = state("ready", { owner: OWNER, isSeeker: true, sgtMint: null, sgtTokenAccount: null, checkedAt: 1 });
  mocks.disconnect.mockClear();
});
afterEach(cleanup);

describe("WalletPanel", () => {
  it("shows the connect prompt when nothing is connected", () => {
    mocks.connected = false;
    render(<WalletPanel />);
    expect(screen.getByRole("heading", { name: "Connect your wallet" })).toBeTruthy();
    expect(screen.getByText(/No Solana wallet app found/)).toBeTruthy();
  });

  it("shows SKR with 6-decimal formatting, SOL, Seeker status and explorer link", () => {
    render(<WalletPanel />);
    expect(document.body.textContent).toContain("1,234.56789 SKR");
    expect(screen.getByText(/SOL for network fees: 0.05 SOL/)).toBeTruthy();
    expect(screen.getByText("Seeker verified")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Use Installed Wallet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View on Explorer" }).getAttribute("href")).toBe(
      `https://explorer.solana.com/address/${OWNER}`,
    );
    expect(screen.queryByText(/test mode/i)).toBeNull();
    expect(screen.queryByText(/faucet/i)).toBeNull();
  });

  it("warns on low SOL, shows errors and non-Seeker status", () => {
    mocks.sol = state("ready", 1_000n);
    mocks.skr = state("error", null, "upstream down");
    mocks.seeker = state("ready", { owner: OWNER, isSeeker: false, sgtMint: null, sgtTokenAccount: null, checkedAt: 1 });
    render(<WalletPanel />);
    expect(screen.getByText(/Low SOL/)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/upstream down/);
    expect(screen.getByText("No Seeker Genesis Token")).toBeTruthy();
  });

  it("refreshes all reads and disconnects on click", () => {
    render(<WalletPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh balances" }));
    for (const s of [mocks.skr, mocks.sol, mocks.seeker] as AsyncState<unknown>[]) expect(s.refresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });
});
