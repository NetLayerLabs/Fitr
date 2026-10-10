import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "Aujourd’hui",
  greetingMorning: "Bonjour",
  greetingAfternoon: "Bon après-midi",
  greetingEvening: "Bonsoir",
  dayStreak: "jours d’affilée",
  dayUnit_one: "jour",
  dayUnit_other: "jours",

  // Time left until the deadline
  deadlinePassed: "Délai dépassé",
  timeLeftUnderMinute: "<1 min restante",
  timeLeftHoursMinutes: "{hours} h {minutes} min restantes",
  timeLeftMinutes: "{minutes} min restantes",
  spokenUnderMinute: "Moins d’une minute restante",
  spokenLeft: "Encore {time}",
  spokenHours_one: "{count} heure",
  spokenHours_other: "{count} heures",
  spokenMinutes_one: "{count} minute",
  spokenMinutes_other: "{count} minutes",
  spokenSeconds_one: "{count} seconde",
  spokenSeconds_other: "{count} secondes",

  // Amounts in an exercise unit
  goalReps_one: "{count} rép.",
  goalReps_other: "{count} rép.",
  goalSeconds_one: "{count} s",
  goalSeconds_other: "{count} s",

  // Hero card
  heroLoadingTitle: "Vérification de ton engagement…",
  heroGoalEyebrow: "Ton objectif",
  heroGoalFallback: "Objectif du jour",
  start: "Commencer",
  viewCommitment: "Voir l’engagement",
  atStake: "{amount} en jeu",
  verifyingEyebrow: "Presque fini",
  verifyingTitle: "Vérification de ta séance…",
  verifyingBody: "Fitr revérifie tes répétitions et les défis en direct. Ça ne prend généralement qu’un instant.",
  verifiedTitle: "Objectif validé",
  seeProgress: "Voir les progrès",
  verifiedBodyWithGoal: "{goal} : fait et enregistré onchain. Ta mise est sauve. Reviens demain.",
  verifiedBody: "Fait et enregistré onchain. Ta mise est sauve. Reviens demain.",
  claimEyebrow: "Prêt à récupérer",
  claimFallbackTitle: "Ta mise est de retour",
  claim: "Récupérer",
  claimBody: "Tu as tenu parole. Récupère ta mise et ta part.",
  missedEyebrow: "Objectif manqué",
  missedTitle: "Demain est un autre jour",
  commitAgain: "S’engager à nouveau",
  missedBody: "Le délai est passé sans séance validée. Fixe-toi un objectif que tu peux tenir.",
  revokedEyebrow: "En cours d’examen",
  revokedTitle: "Validation retirée",
  viewDetails: "Voir les détails",
  revokedBody:
    "L’examen de Fitr a retiré la validation du jour. Ta mise n’est pas perdue : tu pourras la récupérer (sans bonus) une fois la journée clôturée.",
  trainFreeEyebrow: "Entraînement libre",
  pickWorkout: "Choisis une séance",
  notSeekerTitle: "Les engagements nécessitent un Seeker",
  notSeekerBody: "Le staking est réservé aux propriétaires de Solana Seeker. Toutes les séances et le compteur de répétitions restent à toi.",
  pausedTitle: "Les engagements sont en pause",
  pausedBody: "Le staking est indisponible pour le moment. Tes séances comptent quand même.",
  commitTitle: "Engage ta parole",
  commit: "S’engager",
  commitBodyNoWallet: "Connecte ton wallet, choisis un objectif et mise des SKR sur ta présence aujourd’hui.",
  commitBody: "Choisis un objectif et mise des SKR sur ta présence aujourd’hui. Atteins-le et ta mise te revient.",

  // Commitment card
  commitmentCardTitle: "Engagement quotidien $SKR",
  stepStakeTitle: "Mise.",
  stepStakeBody: "Choisis ton objectif du jour et combien de SKR bloquer. Les deux sont fixés onchain quand tu t’engages.",
  stepShowUpTitle: "Sois au rendez-vous.",
  stepShowUpBody:
    "Atteins ton objectif, compté sur l’appareil par le suivi des mouvements et revérifié par le vérificateur de Fitr. Ta mise te revient, avec une part de la cagnotte.",
  stepPayUpTitle: "Ou paie.",
  stepPayUpBody: "Si tu le manques, ta mise va à ceux qui étaient au rendez-vous, moins 5 % de frais.",
  currentStreak: "Série en cours",
  poolMultiplier: "Multiplicateur de cagnotte",
  notAvailableYet: "Pas encore disponible",
  commitToken: "Engager des {token}",
  stakeNote: "Tu choisis l’objectif et la mise. Rien n’est misé tant que tu n’as pas signé dans ton wallet.",

  // Wallet row
  balanceUnavailable: "Solde indisponible",
  loadingBalance: "Chargement du solde…",
  connectWallet: "Connecter le wallet",
  seeBalance: "Voir ton solde {token}",

  // Activity + quick start
  activityHeading: "Activité du jour",
  nothingLoggedYet: "Rien d’enregistré aujourd’hui pour l’instant.",
  defaultGoalHit: "Objectif par défaut atteint",
  quickStartHeading: "Démarrage rapide",
  allWorkouts: "Toutes les séances",
  heroGoalTomorrowEyebrow: "Objectif de demain",
  practiceNow: "S'entraîner maintenant",
  countsFrom: "Compte à partir de {time}",
};

export default today;
