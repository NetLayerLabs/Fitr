import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "Entwickler-Testmodus: Solana {cluster} mit Test-Tokens ({token}). Kein echter Wert.",
  disconnect: "Trennen",
  disconnecting: "Wird getrennt…",
  copyAddress: "Adresse kopieren",
  addressCopied: "Adresse kopiert",
  copied: "Kopiert",
  walletFallbackName: "Wallet",
  viewOnExplorer: "Im Explorer ansehen",
  balanceTitle: "{token}-Guthaben",
  refreshBalances: "Guthaben aktualisieren",
  loading: "Lädt…",
  balanceLoadFailed: "Dein {token}-Guthaben konnte nicht geladen werden. {reason}",
  solForFees: "SOL für Netzwerkgebühren: {amount}",
  unavailable: "nicht verfügbar",
  lowSol: "Wenig SOL. Lade vor dem Einsetzen etwas SOL für Netzwerkgebühren auf.",
  neverMovesFunds: "Fitr bewegt nie selbst Guthaben. Jeden Einsatz und jede Abholung bestätigst du in deiner Wallet.",
  connectTitle: "Wallet verbinden",
  connectHint: "Verbinde dich, um dein {token}-Guthaben zu sehen und auf dein Tagesziel zu setzen.",

  // Connect list
  installedWallet: "Installierte Wallet nutzen",
  waitingForWallet: "Warte auf Wallet…",
  iosUnsupported: "Wallet-Verbindung wird auf iOS nicht unterstützt. Einsätze bei Fitr funktionieren auf Android, gebaut für das Solana Seeker.",
  noWalletAndroid: "Keine Solana-Wallet-App gefunden. Installier eine (Seeker hat eine eingebaut) und komm dann zurück.",
  noWalletBrowser: "Keine Solana-Wallet in diesem Browser gefunden. Öffne Fitr auf deinem Seeker oder Android-Handy.",
  walletsLabel: "Wallets",

  // Seeker badge
  seekerChecking: "Seeker wird geprüft…",
  seekerUnavailable: "Seeker-Prüfung nicht verfügbar",
  seekerVerified: "Seeker bestätigt",
  seekerMissing: "Kein Seeker Genesis Token",

  // Errors
  connectCancelled: "Anfrage in deiner Wallet abgebrochen.",
  noAccountShared: "Die Wallet hat kein Konto freigegeben.",
  connectFailed: "Verbindung zur Wallet fehlgeschlagen.",
  requestFailed: "Anfrage fehlgeschlagen",
  mintNotConfigured: "{token}-Mint ist nicht konfiguriert",
  networkError: "Netzwerkfehler. Prüf deine Verbindung.",
  seekerCheckBadResponse: "Unerwartete Antwort der Seeker-Prüfung",
  seekerCheckFailed: "Seeker-Prüfung fehlgeschlagen ({status})",
  tokenAccountWrongProgram: "Token-Konto gehört nicht zum SPL-Token-Programm",
  tokenAccountMismatch: "Token-Konto passt nicht zum erwarteten Mint/Besitzer",
};

export default wallet;
