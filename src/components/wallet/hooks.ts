"use client";

/**
 * Wallet hooks for Fitr. Everything a screen needs to connect, read balances and get a signer.
 *
 * Rules: connect only from a user click (no auto-connect calls); reads go through /api/rpc and
 * /api/seeker; nothing here sends a transaction.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSelectedWalletAccount, useWalletAccountTransactionSendingSigner } from "@solana/react";
import {
  uiWalletAccountBelongsToUiWallet,
  useConnect,
  useDisconnect,
  type UiWallet,
  type UiWalletAccount,
} from "@wallet-standard/react";
import { address, type Address, type TransactionSendingSigner } from "@solana/kit";
import { tr } from "@/lib/i18n";
import { useT } from "@/lib/i18n/I18nProvider";
import { en } from "@/lib/i18n/messages";
import { makeTranslator, type Translator } from "@/lib/i18n/translate";
import { solanaConfig } from "@/lib/solana/config";
import { isMobileWalletAdapterName } from "@/lib/solana/mwa";
import { fetchSeekerStatus, getBrowserRpc } from "@/lib/solana/rpc";
import { fetchSkrBalance, fetchSolBalance } from "@/lib/solana/skr";
import type { AsyncState, SeekerStatus, SkrBalance } from "@/lib/solana/types";

/* ------------------------------------------------------------------------------------------ */
/* Selection                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export interface SelectedWallet {
  /** The connected account, or undefined when nothing is connected. */
  account: UiWalletAccount | undefined;
  /** The wallet the account belongs to. */
  wallet: UiWallet | undefined;
  /** Base58 owner address of the connected account. */
  owner: Address | null;
  /** Wallets that support signAndSendTransaction on the configured chain. */
  wallets: UiWallet[];
  setAccount: (account: UiWalletAccount | undefined) => void;
}

export function useSelectedWallet(): SelectedWallet {
  const [account, setAccount, wallets] = useSelectedWalletAccount();
  const wallet = useMemo(
    () => (account ? wallets.find((w) => uiWalletAccountBelongsToUiWallet(account, w)) : undefined),
    [account, wallets],
  );
  const owner = useMemo(() => (account ? address(account.address) : null), [account]);
  return { account, wallet, owner, wallets, setAccount };
}

export function isMobileWalletAdapter(wallet: Pick<UiWallet, "name">): boolean {
  return isMobileWalletAdapterName(wallet.name);
}

const EN_WALLET: Translator<"wallet"> = makeTranslator("en", en, "wallet");

/**
 * User-facing wallet label. MWA (the phone's own wallet, Seed Vault on Seeker) gets a plain name.
 * Pass `useT("wallet")` in render; without it the label is English.
 */
export function walletLabel(wallet: Pick<UiWallet, "name">, t: Translator<"wallet"> = EN_WALLET): string {
  return isMobileWalletAdapter(wallet) ? t("installedWallet") : wallet.name;
}

/** MWA first, then alphabetical. */
export function sortWallets<T extends Pick<UiWallet, "name">>(wallets: readonly T[]): T[] {
  return [...wallets].sort((a, b) => {
    const am = isMobileWalletAdapter(a) ? 0 : 1;
    const bm = isMobileWalletAdapter(b) ? 0 : 1;
    return am - bm || a.name.localeCompare(b.name);
  });
}

/** Called from a catch block (outside render). */
function errorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : "";
  if (/reject|declin|cancel|denied/i.test(msg)) return tr("wallet", "connectCancelled");
  return msg || fallback;
}

export interface ConnectWallet {
  connecting: boolean;
  error: string | null;
  /** Call from a click handler only. Resolves to the selected account, or null on failure. */
  connect: () => Promise<UiWalletAccount | null>;
}

export function useConnectWallet(wallet: UiWallet): ConnectWallet {
  const [isConnecting, connectFeature] = useConnect(wallet);
  const [, setAccount] = useSelectedWalletAccount();
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const accounts = await connectFeature();
      const account =
        accounts.find((a) => a.chains.includes(solanaConfig.chain)) ?? accounts[0] ?? wallet.accounts[0];
      if (!account) {
        setError(tr("wallet", "noAccountShared"));
        return null;
      }
      setAccount(account);
      return account;
    } catch (err) {
      setError(errorMessage(err, tr("wallet", "connectFailed")));
      return null;
    }
  }, [connectFeature, setAccount, wallet]);

  return { connecting: isConnecting, error, connect };
}

export interface DisconnectWallet {
  disconnecting: boolean;
  disconnect: () => Promise<void>;
}

/** Disconnects `wallet` (when it supports standard:disconnect) and always clears the selection. */
export function useDisconnectWallet(wallet: UiWallet): DisconnectWallet {
  const [isDisconnecting, disconnectFeature] = useDisconnect(wallet);
  const [, setAccount] = useSelectedWalletAccount();
  const disconnect = useCallback(async () => {
    try {
      if (wallet.features.includes("standard:disconnect")) await disconnectFeature();
    } catch {
      // The wallet may already have dropped us; clearing the selection is what matters.
    } finally {
      setAccount(undefined);
    }
  }, [disconnectFeature, setAccount, wallet]);
  return { disconnecting: isDisconnecting, disconnect };
}

/**
 * TransactionSendingSigner for the connected account on the configured chain. Call it in a
 * component that only renders while an account is connected (hooks cannot be conditional).
 */
export function useSendingSigner(account: UiWalletAccount): TransactionSendingSigner {
  return useWalletAccountTransactionSendingSigner(account, solanaConfig.chain);
}

/* ------------------------------------------------------------------------------------------ */
/* Balance change notifications                                                                */
/* ------------------------------------------------------------------------------------------ */

let balancesVersion = 0;
const balanceListeners = new Set<() => void>();

/** Call after anything that moves funds (stake, claim) so every balance view refetches. */
export function notifyBalancesChanged(): void {
  balancesVersion += 1;
  balanceListeners.forEach((l) => l());
}

function subscribeBalances(listener: () => void): () => void {
  balanceListeners.add(listener);
  return () => balanceListeners.delete(listener);
}

function useBalancesVersion(): number {
  return useSyncExternalStore(subscribeBalances, () => balancesVersion, () => 0);
}

/* ------------------------------------------------------------------------------------------ */
/* Async reads                                                                                 */
/* ------------------------------------------------------------------------------------------ */

interface Settled<T> {
  baseKey: string;
  requestKey: string;
  data: T | null;
  error: string | null;
}

/**
 * Loads `load()` whenever `key` changes (null = idle). `load` must only depend on what `key`
 * encodes. `epoch` (and `refresh()`) reload the same key; during such a reload the previous data
 * stays visible with status "loading".
 */
function useAsyncResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  epoch = 0,
): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const requestKey = key === null ? null : `${key}#${epoch}#${nonce}`;

  useEffect(() => {
    if (key === null || requestKey === null) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ baseKey: key, requestKey, data, error: null });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setSettled((prev) => ({
          baseKey: key,
          requestKey,
          data: prev?.baseKey === key ? prev.data : null,
          error: err instanceof Error && err.message ? err.message : tr("wallet", "requestFailed"),
        }));
      },
    );
    return () => controller.abort();
  }, [requestKey, key, load]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  if (key === null) return { status: "idle", data: null, error: null, refresh };
  if (settled?.requestKey === requestKey) {
    return settled.error
      ? { status: "error", data: settled.data, error: settled.error, refresh }
      : { status: "ready", data: settled.data, error: null, refresh };
  }
  return { status: "loading", data: settled?.baseKey === key ? settled.data : null, error: null, refresh };
}

/** SKR (tSKR in devnet test mode) held in the owner's ATA. Idle when owner is null. */
export function useSkrBalance(owner: Address | null): AsyncState<SkrBalance> {
  const t = useT("wallet");
  const version = useBalancesVersion();
  const mint = solanaConfig.skrMint;
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!owner || !mint) return Promise.reject(new Error("No wallet connected"));
      return fetchSkrBalance(getBrowserRpc(), owner, mint, { abortSignal: signal });
    },
    [owner, mint],
  );
  const state = useAsyncResource(owner && mint ? `skr:${owner}:${mint}` : null, load, version);
  if (owner && !mint) {
    return { status: "error", data: null, error: t("mintNotConfigured", { token: solanaConfig.tokenLabel }), refresh: state.refresh };
  }
  return state;
}

/** Lamports. Idle when owner is null. */
export function useSolBalance(owner: Address | null): AsyncState<bigint> {
  const version = useBalancesVersion();
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!owner) return Promise.reject(new Error("No wallet connected"));
      return fetchSolBalance(getBrowserRpc(), owner, { abortSignal: signal });
    },
    [owner],
  );
  return useAsyncResource(owner ? `sol:${owner}` : null, load, version);
}

/** Seeker Genesis Token check via GET /api/seeker. Idle when owner is null. */
export function useSeekerStatus(owner: Address | null): AsyncState<SeekerStatus> {
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!owner) return Promise.reject(new Error("No wallet connected"));
      return fetchSeekerStatus(owner, { signal });
    },
    [owner],
  );
  return useAsyncResource(owner ? `seeker:${owner}` : null, load);
}

/* ------------------------------------------------------------------------------------------ */
/* Platform                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export type Platform = "android" | "ios" | "other";

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS reports a desktop Safari UA; touch points give it away.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  return "other";
}

const noopSubscribe = () => () => {};

/** null during SSR and hydration, then the detected platform. */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    () => null,
  );
}
