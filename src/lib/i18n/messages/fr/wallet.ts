import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "Mode test développeur : Solana {cluster} avec des tokens de test ({token}). Aucune valeur réelle.",
  disconnect: "Déconnecter",
  disconnecting: "Déconnexion…",
  copyAddress: "Copier l’adresse",
  addressCopied: "Adresse copiée",
  copied: "Copié",
  walletFallbackName: "Wallet",
  viewOnExplorer: "Voir sur l’Explorer",
  balanceTitle: "Solde {token}",
  refreshBalances: "Actualiser les soldes",
  loading: "Chargement…",
  balanceLoadFailed: "Impossible de charger ton solde {token}. {reason}",
  solForFees: "SOL pour les frais de réseau : {amount}",
  unavailable: "indisponible",
  lowSol: "Peu de SOL. Ajoute un peu de SOL pour payer les frais de réseau avant de miser.",
  neverMovesFunds: "Fitr ne déplace jamais de fonds de lui-même. Chaque mise ou récupération est validée par toi dans ton wallet.",
  connectTitle: "Connecte ton wallet",
  connectHint: "Connecte-toi pour voir ton solde {token} et miser sur ton objectif du jour.",

  // Connect list
  installedWallet: "Utiliser le wallet installé",
  waitingForWallet: "En attente du wallet…",
  iosUnsupported: "La connexion de wallet n’est pas prise en charge sur iOS. Le staking Fitr fonctionne sur Android, conçu pour le Solana Seeker.",
  noWalletAndroid: "Aucune appli de wallet Solana trouvée. Installes-en une (le Seeker en a une intégrée), puis reviens.",
  noWalletBrowser: "Aucun wallet Solana trouvé dans ce navigateur. Ouvre Fitr sur ton Seeker ou ton téléphone Android.",
  walletsLabel: "Wallets",

  // Seeker badge
  seekerChecking: "Vérification du Seeker…",
  seekerUnavailable: "Vérification du Seeker indisponible",
  seekerVerified: "Seeker vérifié",
  seekerMissing: "Aucun Seeker Genesis Token",

  // Errors
  connectCancelled: "Demande annulée dans ton wallet.",
  noAccountShared: "Le wallet n’a partagé aucun compte.",
  connectFailed: "Impossible de se connecter au wallet.",
  requestFailed: "La demande a échoué",
  mintNotConfigured: "Le mint {token} n’est pas configuré",
  networkError: "Erreur réseau. Vérifie ta connexion.",
  seekerCheckBadResponse: "Réponse inattendue de la vérification du Seeker",
  seekerCheckFailed: "La vérification du Seeker a échoué ({status})",
  tokenAccountWrongProgram: "Le compte de token n’appartient pas au programme SPL Token",
  tokenAccountMismatch: "Le compte de token ne correspond pas au mint/propriétaire attendu",
};

export default wallet;
