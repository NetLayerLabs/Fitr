import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "Da solo",
  unnamedCrew: "Squadra {suffix}",
  challengeFree: "Ognuno sceglie il proprio allenamento",
  challengeFixedGoal: "{goal} per tutti",
  challengeFixedExercise: "{exercise}, ognuno sceglie il proprio obiettivo",
  inviteShareText: "Entra nella mia squadra Fitr \"{name}\". {challenge}. Metti in gioco SKR sul fatto che ti alleni: chi non si presenta finanzia chi lo fa.",
  inviteShareTitle: "{name} su Fitr",

  // Page metadata
  metaTitle: "Squadra",
  metaDescription: "La tua squadra Fitr: la sfida di oggi, chi si è presentato, la serie della squadra e la classifica.",

  // Crew hub (Commit tab)
  yourCrewsTitle: "Le tue squadre",
  lookingForCrews: "Ricerca delle tue squadre…",
  crewsLoadError: "Impossibile caricare le tue squadre in questo momento. Riprova tra poco.",
  noCrewsYet: "Ancora nessuna squadra. Creane una qui sotto e condividi il link, oppure apri l'invito di un amico.",
  yoursTag: "Tua",
  joinTitle: "Entra in una squadra",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "Link di invito o numero della squadra",
  joinOpen: "Apri",
  joinInvalid: "Incolla un link di invito come fitr.day/c/123… o il numero della squadra.",

  // Create a crew
  createTitle: "Crea una squadra",
  createHint:
    "La tua squadra ha il suo pool: chi non si presenta finanzia i membri che si sono presentati. Se in un giorno non si presenta nessuno, le poste passano al giorno successivo in cui qualcuno lo fa.",
  crewNameLabel: "Nome della squadra",
  crewNamePlaceholder: "Mattinieri in movimento",
  crewNameEmpty: "Dai un nome alla tua squadra.",
  crewNameChars: "Usa solo lettere, numeri ed emoji.",
  crewNameTooLong: "Nome troppo lungo (massimo 32 byte).",
  sameExerciseToggle: "Tutti fanno lo stesso esercizio",
  sameGoalToggle: "Stesso obiettivo per tutti",
  createNeedsSol:
    "Creare una squadra richiede circa {needed} per il rent dell'account e la commissione di rete. Questo wallet ha {balance}.",
  createPaused: "La creazione di nuove squadre è in pausa per manutenzione.",
  working: "Elaborazione…",
  createButton: "Crea squadra",
  createFine:
    "Una firma · circa {rent} di rent dell'account (non rimborsabile). Creare una squadra non ti dà poteri speciali: le stesse regole onchain valgono per tutti.",
  createTimeout: "Il tuo wallet l'ha inviata, ma la rete non l'ha ancora confermata. Controlla l'explorer, poi aggiorna.",
  createFailedOnchain: "La creazione della squadra non è riuscita onchain. Ti è stata addebitata solo la commissione di rete.",
  vaultReadError: "Impossibile leggere il vault",

  // Commitments across pools
  commitmentsTodayTitle: "I tuoi impegni di oggi",
  goalFallback: "Obiettivo",
  forTomorrow: "domani",
  tagToDo: "Da fare",
  tagVerifying: "In verifica",
  tagVerified: "Verificato",
  tagClaim: "Riscuoti",
  tagMissed: "Mancato",
  tagWithdrawn: "Ritirato",
  tagCommitted: "Impegnato",

  // Crew page
  eyebrowCrew: "Squadra",
  eyebrowCommitTogether: "Impegnatevi insieme",
  loadingCrew: "Caricamento della squadra",
  notFoundTitle: "Squadra non trovata",
  notFoundBody: "Non abbiamo trovato questa squadra onchain. Controlla il link di invito; oppure lo staking potrebbe non essere ancora aperto.",
  goToCommit: "Vai a Impegno",
  unreachableTitle: "Impossibile raggiungere il vault",
  unreachableBody: "Non siamo riusciti a leggere questa squadra. Controlla la connessione e riprova.",
  tryAgain: "Riprova",
  connectToCommit: "Collega il wallet per impegnarti con la squadra. Ogni posta la firmi tu.",
  seekerOnly:
    "Lo staking è solo per Seeker: questo wallet non contiene un Seeker Genesis Token. Puoi comunque seguire la squadra e allenarti.",
  checkSeekerAgain: "Verifica di nuovo il mio Seeker",
  checkingSeeker: "Verifica del tuo Seeker…",
  deletedTitle: "Questa squadra è stata eliminata",
  deletedBody:
    "Chi l'ha creata l'ha rimossa da Fitr, quindi nessuno può più entrare o mettere in gioco qui. Se avevi una posta qui, puoi comunque riscuoterla qui sotto.",
  todaysChallenge: "La sfida di oggi",
  ownWorkoutOwnGoal: "Il tuo allenamento, il tuo obiettivo",
  sameGoalSentence: "Stesso obiettivo per tutti.",
  challengeSentence: "{challenge}.",
  challengeRules:
    "Chi non si presenta finanzia i membri della squadra che si sono presentati. Se non si presenta nessuno, le poste passano al successivo giorno di squadra completato da qualcuno.",
  statStreak: "Serie della squadra",
  statVerifiedToday: "Verificati oggi",
  statMembers: "Membri",
  todayTitle: "Oggi",
  dayLoadError: "Impossibile caricare la giornata della squadra. Si aggiorna da sola.",
  loading: "Caricamento…",
  nobodyCommitted: "Nessuno si è ancora impegnato oggi. Sii il primo, poi condividi il link.",
  you: "Tu",
  streakExplainer: "La serie della squadra conta i giorni in cui tutti quelli che si sono impegnati sono stati verificati.",
  streakExplainerBest: "La serie della squadra conta i giorni in cui tutti quelli che si sono impegnati sono stati verificati (record: {best}).",
  yourStakeTitle: "La tua posta",
  leaderboardTitle: "Classifica",
  leaderboardLabel: "Classifica della squadra",
  leaderboardEmpty: "La classifica si riempie dopo il primo giorno verificato.",
  leaderDays_one: "{count} giorno verificato · serie {streak}",
  leaderDays_other: "{count} giorni verificati · serie {streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "bonus",
  bonusExplainer:
    "Il bonus è quanto i membri hanno ricevuto oltre alla propria posta restituita, dai membri della squadra che hanno mancato l'obiettivo (Fitr trattiene una commissione del {fee}% solo sulle poste perse). Gli importi in {token} provengono dai profili onchain della squadra.",
  rolloverNote: "In riporto: {amount} dai giorni di squadra non completati da nessuno passa al prossimo giorno di squadra che qualcuno completa.",

  // Invite actions
  inviteButton: "Invita",
  copyButton: "Copia",
  copiedButton: "Copiato",
  copyInviteLink: "Copia link di invito",
  inviteLinkCopied: "Link di invito copiato",
  inviteLinkLabel: "Link di invito",

  // Delete crew
  deleteButton: "Elimina squadra",
  deleteConfirmTitle: "Eliminare {name}?",
  deleteConfirmBody:
    "Scompare da Fitr e il suo link di invito smette di funzionare. Nessuno potrà più entrare o mettere in gioco. Chi ha già una posta può comunque riscuoterla. Il tuo wallet firma un messaggio per dimostrare che l'hai creata tu: nessuna transazione, nessuna commissione.",
  keepIt: "Tienila",
  deleting: "Eliminazione…",
  deleteCancelled: "Annullato nel wallet. Non è cambiato niente.",
  deleteFailed: "Impossibile eliminare la squadra. Riprova.",
  deleteFailedStatus: "Impossibile eliminare la squadra ({status}).",
};

export default crews;
