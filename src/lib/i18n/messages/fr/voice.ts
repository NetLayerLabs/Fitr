import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "C’est parti.",
  letsGoGoal: "C’est parti. {goal}.",
  go: "Go.",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1 répétition",
  goalReps_other: "{count} {name}",
  goalMinutes: "{count} minute de {name}",
  goalSeconds: "{count} secondes de {name}",
  goalReached: "Objectif atteint ! {goal}.",
  // Durations while holding.
  seconds: "{count} secondes",
  minutes_one: "1 minute",
  minutes_other: "{count} minutes",
  minutesAndSeconds: "{minutes} et {seconds}",
  // Rep milestones.
  repWithMilestone: "{count}. {milestone}",
  halfway: "À mi-chemin.",
  fiveLeft: "Encore 5.",
  lastOne: "Dernière.",
  // Form cues.
  rejected: "Pas comptée. {cue}",
  issueBodyNotVisible: "Recule, je ne te vois pas.",
  issueUnstableTracking: "Stabilise le téléphone.",
  issueGoLower: "Descends plus bas.",
  issueExtendFully: "Va au bout du mouvement.",
  issueHipsSagging: "Monte les hanches.",
  issueHipsPiked: "Aligne ton corps.",
  issueBodyNotHorizontal: "Mets-toi en position.",
  issueBodyOnFloor: "Sur la pointe des pieds.",
  issueChestUp: "Poitrine haute.",
  issueTooFast: "Ralentis.",
  issueFaceCamera: "Face à la caméra.",
  issueTurnSideOn: "Mets-toi de profil.",
  issueKeepBackOnWall: "Dos plaqué au mur.",
  issueKeepHipsHigh: "Hanches hautes.",
  issueChinOverBar: "Menton au-dessus de la barre.",
  issueGoHigher: "Monte plus haut.",
  issueArmsOverhead: "Mains au-dessus de la tête.",
  issueJumpHigher: "Saute plus haut.",
  phoneTilted: "Redresse ton téléphone.",
  // Live checks.
  challengeRaiseRightHand: "Lève la main droite !",
  challengeRaiseLeftHand: "Lève la main gauche !",
  challengeRaiseHand: "Lève une main !",
  challengeHoldStillTop: "Tiens-toi droit, ne bouge plus !",
  challengeGeneric: "Vérification en direct !",
  challengePassed: "Bien.",
  // Toggling the coach.
  voiceCoachOn: "Coach vocal activé",
};

export default voice;
