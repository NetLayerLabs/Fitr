import type { NsMessages } from "../types";

const common: Partial<NsMessages<"common">> = {
  back: "Voltar",
  close: "Fechar",
  loading: "Carregando…",
  notFoundMetaTitle: "Não encontrado",
  notFoundTitle: "Esta página pulou o dia de perna",
  notFoundText: "Não encontramos o que você procurava.",
  notFoundCta: "Voltar para Hoje",
  offlineMetaTitle: "Offline",
  offlineTitle: "Você está offline",
  offlineBody: "Esta tela ainda não está salva neste aparelho. Reconecte e tente de novo.",
  offlineNote: "As telas que você já abriu continuam disponíveis offline, e o rastreamento de pose sempre roda no seu celular.",
  tryAgain: "Tentar de novo",
  home: "Início",
};

export default common;
