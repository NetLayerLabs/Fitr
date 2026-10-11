import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "Andiamo.",
  letsGoGoal: "Andiamo. {goal}.",
  go: "Via.",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1 ripetizione",
  goalReps_other: "{count} {name}",
  goalMinutes: "{count} min di {name}",
  goalSeconds: "{count} secondi di {name}",
  goalReached: "Obiettivo! {goal}.",
  // Durations while holding.
  seconds: "{count} secondi",
  minutes_one: "1 minuto",
  minutes_other: "{count} minuti",
  minutesAndSeconds: "{minutes} e {seconds}",
  // Rep milestones.
  repWithMilestone: "{count}. {milestone}",
  halfway: "A metà.",
  fiveLeft: "Ancora 5.",
  lastOne: "L'ultima.",
  // Form cues.
  rejected: "Non valida. {cue}",
  issueBodyNotVisible: "Allontanati, così ti vedo.",
  issueUnstableTracking: "Tieni fermo il telefono.",
  issueGoLower: "Scendi di più.",
  issueExtendFully: "Distendi bene.",
  issueHipsSagging: "Alza il bacino.",
  issueHipsPiked: "Allinea il corpo.",
  issueBodyNotHorizontal: "Mettiti in posizione.",
  issueBodyOnFloor: "Sulle punte dei piedi.",
  issueChestUp: "Petto in fuori.",
  issueTooFast: "Più lento.",
  issueFaceCamera: "Guarda la fotocamera.",
  issueTurnSideOn: "Girati di lato.",
  issueKeepBackOnWall: "Schiena contro il muro.",
  issueKeepHipsHigh: "Bacino alto.",
  issueChinOverBar: "Mento sopra la sbarra.",
  issueGoHigher: "Più in alto.",
  issueArmsOverhead: "Mani sopra la testa.",
  issueJumpHigher: "Salta più in alto.",
  phoneTilted: "Metti il telefono in verticale.",
  // Live checks.
  challengeRaiseRightHand: "Alza la mano destra!",
  challengeRaiseLeftHand: "Alza la mano sinistra!",
  challengeRaiseHand: "Alza una mano!",
  challengeHoldStillTop: "In piedi e resta fermo!",
  challengeGeneric: "Controllo live!",
  challengePassed: "Bene.",
  // Toggling the coach.
  voiceCoachOn: "Coach vocale attivo",
  letsGoGoalStaked: "Via. {goal}. Attento ai controlli live: eseguili subito.",
  goalReachedStaked: "Obiettivo! {goal}. Tocca Fine per la verifica onchain, o continua.",
};

export default voice;
