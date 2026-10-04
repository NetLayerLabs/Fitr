// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { address } from "@solana/kit";

const fetchSeekerStatus = vi.hoisted(() => vi.fn());
vi.mock("@/lib/solana/rpc", () => ({ fetchSeekerStatus, getBrowserRpc: () => ({}) }));
vi.mock("@solana-mobile/wallet-standard-mobile", () => ({
  SolanaMobileWalletAdapterWalletName: "Mobile Wallet Adapter",
  SolanaMobileWalletAdapterRemoteWalletName: "Remote Mobile Wallet Adapter",
}));

import { detectPlatform, sortWallets, useSeekerStatus, walletLabel } from "../hooks";

const OWNER = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

afterEach(() => {
  cleanup();
  fetchSeekerStatus.mockReset();
});

describe("detectPlatform", () => {
  it("recognises Android, iOS (incl. iPadOS) and everything else", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Seeker) Chrome/130")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome", 0)).toBe("other");
  });
});

describe("wallet labels", () => {
  it("labels MWA as the installed wallet and lists it first", () => {
    expect(walletLabel({ name: "Mobile Wallet Adapter" })).toBe("Use Installed Wallet");
    expect(walletLabel({ name: "Phantom" })).toBe("Phantom");
    expect(sortWallets([{ name: "Solflare" }, { name: "Mobile Wallet Adapter" }, { name: "Backpack" }]).map((w) => w.name)).toEqual([
      "Mobile Wallet Adapter",
      "Backpack",
      "Solflare",
    ]);
  });
});

describe("useSeekerStatus", () => {
  it("is idle without an owner and does not fetch", () => {
    const { result } = renderHook(() => useSeekerStatus(null));
    expect(result.current.status).toBe("idle");
    expect(fetchSeekerStatus).not.toHaveBeenCalled();
  });

  it("loads, then keeps showing data while refreshing", async () => {
    const status = { owner: OWNER, isSeeker: true, sgtMint: null, sgtTokenAccount: null, checkedAt: 1 };
    fetchSeekerStatus.mockResolvedValue(status);
    const { result } = renderHook(() => useSeekerStatus(OWNER));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.data).toEqual(status);

    let resolve!: (v: unknown) => void;
    fetchSeekerStatus.mockReturnValue(new Promise((r) => (resolve = r)));
    act(() => result.current.refresh());
    expect(result.current.status).toBe("loading");
    expect(result.current.data).toEqual(status);
    await act(async () => resolve({ ...status, checkedAt: 2 }));
    expect(result.current).toMatchObject({ status: "ready", data: { checkedAt: 2 } });
  });

  it("reports errors", async () => {
    fetchSeekerStatus.mockRejectedValue(new Error("Slow down"));
    const { result } = renderHook(() => useSeekerStatus(OWNER));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Slow down");
  });
});
