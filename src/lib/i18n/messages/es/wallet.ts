import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "Modo de prueba para desarrolladores: Solana {cluster} con tokens de prueba ({token}). Sin valor real.",
  disconnect: "Desconectar",
  disconnecting: "Desconectando…",
  copyAddress: "Copiar dirección",
  addressCopied: "Dirección copiada",
  copied: "Copiado",
  walletFallbackName: "Billetera",
  viewOnExplorer: "Ver en el explorador",
  balanceTitle: "Saldo de {token}",
  refreshBalances: "Actualizar saldos",
  loading: "Cargando…",
  balanceLoadFailed: "No se pudo cargar tu saldo de {token}. {reason}",
  solForFees: "SOL para comisiones de red: {amount}",
  unavailable: "no disponible",
  lowSol: "Te queda poco SOL. Añade un poco para pagar las comisiones de red antes de depositar.",
  neverMovesFunds: "Fitr nunca mueve fondos por su cuenta. Cada depósito o reclamo lo apruebas tú en tu billetera.",
  connectTitle: "Conecta tu billetera",
  connectHint: "Conéctate para ver tu saldo de {token} y depositar por tu meta diaria.",

  // Connect list
  installedWallet: "Usar billetera instalada",
  waitingForWallet: "Esperando a la billetera…",
  iosUnsupported: "La conexión de billetera no es compatible con iOS. Los depósitos de Fitr funcionan en Android, pensados para el Solana Seeker.",
  noWalletAndroid: "No se encontró ninguna app de billetera de Solana. Instala una (el Seeker trae una integrada) y vuelve.",
  noWalletBrowser: "No se encontró ninguna billetera de Solana en este navegador. Abre Fitr en tu Seeker o teléfono Android.",
  walletsLabel: "Billeteras",

  // Seeker badge
  seekerChecking: "Comprobando Seeker…",
  seekerUnavailable: "Comprobación de Seeker no disponible",
  seekerVerified: "Seeker verificado",
  seekerMissing: "Sin Seeker Genesis Token",

  // Errors
  connectCancelled: "Solicitud cancelada en tu billetera.",
  noAccountShared: "La billetera no compartió ninguna cuenta.",
  connectFailed: "No se pudo conectar con la billetera.",
  requestFailed: "La solicitud falló",
  mintNotConfigured: "El mint de {token} no está configurado",
  networkError: "Error de red. Revisa tu conexión.",
  seekerCheckBadResponse: "Respuesta inesperada al comprobar el Seeker",
  seekerCheckFailed: "Falló la comprobación del Seeker ({status})",
  tokenAccountWrongProgram: "La cuenta de token no pertenece al programa SPL Token",
  tokenAccountMismatch: "La cuenta de token no coincide con el mint/propietario esperado",
};

export default wallet;
