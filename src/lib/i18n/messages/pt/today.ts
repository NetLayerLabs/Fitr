import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "Hoje",
  greetingMorning: "Bom dia",
  greetingAfternoon: "Boa tarde",
  greetingEvening: "Boa noite",
  dayStreak: "dias seguidos",
  dayUnit_one: "dia",
  dayUnit_other: "dias",

  // Time left until the deadline
  deadlinePassed: "Prazo encerrado",
  timeLeftUnderMinute: "<1 min restante",
  timeLeftHoursMinutes: "Faltam {hours}h {minutes}min",
  timeLeftMinutes: "Faltam {minutes}min",
  spokenUnderMinute: "Falta menos de um minuto",
  spokenLeft: "Faltam {time}",
  spokenHours_one: "{count} hora",
  spokenHours_other: "{count} horas",
  spokenMinutes_one: "{count} minuto",
  spokenMinutes_other: "{count} minutos",
  spokenSeconds_one: "{count} segundo",
  spokenSeconds_other: "{count} segundos",

  // Amounts in an exercise unit
  goalReps_one: "{count} rep",
  goalReps_other: "{count} reps",
  goalSeconds_one: "{count} s",
  goalSeconds_other: "{count} s",

  // Hero card
  heroLoadingTitle: "Verificando seu compromisso…",
  heroGoalEyebrow: "Sua meta",
  heroGoalFallback: "Meta de hoje",
  start: "Começar",
  viewCommitment: "Ver compromisso",
  atStake: "{amount} em jogo",
  verifyingEyebrow: "Quase lá",
  verifyingTitle: "Verificando seu treino…",
  verifyingBody: "O Fitr está conferindo de novo suas reps e os desafios ao vivo. Isso costuma levar só um instante.",
  verifiedTitle: "Meta verificada",
  seeProgress: "Ver progresso",
  verifiedBodyWithGoal: "{goal}: feito e registrado onchain. Seu stake está seguro. Volte amanhã.",
  verifiedBody: "Feito e registrado onchain. Seu stake está seguro. Volte amanhã.",
  claimEyebrow: "Pronto para resgatar",
  claimFallbackTitle: "Seu stake voltou",
  claim: "Resgatar",
  claimBody: "Você cumpriu sua palavra. Resgate seu stake e sua parte.",
  missedEyebrow: "Meta perdida",
  missedTitle: "Amanhã é um novo dia",
  commitAgain: "Comprometer-se de novo",
  missedBody: "O prazo acabou antes de um treino verificado. Defina uma meta que você consiga cumprir.",
  revokedEyebrow: "Em análise",
  revokedTitle: "Verificação retirada",
  viewDetails: "Ver detalhes",
  revokedBody:
    "A revisão do Fitr retirou a verificação de hoje. Seu stake não foi perdido: você pode resgatá-lo (sem bônus) quando o dia fechar.",
  trainFreeEyebrow: "Treino livre",
  pickWorkout: "Escolher um treino",
  notSeekerTitle: "Compromissos exigem um Seeker",
  notSeekerBody: "O stake é para quem tem um Solana Seeker. Todos os treinos e o contador de reps continuam liberados para você.",
  pausedTitle: "Compromissos pausados",
  pausedBody: "O stake está fora do ar no momento. Seus treinos continuam contando.",
  commitTitle: "Coloque sua palavra em jogo",
  commit: "Comprometer-se",
  commitBodyNoWallet: "Conecte sua carteira, escolha uma meta e faça stake de SKR para aparecer hoje.",
  commitBody: "Escolha uma meta e faça stake de SKR para aparecer hoje. Cumpra a meta e seu stake volta.",

  // Commitment card
  commitmentCardTitle: "Compromisso diário em $SKR",
  stepStakeTitle: "Faça stake.",
  stepStakeBody: "Escolha sua meta diária e quanto SKR bloquear. Os dois ficam fixados onchain quando você se compromete.",
  stepShowUpTitle: "Apareça.",
  stepShowUpBody:
    "Cumpra sua meta, contada no aparelho pelo rastreamento de pose e conferida de novo pelo verificador do Fitr. Seu stake volta, mais uma parte do pool.",
  stepPayUpTitle: "Ou pague.",
  stepPayUpBody: "Se falhar, seu stake vai para quem apareceu, menos uma taxa de 5%.",
  currentStreak: "Sequência atual",
  poolMultiplier: "Multiplicador do pool",
  notAvailableYet: "Ainda não disponível",
  commitToken: "Comprometer {token}",
  stakeNote: "Você escolhe a meta e o stake. Nada é colocado em stake até você assinar na sua carteira.",

  // Wallet row
  balanceUnavailable: "Saldo indisponível",
  loadingBalance: "Carregando saldo…",
  connectWallet: "Conectar carteira",
  seeBalance: "Veja seu saldo de {token}",

  // Activity + quick start
  activityHeading: "Atividade de hoje",
  nothingLoggedYet: "Nada registrado hoje ainda.",
  defaultGoalHit: "Meta padrão cumprida",
  quickStartHeading: "Início rápido",
  allWorkouts: "Todos os treinos",
  heroGoalTomorrowEyebrow: "Meta de amanhã",
  practiceNow: "Praticar agora",
  countsFrom: "Conta a partir de {time}",
};

export default today;
