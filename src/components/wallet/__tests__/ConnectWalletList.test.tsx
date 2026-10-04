// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Platform } from "../hooks";

const mocks = vi.hoisted(() => ({
  platform: "android" as Platform | null,
  wallets: [] as { name: string; icon: string }[],
  connect: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("../hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks")>();
  return {
    ...actual,
    usePlatform: () => mocks.platform,
    useSelectedWallet: () => ({ account: undefined, wallet: undefined, owner: null, wallets: mocks.wallets, setAccount: vi.fn() }),
    useConnectWallet: () => ({ connecting: false, error: null, connect: mocks.connect }),
  };
});
vi.mock("@solana-mobile/wallet-standard-mobile", () => ({
  SolanaMobileWalletAdapterWalletName: "Mobile Wallet Adapter",
  SolanaMobileWalletAdapterRemoteWalletName: "Remote Mobile Wallet Adapter",
}));

import ConnectWalletList from "../ConnectWalletList";

const ICON = "data:image/svg+xml;base64,PHN2Zy8+";

beforeEach(() => {
  mocks.platform = "android";
  mocks.wallets = [];
  mocks.connect.mockClear();
});
afterEach(cleanup);

describe("ConnectWalletList", () => {
  it("renders nothing before the platform is known (SSR/hydration)", () => {
    mocks.platform = null;
    const { container } = render(<ConnectWalletList />);
    expect(container.innerHTML).toBe("");
  });

  it("shows 'not supported' on iOS without wallet options", () => {
    mocks.platform = "ios";
    mocks.wallets = [{ name: "Phantom", icon: ICON }];
    render(<ConnectWalletList />);
    expect(screen.getByText(/not supported on iOS/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains when no wallet is available", () => {
    render(<ConnectWalletList />);
    expect(screen.getByText(/No Solana wallet app found/)).toBeTruthy();
  });

  it("lists MWA first as 'Use Installed Wallet' and connects only on click", () => {
    mocks.wallets = [
      { name: "Phantom", icon: ICON },
      { name: "Mobile Wallet Adapter", icon: ICON },
    ];
    render(<ConnectWalletList />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Use Installed Wallet", "Phantom"]);
    expect(mocks.connect).not.toHaveBeenCalled();
    fireEvent.click(buttons[0]);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
  });
});
