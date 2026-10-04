// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerificationCard from "@/components/workout/VerificationCard";
import { solanaConfig } from "@/lib/solana/config";
import { getPoolAddresses } from "@/lib/solana/vault/addresses";

const h = vi.hoisted(() => ({ owner: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" as string | null }));
vi.mock("@/components/wallet/hooks", () => ({
  useSelectedWallet: () => ({ owner: h.owner, account: undefined, wallet: undefined, wallets: [], setAccount: () => {} }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const verified = { kind: "verified" as const, count: 32, goalTarget: 30, signature: "sig", explorerUrl: "https://explorer" };

describe("VerificationCard Share", () => {
  it("shares the public card URL for the verified day", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share });
    render(<VerificationCard status="verified" outcome={verified} error={null} unit="reps" shareDayIndex={20721} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `https://fitr.day/s/${h.owner}/20721`, text: expect.stringContaining("32 reps") }),
    );
  });

  it("links a crew stake's card to that crew's pool", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share });
    render(<VerificationCard status="verified" outcome={verified} error={null} unit="reps" shareDayIndex={20721} shareCrewId={5n} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const { pool } = await getPoolAddresses(solanaConfig.skrMint!, undefined, 5n);
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `https://fitr.day/s/${h.owner}/20721?pool=${pool}` }));
  });

  it("has no Share button without a wallet or before verification", () => {
    h.owner = null;
    render(<VerificationCard status="verified" outcome={verified} error={null} unit="reps" shareDayIndex={1} />);
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    h.owner = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
    cleanup();
    render(<VerificationCard status="finishing" outcome={null} error={null} unit="reps" />);
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });
});
