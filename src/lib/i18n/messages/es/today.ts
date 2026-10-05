import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "Hoy",
  greetingMorning: "Buenos días",
  greetingAfternoon: "Buenas tardes",
  greetingEvening: "Buenas noches",
  dayStreak: "días de racha",
  dayUnit_one: "día",
  dayUnit_other: "días",

  // Time left until the deadline
  deadlinePassed: "Plazo vencido",
  timeLeftUnderMinute: "Queda <1 min",
  timeLeftHoursMinutes: "Quedan {hours} h {minutes} min",
  timeLeftMinutes: "Quedan {minutes} min",
  spokenUnderMinute: "Queda menos de un minuto",
  spokenLeft: "Quedan {time}",
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
  heroLoadingTitle: "Revisando tu compromiso…",
  heroGoalEyebrow: "Tu meta",
  heroGoalFallback: "Meta de hoy",
  start: "Empezar",
  viewCommitment: "Ver compromiso",
  atStake: "{amount} en juego",
  verifyingEyebrow: "Ya casi",
  verifyingTitle: "Verificando tu entrenamiento…",
  verifyingBody: "Fitr está revisando de nuevo tus repeticiones y los retos en vivo. Suele tardar un momento.",
  verifiedTitle: "Meta verificada",
  seeProgress: "Ver progreso",
  verifiedBodyWithGoal: "{goal}: hecho y registrado onchain. Tu depósito está a salvo. Vuelve mañana.",
  verifiedBody: "Hecho y registrado onchain. Tu depósito está a salvo. Vuelve mañana.",
  claimEyebrow: "Listo para reclamar",
  claimFallbackTitle: "Tu depósito ha vuelto",
  claim: "Reclamar",
  claimBody: "Cumpliste tu palabra. Reclama tu depósito y tu parte.",
  missedEyebrow: "Meta no cumplida",
  missedTitle: "Mañana es otro día",
  commitAgain: "Comprometerme otra vez",
  missedBody: "El plazo venció sin un entrenamiento verificado. Elige una meta que puedas cumplir.",
  revokedEyebrow: "En revisión",
  revokedTitle: "Verificación retirada",
  viewDetails: "Ver detalles",
  revokedBody:
    "La revisión de Fitr retiró la verificación de hoy. No pierdes tu depósito: podrás reclamarlo (sin bonificación) cuando se cierre el día.",
  trainFreeEyebrow: "Entrena gratis",
  pickWorkout: "Elige un ejercicio",
  notSeekerTitle: "Los compromisos requieren un Seeker",
  notSeekerBody: "El depósito es para quienes tienen un Solana Seeker. Todos los ejercicios y el contador de repeticiones siguen siendo tuyos.",
  pausedTitle: "Los compromisos están en pausa",
  pausedBody: "Los depósitos no están disponibles ahora mismo. Tus entrenamientos siguen contando.",
  commitTitle: "Pon tu palabra en juego",
  commit: "Comprometerme",
  commitBodyNoWallet: "Conecta tu billetera, elige una meta y deposita SKR como garantía de que entrenarás hoy.",
  commitBody: "Elige una meta y deposita SKR como garantía de que entrenarás hoy. Si la cumples, recuperas tu depósito.",

  // Commitment card
  commitmentCardTitle: "Compromiso diario en $SKR",
  stepStakeTitle: "Deposita.",
  stepStakeBody: "Elige tu meta diaria y cuánto SKR bloquear. Ambos quedan fijados onchain al comprometerte.",
  stepShowUpTitle: "Cumple.",
  stepShowUpBody:
    "Alcanza tu meta: el seguimiento de postura la cuenta en tu teléfono y el verificador de Fitr la revisa. Recuperas tu depósito más una parte del fondo.",
  stepPayUpTitle: "O paga.",
  stepPayUpBody: "Si no cumples, tu depósito va para quienes sí cumplieron, menos una comisión del 5%.",
  currentStreak: "Racha actual",
  poolMultiplier: "Multiplicador del fondo",
  notAvailableYet: "Aún no disponible",
  commitToken: "Comprometer {token}",
  stakeNote: "Tú eliges la meta y el depósito. No se deposita nada hasta que firmes en tu billetera.",

  // Wallet row
  balanceUnavailable: "Saldo no disponible",
  loadingBalance: "Cargando saldo…",
  connectWallet: "Conectar billetera",
  seeBalance: "Ver tu saldo de {token}",

  // Activity + quick start
  activityHeading: "Actividad de hoy",
  nothingLoggedYet: "Aún no hay nada registrado hoy.",
  defaultGoalHit: "Meta predeterminada cumplida",
  quickStartHeading: "Inicio rápido",
  allWorkouts: "Todos los ejercicios",
};

export default today;
