import { describe, expect, it } from "vitest";
import { SKR_DECIMALS, SKR_MAINNET_MINT, SolanaConfigError, parsePublicSolanaConfig, solanaConfig } from "../config";

const OTHER_MINT = "So11111111111111111111111111111111111111112";

describe("parsePublicSolanaConfig", () => {
  it("defaults to mainnet with real SKR", () => {
    for (const env of [{}, { NEXT_PUBLIC_SOLANA_CLUSTER: "" }, { NEXT_PUBLIC_SOLANA_CLUSTER: " mainnet " }]) {
      const c = parsePublicSolanaConfig(env);
      expect(c.cluster).toBe("mainnet");
      expect(c.chain).toBe("solana:mainnet");
      expect(c.skrMint).toBe(SKR_MAINNET_MINT);
      expect(c.tokenLabel).toBe("SKR");
      expect(c.isTestToken).toBe(false);
      expect(c.explorerTxUrl("sig")).toBe("https://explorer.solana.com/tx/sig");
    }
  });

  it("ignores the devnet mint on mainnet", () => {
    const c = parsePublicSolanaConfig({ NEXT_PUBLIC_SOLANA_CLUSTER: "mainnet", NEXT_PUBLIC_DEVNET_SKR_MINT: OTHER_MINT });
    expect(c.skrMint).toBe(SKR_MAINNET_MINT);
  });

  it("devnet is a test mode with tSKR", () => {
    const c = parsePublicSolanaConfig({ NEXT_PUBLIC_SOLANA_CLUSTER: "devnet", NEXT_PUBLIC_DEVNET_SKR_MINT: OTHER_MINT });
    expect(c.chain).toBe("solana:devnet");
    expect(c.skrMint).toBe(OTHER_MINT);
    expect(c.tokenLabel).toBe("tSKR");
    expect(c.isTestToken).toBe(true);
    expect(c.explorerAddressUrl("abc")).toBe("https://explorer.solana.com/address/abc?cluster=devnet");
    expect(parsePublicSolanaConfig({ NEXT_PUBLIC_SOLANA_CLUSTER: "devnet" }).skrMint).toBeNull();
  });

  it("rejects unknown clusters and invalid addresses", () => {
    expect(() => parsePublicSolanaConfig({ NEXT_PUBLIC_SOLANA_CLUSTER: "testnet" })).toThrow(SolanaConfigError);
    expect(() =>
      parsePublicSolanaConfig({ NEXT_PUBLIC_SOLANA_CLUSTER: "devnet", NEXT_PUBLIC_DEVNET_SKR_MINT: "nope" }),
    ).toThrow(SolanaConfigError);
    expect(() => parsePublicSolanaConfig({ NEXT_PUBLIC_VAULT_PROGRAM_ID: "nope" })).toThrow(SolanaConfigError);
  });

  it("parses the vault program override", () => {
    expect(parsePublicSolanaConfig({}).vaultProgramId).toBeNull();
    expect(parsePublicSolanaConfig({ NEXT_PUBLIC_VAULT_PROGRAM_ID: OTHER_MINT }).vaultProgramId).toBe(OTHER_MINT);
  });

  it("SKR is 6 decimals and the test env runs mainnet", () => {
    expect(SKR_DECIMALS).toBe(6);
    expect(solanaConfig.cluster).toBe("mainnet");
  });
});
