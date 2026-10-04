// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const registerMwa = vi.hoisted(() => vi.fn());
vi.mock("@solana-mobile/wallet-standard-mobile", () => ({
  SolanaMobileWalletAdapterWalletName: "Mobile Wallet Adapter",
  SolanaMobileWalletAdapterRemoteWalletName: "Remote Mobile Wallet Adapter",
  createDefaultAuthorizationCache: () => ({}),
  createDefaultChainSelector: () => ({}),
  createDefaultWalletNotFoundHandler: () => () => Promise.resolve(),
  registerMwa,
}));

import WalletProviders, { filterWallets } from "../WalletProviders";

afterEach(cleanup);

describe("WalletProviders", () => {
  it("registers MWA exactly once, even under StrictMode and remounts", () => {
    const tree = (
      <StrictMode>
        <WalletProviders>
          <p>child</p>
        </WalletProviders>
      </StrictMode>
    );
    const { unmount } = render(tree);
    expect(screen.getByText("child")).toBeTruthy();
    unmount();
    render(tree);
    expect(registerMwa).toHaveBeenCalledTimes(1);
    const config = registerMwa.mock.calls[0][0];
    expect(config.chains).toEqual(["solana:mainnet"]);
    expect(config.appIdentity).toMatchObject({ name: "Fitr", uri: window.location.origin, icon: "icons/icon-192.png" });
    expect("remoteHostAuthority" in config).toBe(false);
  });

  it("filters to wallets that can sign-and-send on the configured chain", () => {
    const w = (features: string[], chains: string[]) => ({ features, chains }) as never;
    expect(filterWallets(w(["solana:signAndSendTransaction"], ["solana:mainnet"]))).toBe(true);
    expect(filterWallets(w(["solana:signTransaction"], ["solana:mainnet"]))).toBe(false);
    expect(filterWallets(w(["solana:signAndSendTransaction"], ["solana:devnet"]))).toBe(false);
  });
});
