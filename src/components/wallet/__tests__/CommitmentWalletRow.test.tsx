// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { address } from "@solana/kit";

const OWNER = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const mocks = vi.hoisted(() => ({ owner: null as string | null }));

vi.mock("@/components/wallet/hooks", () => ({
  useSelectedWallet: () => ({ owner: mocks.owner, account: undefined, wallet: undefined, wallets: [], setAccount: () => {} }),
  useSkrBalance: () => ({
    status: "ready",
    data: { amount: 2_500_999_999n, decimals: 6, exists: true },
    error: null,
    refresh: () => {},
  }),
  useSeekerStatus: () => ({ status: "loading", data: null, error: null, refresh: () => {} }),
}));

import CommitmentWalletRow from "@/components/home/CommitmentWalletRow";

afterEach(cleanup);

describe("CommitmentWalletRow", () => {
  it("links to /you to connect when disconnected", () => {
    mocks.owner = null;
    render(<CommitmentWalletRow />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/you");
    expect(link.textContent).toMatch(/Connect wallet/);
  });

  it("shows the truncated SKR balance, short address and Seeker check", () => {
    mocks.owner = OWNER;
    render(<CommitmentWalletRow />);
    expect(document.body.textContent).toContain("2,500.99 SKR");
    expect(screen.getByText("9WzD…AWWM")).toBeTruthy();
    expect(screen.getByText("Checking Seeker…")).toBeTruthy();
  });
});
