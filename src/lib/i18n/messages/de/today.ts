import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "Heute",
  greetingMorning: "Guten Morgen",
  greetingAfternoon: "Guten Tag",
  greetingEvening: "Guten Abend",
  dayStreak: "Tage-Streak",
  dayUnit_one: "Tag",
  dayUnit_other: "Tage",

  // Time left until the deadline
  deadlinePassed: "Frist abgelaufen",
  timeLeftUnderMinute: "Noch <1 Min.",
  timeLeftHoursMinutes: "Noch {hours} Std. {minutes} Min.",
  timeLeftMinutes: "Noch {minutes} Min.",
  spokenUnderMinute: "Weniger als eine Minute übrig",
  spokenLeft: "Noch {time}",
  spokenHours_one: "{count} Stunde",
  spokenHours_other: "{count} Stunden",
  spokenMinutes_one: "{count} Minute",
  spokenMinutes_other: "{count} Minuten",
  spokenSeconds_one: "{count} Sekunde",
  spokenSeconds_other: "{count} Sekunden",

  // Amounts in an exercise unit
  goalReps_one: "{count} Wdh.",
  goalReps_other: "{count} Wdh.",
  goalSeconds_one: "{count} s",
  goalSeconds_other: "{count} s",

  // Hero card
  heroLoadingTitle: "Dein Einsatz wird geprüft…",
  heroGoalEyebrow: "Dein Ziel",
  heroGoalFallback: "Heutiges Ziel",
  start: "Los",
  viewCommitment: "Einsatz ansehen",
  atStake: "{amount} im Einsatz",
  verifyingEyebrow: "Fast geschafft",
  verifyingTitle: "Dein Workout wird geprüft…",
  verifyingBody: "Fitr prüft deine Wiederholungen und Live-Challenges noch einmal. Das dauert meist nur einen Moment.",
  verifiedTitle: "Ziel bestätigt",
  seeProgress: "Fortschritt ansehen",
  verifiedBodyWithGoal: "{goal}: erledigt und onchain. Dein Einsatz ist sicher. Bis morgen!",
  verifiedBody: "Erledigt und onchain. Dein Einsatz ist sicher. Bis morgen!",
  claimEyebrow: "Bereit zum Abholen",
  claimFallbackTitle: "Dein Einsatz ist zurück",
  claim: "Abholen",
  claimBody: "Du hast Wort gehalten. Hol dir deinen Einsatz und deinen Anteil.",
  missedEyebrow: "Ziel verpasst",
  missedTitle: "Morgen ist ein neuer Tag",
  commitAgain: "Neu einsetzen",
  missedBody: "Die Frist ist ohne bestätigtes Workout abgelaufen. Setz dir ein Ziel, das du schaffst.",
  revokedEyebrow: "In Prüfung",
  revokedTitle: "Bestätigung zurückgezogen",
  viewDetails: "Details ansehen",
  revokedBody:
    "Die Prüfung von Fitr hat die heutige Bestätigung zurückgezogen. Dein Einsatz verfällt nicht: Du kannst ihn nach Tagesende zurückholen (ohne Bonus).",
  trainFreeEyebrow: "Frei trainieren",
  pickWorkout: "Workout wählen",
  notSeekerTitle: "Einsätze brauchen ein Seeker",
  notSeekerBody: "Einsätze gibt es nur für Besitzer eines Solana Seeker. Alle Workouts und der Wdh.-Zähler gehören trotzdem dir.",
  pausedTitle: "Einsätze sind pausiert",
  pausedBody: "Einsätze sind gerade offline. Deine Workouts zählen trotzdem.",
  commitTitle: "Gib dein Wort",
  commit: "Einsetzen",
  commitBodyNoWallet: "Verbinde deine Wallet, wähl ein Ziel und setz SKR darauf, dass du heute trainierst.",
  commitBody: "Wähl ein Ziel und setz SKR darauf, dass du heute trainierst. Schaffst du es, bekommst du deinen Einsatz zurück.",

  // Commitment card
  commitmentCardTitle: "Täglicher $SKR-Einsatz",
  stepStakeTitle: "Einsetzen.",
  stepStakeBody: "Wähl dein Tagesziel und wie viel SKR du sperrst. Beides wird beim Einsetzen onchain festgelegt.",
  stepShowUpTitle: "Durchziehen.",
  stepShowUpBody:
    "Erreich dein Ziel: per Pose-Tracking auf dem Gerät gezählt und von Fitr nachgeprüft. Du bekommst deinen Einsatz zurück plus einen Anteil am Pool.",
  stepPayUpTitle: "Oder zahlen.",
  stepPayUpBody: "Verpasst du es, geht dein Einsatz an alle, die durchgezogen haben, abzüglich 5 % Gebühr.",
  currentStreak: "Aktuelle Streak",
  poolMultiplier: "Pool-Multiplikator",
  notAvailableYet: "Noch nicht verfügbar",
  commitToken: "{token} einsetzen",
  stakeNote: "Du wählst Ziel und Einsatz. Nichts wird gesperrt, bevor du in deiner Wallet signierst.",

  // Wallet row
  balanceUnavailable: "Guthaben nicht verfügbar",
  loadingBalance: "Guthaben lädt…",
  connectWallet: "Wallet verbinden",
  seeBalance: "Dein {token}-Guthaben ansehen",

  // Activity + quick start
  activityHeading: "Heutige Aktivität",
  nothingLoggedYet: "Heute noch nichts erfasst.",
  defaultGoalHit: "Standardziel erreicht",
  quickStartHeading: "Schnellstart",
  allWorkouts: "Alle Workouts",
};

export default today;
