import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "Modalità test sviluppatore: Solana {cluster} con token di prova ({token}). Nessun valore reale.",
  disconnect: "Disconnetti",
  disconnecting: "Disconnessione…",
  copyAddress: "Copia indirizzo",
  addressCopied: "Indirizzo copiato",
  copied: "Copiato",
  walletFallbackName: "Wallet",
  viewOnExplorer: "Vedi su Explorer",
  balanceTitle: "Saldo {token}",
  refreshBalances: "Aggiorna saldi",
  loading: "Caricamento…",
  balanceLoadFailed: "Impossibile caricare il tuo saldo {token}. {reason}",
  solForFees: "SOL per le commissioni di rete: {amount}",
  unavailable: "non disponibile",
  lowSol: "SOL in esaurimento. Aggiungi un po' di SOL per pagare le commissioni di rete prima dello staking.",
  neverMovesFunds: "Fitr non sposta mai fondi da solo. Ogni posta o riscossione la approvi tu nel tuo wallet.",
  connectTitle: "Collega il tuo wallet",
  connectHint: "Collegalo per vedere il tuo saldo {token} e mettere in gioco il tuo obiettivo giornaliero.",

  // Connect list
  installedWallet: "Usa il wallet installato",
  waitingForWallet: "In attesa del wallet…",
  iosUnsupported: "La connessione del wallet non è supportata su iOS. Lo staking di Fitr funziona su Android, pensato per Solana Seeker.",
  noWalletAndroid: "Nessuna app wallet Solana trovata. Installane una (Seeker ne ha una integrata), poi torna qui.",
  noWalletBrowser: "Nessun wallet Solana trovato in questo browser. Apri Fitr sul tuo Seeker o sul tuo telefono Android.",
  walletsLabel: "Wallet",

  // Seeker badge
  seekerChecking: "Verifica del Seeker…",
  seekerUnavailable: "Verifica Seeker non disponibile",
  seekerVerified: "Seeker verificato",
  seekerMissing: "Nessun Seeker Genesis Token",

  // Errors
  connectCancelled: "Richiesta annullata nel wallet.",
  noAccountShared: "Il wallet non ha condiviso alcun account.",
  connectFailed: "Impossibile collegarsi al wallet.",
  requestFailed: "Richiesta non riuscita",
  mintNotConfigured: "Il mint di {token} non è configurato",
  networkError: "Errore di rete. Controlla la connessione.",
  seekerCheckBadResponse: "Risposta inattesa dalla verifica Seeker",
  seekerCheckFailed: "Verifica Seeker non riuscita ({status})",
  tokenAccountWrongProgram: "Il token account non appartiene al programma SPL Token",
  tokenAccountMismatch: "Il token account non corrisponde al mint/proprietario previsto",
};

export default wallet;
