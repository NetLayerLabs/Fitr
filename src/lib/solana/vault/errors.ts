/**
 * Vault program errors (anchor/SPEC.md §7, codes 6000 + index) and friendly copy for everything
 * that can go wrong while staking or claiming. Copy comes from the "stake" namespace in the
 * active language (call outside render only: catch blocks, error mapping).
 */
import { isSolanaError, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM } from "@solana/kit";
import { tr } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n/messages";

type StakeKey = keyof Messages["stake"] & string;

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

/** The "stake" message key for each vault error code: `vaultErr` + the program's error name. */
function messageKey(code: number): StakeKey | null {
  const name = VAULT_ERROR_NAMES[code];
  return name ? (`vaultErr${name}` as StakeKey) : null;
}

/** User copy for a vault error code, or null when `code` is not a vault error. */
export function vaultErrorMessage(code: number): string | null {
  const key = messageKey(code);
  return key ? tr("stake", key) : null;
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
  if (vault !== null) return vaultErrorMessage(vault) ?? tr("stake", "errVaultRejected");
  const msg = messageOf(err);
  if (/reject|declin|cancel|denied|dismiss|abort/i.test(msg)) return tr("stake", "errCancelled");
  const custom = extractCustomErrorCode(err);
  // SPL Token error 1 = InsufficientFunds.
  if (custom === 1 || (/insufficient funds/i.test(msg) && !/lamports|fee|rent/i.test(msg))) {
    return tr("stake", "errNotEnoughToken", { token: tokenLabel });
  }
  if (/insufficient lamports|InsufficientFundsForFee|insufficient funds for (fee|rent)|InsufficientFundsForRent/i.test(msg)) {
    return tr("stake", "errNotEnoughSol");
  }
  if (/AccountNotFound|could not find account|Attempt to debit an account but found no record/i.test(msg)) {
    return tr("stake", "errNeedsAccount", { token: tokenLabel });
  }
  if (/blockhash|BlockhashNotFound|expired/i.test(msg)) return tr("stake", "errExpired");
  if (/rate.?limit|429/i.test(msg)) return tr("stake", "errRateLimited");
  if (/network|fetch|timeout|timed out|Failed to fetch/i.test(msg)) return tr("stake", "errNetwork");
  if (/AccountNotInitialized|3012/.test(msg)) return tr("stake", "errChanged");
  return tr("stake", "errUnknown");
}

/**
 * A short technical summary of a thrown error (name, message, cause chain, simulation error and the
 * last program logs), shown under the friendly sentence so a failure can be diagnosed from a
 * screenshot. Never includes keys: errors only carry public data.
 */
export function describeTxError(err: unknown): string {
  const parts: string[] = [];
  let cur: unknown = err;
  for (let depth = 0; cur != null && depth < 5; depth++) {
    if (typeof cur === "object") {
      const o = cur as { name?: unknown; message?: unknown; err?: unknown; logs?: unknown; context?: unknown; cause?: unknown };
      const head = [typeof o.name === "string" ? o.name : "", typeof o.message === "string" ? o.message : ""].filter(Boolean).join(": ");
      if (head) parts.push(head);
      if (o.err !== undefined) parts.push(`err=${JSON.stringify(o.err, (_, v) => (typeof v === "bigint" ? String(v) : v))}`);
      const logs = Array.isArray(o.logs) ? (o.logs as unknown[]).filter((l): l is string => typeof l === "string") : [];
      const tail = logs.filter((l) => /log:|failed|error|insufficient/i.test(l)).slice(-4);
      if (tail.length) parts.push(tail.join(" | "));
      if (o.context && typeof o.context === "object") {
        const ctx = JSON.stringify(o.context, (_, v) => (typeof v === "bigint" ? String(v) : v));
        if (ctx && ctx !== "{}") parts.push(`context=${ctx.slice(0, 200)}`);
      }
      cur = o.cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(" · ").slice(0, 700) || "unknown error";
}
