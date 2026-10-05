import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "Solo",
  unnamedCrew: "Equipe {suffix}",
  challengeFree: "Cada um escolhe seu próprio treino",
  challengeFixedGoal: "{goal} para todos",
  challengeFixedExercise: "{exercise}, cada um define sua própria meta",
  inviteShareText: 'Entre na minha equipe "{name}" no Fitr. {challenge}. Faça stake de SKR para aparecer: quem falta financia quem aparece.',
  inviteShareTitle: "{name} no Fitr",

  // Page metadata
  metaTitle: "Equipe",
  metaDescription: "Sua equipe no Fitr: o desafio de hoje, quem apareceu, a sequência da equipe e o ranking.",

  // Crew hub (Commit tab)
  yourCrewsTitle: "Suas equipes",
  lookingForCrews: "Procurando suas equipes…",
  crewsLoadError: "Não foi possível carregar suas equipes agora. Tente de novo daqui a pouco.",
  noCrewsYet: "Nenhuma equipe ainda. Crie uma abaixo e compartilhe o link, ou abra um convite de um amigo.",
  yoursTag: "Sua",
  joinTitle: "Entrar em uma equipe",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "Link de convite ou número da equipe",
  joinOpen: "Abrir",
  joinInvalid: "Cole um link de convite como fitr.day/c/123… ou o número da equipe.",

  // Create a crew
  createTitle: "Criar uma equipe",
  createHint:
    "Sua equipe tem seu próprio pool: quem falta financia os membros que aparecem. Se ninguém aparecer em um dia, os stakes passam para o próximo dia em que alguém aparecer.",
  crewNameLabel: "Nome da equipe",
  crewNamePlaceholder: "Turma da Manhã",
  crewNameEmpty: "Dê um nome para sua equipe.",
  crewNameChars: "Use apenas letras, números e emoji.",
  crewNameTooLong: "Esse nome é longo demais (máx. 32 bytes).",
  sameExerciseToggle: "Todos fazem o mesmo exercício",
  sameGoalToggle: "Mesma meta para todos",
  createNeedsSol:
    "Criar uma equipe exige cerca de {needed} para aluguel de conta e taxa de rede. Esta carteira tem {balance}.",
  createPaused: "A criação de novas equipes está pausada para manutenção no momento.",
  working: "Processando…",
  createButton: "Criar equipe",
  createFine:
    "Uma assinatura · cerca de {rent} de aluguel de conta (não reembolsável). Criar uma equipe não te dá poderes especiais sobre ela: as mesmas regras onchain valem para todos.",
  createTimeout: "Sua carteira enviou, mas a rede ainda não confirmou. Confira no explorer e depois atualize.",
  createFailedOnchain: "A criação da equipe falhou onchain. Nada foi cobrado além da taxa de rede.",
  vaultReadError: "Não foi possível ler o cofre",

  // Commitments across pools
  commitmentsTodayTitle: "Seus compromissos de hoje",
  goalFallback: "Meta",
  forTomorrow: "amanhã",
  tagToDo: "A fazer",
  tagVerifying: "Verificando",
  tagVerified: "Verificado",
  tagClaim: "Resgatar",
  tagMissed: "Não cumprido",
  tagWithdrawn: "Retirado",
  tagCommitted: "Comprometido",

  // Crew page
  eyebrowCrew: "Equipe",
  eyebrowCommitTogether: "Comprometam-se juntos",
  loadingCrew: "Carregando a equipe",
  notFoundTitle: "Equipe não encontrada",
  notFoundBody: "Não encontramos esta equipe onchain. Confira o link de convite; talvez o stake ainda não esteja aberto.",
  goToCommit: "Ir para Compromisso",
  unreachableTitle: "Não foi possível acessar o cofre",
  unreachableBody: "Não conseguimos ler esta equipe. Verifique sua conexão e tente de novo.",
  tryAgain: "Tentar de novo",
  connectToCommit: "Conecte sua carteira para se comprometer com a equipe. Você mesmo assina cada stake.",
  seekerOnly:
    "O stake é exclusivo do Seeker: esta carteira não tem um Seeker Genesis Token. Você ainda pode acompanhar a equipe e treinar.",
  checkSeekerAgain: "Verificar meu Seeker de novo",
  checkingSeeker: "Verificando seu Seeker…",
  deletedTitle: "Esta equipe foi excluída",
  deletedBody:
    "Quem a criou removeu-a do Fitr, então ninguém pode mais entrar nem fazer stake nela. Se você fez stake aqui, ainda pode resgatar abaixo.",
  todaysChallenge: "Desafio de hoje",
  ownWorkoutOwnGoal: "Seu treino, sua meta",
  sameGoalSentence: "Mesma meta para todos.",
  challengeSentence: "{challenge}.",
  challengeRules:
    "Quem falta financia os membros da equipe que aparecem. Se ninguém aparecer, os stakes passam para o próximo dia da equipe que alguém concluir.",
  statStreak: "Sequência da equipe",
  statVerifiedToday: "Verificados hoje",
  statMembers: "Membros",
  todayTitle: "Hoje",
  dayLoadError: "Não foi possível carregar o dia da equipe. Ele se atualiza sozinho.",
  loading: "Carregando…",
  nobodyCommitted: "Ninguém se comprometeu hoje ainda. Seja o primeiro e depois compartilhe o link.",
  you: "Você",
  streakExplainer: "A sequência da equipe conta os dias em que todos que se comprometeram foram verificados.",
  streakExplainerBest: "A sequência da equipe conta os dias em que todos que se comprometeram foram verificados (melhor: {best}).",
  yourStakeTitle: "Seu stake",
  leaderboardTitle: "Ranking",
  leaderboardLabel: "Ranking da equipe",
  leaderboardEmpty: "O ranking começa a ser preenchido após o primeiro dia verificado.",
  leaderDays_one: "{count} dia verificado · sequência {streak}",
  leaderDays_other: "{count} dias verificados · sequência {streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "bônus",
  bonusExplainer:
    "O bônus é o que os membros receberam além do próprio stake de volta, vindo de membros da equipe que não cumpriram (o Fitr cobra uma taxa de {fee}% apenas sobre valores perdidos). Os valores em {token} vêm dos perfis onchain da equipe.",
  rolloverNote: "Acumulando: {amount} de dias da equipe que ninguém concluiu vai para o próximo dia em que alguém concluir.",

  // Invite actions
  inviteButton: "Convidar",
  copyButton: "Copiar",
  copiedButton: "Copiado",
  copyInviteLink: "Copiar link de convite",
  inviteLinkCopied: "Link de convite copiado",
  inviteLinkLabel: "Link de convite",

  // Delete crew
  deleteButton: "Excluir equipe",
  deleteConfirmTitle: "Excluir {name}?",
  deleteConfirmBody:
    "Ela some do Fitr e o link de convite para de funcionar. Ninguém mais pode entrar nem fazer stake nela. Quem já fez stake ainda pode resgatar. Sua carteira assina uma mensagem para provar que você a criou: sem transação, sem taxa.",
  keepIt: "Manter",
  deleting: "Excluindo…",
  deleteCancelled: "Cancelado na sua carteira. Nada mudou.",
  deleteFailed: "Não foi possível excluir a equipe. Tente de novo.",
  deleteFailedStatus: "Não foi possível excluir a equipe ({status}).",
};

export default crews;
