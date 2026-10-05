// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import type { Address } from "@solana/kit";

vi.mock("@/components/wallet/hooks", () => ({
  useSendingSigner: () => ({ address: "Owner1111111111111111111111111111111111111" }),
  notifyBalancesChanged: () => {},
}));
vi.mock("@/hooks/useVault", () => ({ notifyVaultChanged: () => {} }));

import SponsorCard, { SponsoredNote } from "../SponsorCard";

afterEach(cleanup);

const SKR = 1_000_000n;
const account = {} as UiWalletAccount;
const owner = "Owner1111111111111111111111111111111111111" as Address;

describe("SponsorCard", () => {
  it("is hidden while the pool's sponsor tap is closed", () => {
    const { container } = render(
      <SponsorCard account={account} owner={owner} pool={{ dailySponsorAmount: 0n, reserve: 0n }} balance={50n * SKR} />,
    );
    expect(container.textContent).toBe("");
  });

  it("offers deposits when the tap is open and blocks amounts above the balance", () => {
    render(<SponsorCard account={account} owner={owner} pool={{ dailySponsorAmount: 10n * SKR, reserve: 0n }} balance={5n * SKR} />);
    expect(screen.getByRole("heading", { name: /Sponsor a day/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Not enough SKR/ })).toHaveProperty("disabled", true);
    expect(screen.getByText(/not an investment/)).toBeTruthy();
  });
});

describe("SponsoredNote", () => {
  it("shows the bonus only when the tap is open and the reserve holds something", () => {
    const { container, rerender } = render(<SponsoredNote pool={{ dailySponsorAmount: 10n * SKR, reserve: 0n }} />);
    expect(container.textContent).toBe("");
    rerender(<SponsoredNote pool={{ dailySponsorAmount: 10n * SKR, reserve: 4n * SKR }} />);
    expect(container.textContent).toMatch(/Sponsored/);
    expect(container.textContent).toMatch(/4 SKR/);
  });
});
