// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  owner: null as string | null,
  vault: { status: "loading", snapshot: null, error: null, refresh: () => {} } as Record<string, unknown>,
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/wallet/hooks", () => ({ useSelectedWallet: () => ({ owner: m.owner }) }));
vi.mock("@/hooks/useVault", () => ({ useVault: () => m.vault }));
vi.mock("../ProgressDashboard", () => ({
  default: (p: Record<string, unknown>) => {
    m.props.push(p);
    return null;
  },
}));

import ProgressOnChain from "../ProgressOnChain";

afterEach(() => {
  cleanup();
  m.props = [];
});

describe("ProgressOnChain", () => {
  it("leaves the on-chain award locked without a wallet", () => {
    m.owner = null;
    render(<ProgressOnChain />);
    expect(m.props.at(-1)?.verifiedOnChainDays).toBeUndefined();
  });

  it("passes the profile's verified-day count for the connected wallet", () => {
    m.owner = "Wallet111";
    m.vault = { status: "ready", snapshot: { profile: { totalCompleted: 4 } }, error: null, refresh: () => {} };
    render(<ProgressOnChain />);
    expect(m.props.at(-1)).toMatchObject({ verifiedOnChainDays: 4 });
  });
});
