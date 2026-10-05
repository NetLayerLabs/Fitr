import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "Modo de teste para desenvolvedores: Solana {cluster} com tokens de teste ({token}). Sem valor real.",
  disconnect: "Desconectar",
  disconnecting: "Desconectando…",
  copyAddress: "Copiar endereço",
  addressCopied: "Endereço copiado",
  copied: "Copiado",
  walletFallbackName: "Carteira",
  viewOnExplorer: "Ver no Explorer",
  balanceTitle: "Saldo de {token}",
  refreshBalances: "Atualizar saldos",
  loading: "Carregando…",
  balanceLoadFailed: "Não foi possível carregar seu saldo de {token}. {reason}",
  solForFees: "SOL para taxas de rede: {amount}",
  unavailable: "indisponível",
  lowSol: "Pouco SOL. Adicione um pouco de SOL para pagar as taxas de rede antes de fazer stake.",
  neverMovesFunds: "O Fitr nunca movimenta fundos por conta própria. Cada stake ou resgate é aprovado por você na sua carteira.",
  connectTitle: "Conecte sua carteira",
  connectHint: "Conecte para ver seu saldo de {token} e fazer stake na sua meta diária.",

  // Connect list
  installedWallet: "Usar carteira instalada",
  waitingForWallet: "Aguardando a carteira…",
  iosUnsupported: "A conexão de carteira não é compatível com iOS. O stake no Fitr funciona no Android, feito para o Solana Seeker.",
  noWalletAndroid: "Nenhum app de carteira Solana encontrado. Instale um (o Seeker já vem com um) e volte aqui.",
  noWalletBrowser: "Nenhuma carteira Solana encontrada neste navegador. Abra o Fitr no seu Seeker ou celular Android.",
  walletsLabel: "Carteiras",

  // Seeker badge
  seekerChecking: "Verificando o Seeker…",
  seekerUnavailable: "Verificação do Seeker indisponível",
  seekerVerified: "Seeker verificado",
  seekerMissing: "Sem Seeker Genesis Token",

  // Errors
  connectCancelled: "Solicitação cancelada na sua carteira.",
  noAccountShared: "A carteira não compartilhou uma conta.",
  connectFailed: "Não foi possível conectar à carteira.",
  requestFailed: "A solicitação falhou",
  mintNotConfigured: "O mint de {token} não está configurado",
  networkError: "Erro de rede. Verifique sua conexão.",
  seekerCheckBadResponse: "Resposta inesperada da verificação do Seeker",
  seekerCheckFailed: "A verificação do Seeker falhou ({status})",
  tokenAccountWrongProgram: "A conta de token não pertence ao programa SPL Token",
  tokenAccountMismatch: "A conta de token não corresponde ao mint/proprietário esperado",
};

export default wallet;
