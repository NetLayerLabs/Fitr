/**
 * Mobile Wallet Adapter (MWA) registration. On Android (Seeker, Chrome, the TWA shell) this adds a
 * Wallet Standard wallet that opens the phone's installed wallet app (Seed Vault on Seeker).
 *
 * registerMwa itself no-ops (with a console warning) outside a secure context or on unsupported
 * platforms. We register only for local (on-device) association: no remote/QR flow.
 */
import {
  SolanaMobileWalletAdapterRemoteWalletName,
  SolanaMobileWalletAdapterWalletName,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";
import { solanaConfig } from "./config";

export const MWA_WALLET_NAMES: readonly string[] = [
  SolanaMobileWalletAdapterWalletName,
  SolanaMobileWalletAdapterRemoteWalletName,
];

/** Relative to the app origin, as MWA's appIdentity expects. */
export const MWA_APP_ICON = "icons/icon-192.png";

let registered = false;

/** Idempotent: safe to call from effects that run twice under StrictMode. Browser only. */
export function ensureMwaRegistered(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;
  registerMwa({
    appIdentity: {
      name: "Fitr",
      uri: window.location.origin,
      icon: MWA_APP_ICON,
    },
    authorizationCache: createDefaultAuthorizationCache(),
    chains: [solanaConfig.chain],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
}

export function isMobileWalletAdapterName(name: string): boolean {
  return MWA_WALLET_NAMES.includes(name);
}

/** Test-only: lets a test re-run registration. */
export function __resetMwaRegistrationForTests(): void {
  registered = false;
}
