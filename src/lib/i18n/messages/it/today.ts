import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "Oggi",
  greetingMorning: "Buongiorno",
  greetingAfternoon: "Buon pomeriggio",
  greetingEvening: "Buonasera",
  dayStreak: "giorni di fila",
  dayUnit_one: "giorno",
  dayUnit_other: "giorni",

  // Time left until the deadline
  deadlinePassed: "Scadenza superata",
  timeLeftUnderMinute: "Meno di 1m",
  timeLeftHoursMinutes: "Ancora {hours}h {minutes}m",
  timeLeftMinutes: "Ancora {minutes}m",
  spokenUnderMinute: "Manca meno di un minuto",
  spokenLeft: "Ancora {time}",
  spokenHours_one: "{count} ora",
  spokenHours_other: "{count} ore",
  spokenMinutes_one: "{count} minuto",
  spokenMinutes_other: "{count} minuti",
  spokenSeconds_one: "{count} secondo",
  spokenSeconds_other: "{count} secondi",

  // Amounts in an exercise unit
  goalReps_one: "{count} rip.",
  goalReps_other: "{count} rip.",
  goalSeconds_one: "{count} s",
  goalSeconds_other: "{count} s",

  // Hero card
  heroLoadingTitle: "Controllo del tuo impegno…",
  heroGoalEyebrow: "Il tuo obiettivo",
  heroGoalFallback: "Obiettivo di oggi",
  start: "Inizia",
  viewCommitment: "Vedi impegno",
  atStake: "{amount} in gioco",
  verifyingEyebrow: "Ci siamo quasi",
  verifyingTitle: "Verifica dell'allenamento…",
  verifyingBody: "Fitr sta ricontrollando le tue ripetizioni e i controlli live. Di solito ci vuole un attimo.",
  verifiedTitle: "Obiettivo verificato",
  seeProgress: "Vedi progressi",
  verifiedBodyWithGoal: "{goal}: fatto e registrato onchain. La tua posta è al sicuro. Torna domani.",
  verifiedBody: "Fatto e registrato onchain. La tua posta è al sicuro. Torna domani.",
  claimEyebrow: "Pronto da riscuotere",
  claimFallbackTitle: "La tua posta è tornata",
  claim: "Riscuoti",
  claimBody: "Hai mantenuto la parola. Riscuoti la tua posta e la tua quota.",
  missedEyebrow: "Obiettivo mancato",
  missedTitle: "Domani è un altro giorno",
  commitAgain: "Impegnati di nuovo",
  missedBody: "La scadenza è passata senza un allenamento verificato. Scegli un obiettivo che riesci a mantenere.",
  revokedEyebrow: "In revisione",
  revokedTitle: "Verifica ritirata",
  viewDetails: "Vedi dettagli",
  revokedBody:
    "La revisione di Fitr ha ritirato la verifica di oggi. Non perdi la tua posta: puoi riscuoterla (senza bonus) a giornata chiusa.",
  trainFreeEyebrow: "Allenati gratis",
  pickWorkout: "Scegli un allenamento",
  notSeekerTitle: "Gli impegni richiedono un Seeker",
  notSeekerBody: "Lo staking è riservato a chi ha un Solana Seeker. Tutti gli allenamenti e il conteggio delle ripetizioni restano tuoi.",
  pausedTitle: "Gli impegni sono in pausa",
  pausedBody: "Lo staking al momento non è attivo. I tuoi allenamenti contano comunque.",
  commitTitle: "Metti in gioco la tua parola",
  commit: "Impegnati",
  commitBodyNoWallet: "Collega il wallet, scegli un obiettivo e metti in gioco SKR sul fatto che oggi ti alleni.",
  commitBody: "Scegli un obiettivo e metti in gioco SKR sul fatto che oggi ti alleni. Raggiungilo e la tua posta torna indietro.",

  // Commitment card
  commitmentCardTitle: "Impegno giornaliero in $SKR",
  stepStakeTitle: "Metti in gioco.",
  stepStakeBody: "Scegli il tuo obiettivo giornaliero e quanti SKR bloccare. Entrambi vengono fissati onchain quando ti impegni.",
  stepShowUpTitle: "Presentati.",
  stepShowUpBody:
    "Raggiungi l'obiettivo, contato sul dispositivo dal rilevamento della postura e ricontrollato dal verificatore di Fitr. La tua posta torna indietro, più una quota del pool.",
  stepPayUpTitle: "Oppure paghi.",
  stepPayUpBody: "Se lo manchi, la tua posta va a chi si è presentato, meno una commissione del 5%.",
  currentStreak: "Serie attuale",
  poolMultiplier: "Moltiplicatore del pool",
  notAvailableYet: "Non ancora disponibile",
  commitToken: "Impegna {token}",
  stakeNote: "Scegli tu l'obiettivo e la posta. Niente viene bloccato finché non firmi nel tuo wallet.",

  // Wallet row
  balanceUnavailable: "Saldo non disponibile",
  loadingBalance: "Caricamento saldo…",
  connectWallet: "Collega wallet",
  seeBalance: "Vedi il tuo saldo {token}",

  // Activity + quick start
  activityHeading: "Attività di oggi",
  nothingLoggedYet: "Ancora niente registrato oggi.",
  defaultGoalHit: "Obiettivo base raggiunto",
  quickStartHeading: "Avvio rapido",
  allWorkouts: "Tutti gli allenamenti",
};

export default today;
