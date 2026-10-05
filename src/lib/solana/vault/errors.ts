/**
 * Vault program errors (anchor/SPEC.md §7, codes 6000 + index) and friendly copy for everything
 * that can go wrong while staking or claiming. Pure.
 */
import { isSolanaError, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM } from "@solana/kit";

export const VAULT_ERROR_FIRST = 6000;
export const VAULT_ERROR_LAST = 6031;

export const VAULT_ERROR_NAMES: Readonly<Record<number, string>> = Object.freeze({
  6000: "Paused",
  6001: "NotAuthority",
  6002: "NotAttestor",
  6003: "NotPendingAuthority",
  6004: "InvalidConfig",
  6005: "UnsupportedMintExtension",
  6006: "InvalidDay",
  6007: "CommitWindowClosed",
  6008: "AttestWindowClosed",
  6009: "DayNotOver",
  6010: "AlreadyFinalized",
  6011: "NotFinalized",
  6012: "DayVoided",
  6013: "InvalidCommitmentState",
  6014: "InvalidSessionTime",
  6015: "SgtRequired",
  6016: "InvalidSgt",
  6017: "DeviceAlreadyCommitted",
  6018: "DayNotResolved",
  6019: "InsufficientFunds",
  6020: "InsolventVault",
  6021: "MathOverflow",
  6022: "ClockBeforeOffset",
  6023: "StakeOutOfBounds",
  6024: "GoalOutOfBounds",
  6025: "GoalNotMet",
  6026: "UnsupportedMintDecimals",
  6027: "NotUpgradeAuthority",
  6028: "InvalidDestination",
  6029: "CrewGoalMismatch",
  6030: "InvalidCrew",
  6031: "SponsorTapClosed",
});

const MESSAGES: Readonly<Record<number, string>> = Object.freeze({
  6000: "Staking is paused for maintenance. Your funds are safe; try again later.",
  6001: "Only the pool authority can do that.",
  6002: "Only Fitr's verifier can mark a workout complete.",
  6003: "Only the proposed authority can accept.",
  6004: "The pool settings are invalid.",
  6005: "This token is not supported by the vault.",
  6006: "That day is not open for commitments.",
  6007: "Today's commit window has closed. You can commit for tomorrow.",
  6008: "The verification window for that day has closed.",
  6009: "That day is not over yet. Try again in a minute.",
  6010: "That day has already been settled.",
  6011: "That day is not settled yet. Try again shortly.",
  6012: "That day was cancelled; everyone can claim their stake back.",
  6013: "That commitment cannot be claimed in its current state.",
  6014: "The workout session time is invalid.",
  6015: "Staking needs a Seeker: the Seeker Genesis Token was not found.",
  6016: "That Seeker Genesis Token is not valid.",
  6017: "This Seeker has already committed for that day.",
  6018: "Not every commitment for that day is settled yet.",
  6019: "Not enough funds for that.",
  6020: "The vault cannot pay that right now. Your funds are safe; please contact Fitr.",
  6021: "That amount is too large.",
  6022: "The pool has not started yet.",
  6023: "That stake is outside the allowed range.",
  6024: "That goal is outside the allowed range for this exercise.",
  6025: "The verified count did not reach the goal.",
  6026: "This token is not supported by the vault.",
  6027: "Only the program upgrade authority can do that.",
  6028: "Pick a different destination account.",
  6029: "This crew has a fixed challenge: commit to the crew's exercise and goal.",
  6030: "That crew setup is invalid. Check the name and the challenge.",
  6031: "Sponsoring is not switched on for this pool yet, so your SKR was not taken.",
});

/** User copy for a vault error code, or null when `code` is not a vault error. */
export function vaultErrorMessage(code: number): string | null {
  return MESSAGES[code] ?? null;
}

function asCode(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "bigint") return Number(v);
  return null;
}

/** Custom program error code from simulation `err` JSON: { InstructionError: [i, { Custom: n }] }. */
export function customCodeFromTransactionError(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const ie = (err as { InstructionError?: unknown }).InstructionError;
  if (!Array.isArray(ie) || ie.length < 2) return null;
  const detail = ie[1];
  if (detail && typeof detail === "object" && "Custom" in detail) return asCode((detail as { Custom: unknown }).Custom);
  return null;
}

/** Index of the failing instruction from simulation `err` JSON, or null. */
export function failedInstructionIndex(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const ie = (err as { InstructionError?: unknown }).InstructionError;
  return Array.isArray(ie) ? asCode(ie[0]) : null;
}

const LOG_PATTERNS: RegExp[] = [/Error Number: (\d+)/, /custom program error: (0x[0-9a-fA-F]+|\d+)/];

/** Custom code from program logs ("Error Number: 6007" / "custom program error: 0x1777"). */
export function customCodeFromLogs(logs: readonly string[] | null | undefined): number | null {
  for (const line of logs ?? []) {
    for (const re of LOG_PATTERNS) {
      const m = re.exec(line);
      if (m) return m[1].startsWith("0x") ? parseInt(m[1], 16) : parseInt(m[1], 10);
    }
  }
  return null;
}

/**
 * Any custom program error code found in a thrown error: kit SolanaErrors (and their causes),
 * simulation results, log lines or message text. Returns the code whatever the program.
 */
export function extractCustomErrorCode(err: unknown, depth = 0): number | null {
  if (err == null || depth > 6) return null;
  if (isSolanaError(err, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
    return asCode((err.context as { code?: unknown }).code);
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const fromJson = customCodeFromTransactionError(o.err ?? o);
    if (fromJson !== null) return fromJson;
    const ctx = o.context as Record<string, unknown> | undefined;
    const fromLogs = customCodeFromLogs((o.logs as string[]) ?? (ctx?.logs as string[] | undefined));
    if (fromLogs !== null) return fromLogs;
    if (o.cause) {
      const c = extractCustomErrorCode(o.cause, depth + 1);
      if (c !== null) return c;
    }
    if (typeof o.message === "string") return customCodeFromLogs([o.message]);
  }
  if (typeof err === "string") return customCodeFromLogs([err]);
  return null;
}

/** The vault error code (6000–6028) inside `err`, or null. */
export function extractVaultErrorCode(err: unknown): number | null {
  const code = extractCustomErrorCode(err);
  return code !== null && code >= VAULT_ERROR_FIRST && code <= VAULT_ERROR_LAST ? code : null;
}

function messageOf(err: unknown, depth = 0): string {
  if (err == null || depth > 6) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const o = err as { message?: unknown; cause?: unknown; logs?: unknown };
    const own = typeof o.message === "string" ? o.message : "";
    const logs = Array.isArray(o.logs) ? o.logs.join("\n") : "";
    return [own, logs, messageOf(o.cause, depth + 1)].filter(Boolean).join("\n");
  }
  return "";
}

/**
 * One friendly sentence for anything thrown while building, simulating, signing, sending or
 * confirming a stake/claim transaction.
 */
export function friendlyTxError(err: unknown, tokenLabel = "SKR"): string {
  const vault = extractVaultErrorCode(err);
  if (vault !== null) return vaultErrorMessage(vault) ?? "The vault rejected the transaction.";
  const msg = messageOf(err);
  if (/reject|declin|cancel|denied|dismiss|abort/i.test(msg)) return "Cancelled in your wallet. Nothing was sent.";
  const custom = extractCustomErrorCode(err);
  // SPL Token error 1 = InsufficientFunds.
  if (custom === 1 || (/insufficient funds/i.test(msg) && !/lamports|fee|rent/i.test(msg))) {
    return `Not enough ${tokenLabel} in your wallet for that stake.`;
  }
  if (/insufficient lamports|InsufficientFundsForFee|insufficient funds for (fee|rent)|InsufficientFundsForRent/i.test(msg)) {
    return "Not enough SOL for network fees and account rent (about 0.005 SOL).";
  }
  if (/AccountNotFound|could not find account|Attempt to debit an account but found no record/i.test(msg)) {
    return `Your wallet needs some SOL and a ${tokenLabel} account first.`;
  }
  if (/blockhash|BlockhashNotFound|expired/i.test(msg)) return "The network was slow and the request expired. Please try again.";
  if (/rate.?limit|429/i.test(msg)) return "Too many requests. Wait a few seconds and try again.";
  if (/network|fetch|timeout|timed out|Failed to fetch/i.test(msg)) return "Network problem. Check your connection and try again.";
  if (/AccountNotInitialized|3012/.test(msg)) return "Something changed onchain. Refresh and try again.";
  return "Something went wrong. Refresh and try again.";
}
