/** English source for the "wallet" namespace. Keys are stable ids; values may use {placeholders}. */
const wallet = {
  // Panel
  testMode: "Developer test mode: Solana {cluster} with test tokens ({token}). No real value.",
  disconnect: "Disconnect",
  disconnecting: "Disconnecting…",
  copyAddress: "Copy address",
  addressCopied: "Address copied",
  copied: "Copied",
  walletFallbackName: "Wallet",
  viewOnExplorer: "View on Explorer",
  balanceTitle: "{token} balance",
  refreshBalances: "Refresh balances",
  loading: "Loading…",
  balanceLoadFailed: "Could not load your {token} balance. {reason}",
  solForFees: "SOL for network fees: {amount}",
  unavailable: "unavailable",
  lowSol: "Low SOL. Add a little SOL to pay network fees before staking.",
  neverMovesFunds: "Fitr never moves funds on its own. Every stake or claim is approved by you in your wallet.",
  connectTitle: "Connect your wallet",
  connectHint: "Connect to see your {token} balance and stake on your daily goal.",

  // Connect list
  installedWallet: "Use Installed Wallet",
  waitingForWallet: "Waiting for wallet…",
  iosUnsupported: "Wallet connection is not supported on iOS. Fitr staking works on Android, built for the Solana Seeker.",
  noWalletAndroid: "No Solana wallet app found. Install one (Seeker has one built in), then come back.",
  noWalletBrowser: "No Solana wallet found in this browser. Open Fitr on your Seeker or Android phone.",
  walletsLabel: "Wallets",

  // Seeker badge
  seekerChecking: "Checking Seeker…",
  seekerUnavailable: "Seeker check unavailable",
  seekerVerified: "Seeker verified",
  seekerMissing: "No Seeker Genesis Token",

  // Errors
  connectCancelled: "Request cancelled in your wallet.",
  noAccountShared: "The wallet did not share an account.",
  connectFailed: "Could not connect to the wallet.",
  requestFailed: "Request failed",
  mintNotConfigured: "{token} mint is not configured",
  networkError: "Network error. Check your connection.",
  seekerCheckBadResponse: "Unexpected Seeker check response",
  seekerCheckFailed: "Seeker check failed ({status})",
  tokenAccountWrongProgram: "Token account is not owned by the SPL Token program",
  tokenAccountMismatch: "Token account does not match the expected mint/owner",
} as const;

export default wallet;
