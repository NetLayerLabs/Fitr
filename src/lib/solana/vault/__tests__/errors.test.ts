import { describe, expect, it } from "vitest";
import { SolanaError, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM } from "@solana/kit";
import {
  customCodeFromLogs,
  customCodeFromTransactionError,
  extractCustomErrorCode,
  extractVaultErrorCode,
  failedInstructionIndex,
  friendlyTxError,
  VAULT_ERROR_NAMES,
  vaultErrorMessage,
} from "../errors";
import * as generated from "../generated";

describe("vault error table", () => {
  it("maps every program error code 6000–6031 and matches the generated client", () => {
    for (let code = 6000; code <= 6031; code++) {
      expect(vaultErrorMessage(code)).toBeTruthy();
      expect(VAULT_ERROR_NAMES[code]).toBeTruthy();
    }
    const genCodes = Object.entries(generated)
      .filter(([k, v]) => k.startsWith("FITR_VAULT_ERROR__") && typeof v === "number")
      .map(([, v]) => v as number)
      .sort((a, b) => a - b);
    expect(genCodes[0]).toBe(6000);
    expect(genCodes[genCodes.length - 1]).toBe(6031);
    expect(genCodes).toHaveLength(32);
    expect(vaultErrorMessage(5999)).toBeNull();
    expect(vaultErrorMessage(6032)).toBeNull();
  });
});

describe("extracting codes", () => {
  it("from simulation err JSON", () => {
    const err = { InstructionError: [3, { Custom: 6007 }] };
    expect(customCodeFromTransactionError(err)).toBe(6007);
    expect(failedInstructionIndex(err)).toBe(3);
    expect(customCodeFromTransactionError({ InstructionError: [0, "InvalidAccountData"] })).toBeNull();
    expect(customCodeFromTransactionError("AccountNotFound")).toBeNull();
  });

  it("from Anchor / runtime log lines", () => {
    expect(customCodeFromLogs(["Program log: AnchorError ... Error Number: 6023. Error Message: x"])).toBe(6023);
    expect(customCodeFromLogs(["Program X failed: custom program error: 0x1777"])).toBe(6007);
    expect(customCodeFromLogs(["nothing"])).toBeNull();
  });

  it("from kit SolanaErrors, nested causes and simulation wrappers", () => {
    const custom = new SolanaError(SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM, { code: 6017, index: 1 });
    expect(extractVaultErrorCode(custom)).toBe(6017);
    expect(extractVaultErrorCode(new Error("send failed", { cause: custom }))).toBe(6017);
    expect(extractVaultErrorCode({ err: { InstructionError: [0, { Custom: 6009 }] }, logs: [] })).toBe(6009);
    expect(extractVaultErrorCode({ logs: ["Error Number: 6025."] })).toBe(6025);
    expect(extractCustomErrorCode({ err: { InstructionError: [0, { Custom: 1 }] } })).toBe(1);
    expect(extractVaultErrorCode({ err: { InstructionError: [0, { Custom: 1 }] } })).toBeNull();
    expect(extractVaultErrorCode(null)).toBeNull();
  });
});

describe("friendlyTxError", () => {
  it("vault errors get program copy", () => {
    expect(friendlyTxError({ err: { InstructionError: [2, { Custom: 6007 }] } })).toMatch(/commit window has closed/);
    expect(friendlyTxError({ logs: ["Error Number: 6017."] })).toMatch(/Seeker has already committed/);
  });

  it("wallet rejection, balances, expiry, network", () => {
    expect(friendlyTxError(new Error("User rejected the request"))).toMatch(/Cancelled in your wallet/);
    expect(friendlyTxError({ err: { InstructionError: [3, { Custom: 1 }] } }, "SKR")).toBe("Not enough SKR in your wallet for that stake.");
    expect(friendlyTxError(new Error("Transfer: insufficient lamports 100, need 2000"))).toMatch(/Not enough SOL/);
    expect(friendlyTxError(new Error("Blockhash not found"))).toMatch(/expired/);
    expect(friendlyTxError(new Error("Failed to fetch"))).toMatch(/Network problem/);
    expect(friendlyTxError(new Error("weird"))).toBe("Something went wrong. Refresh and try again.");
  });
});
