import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "Los geht's.",
  letsGoGoal: "Los geht's. {goal}.",
  go: "Los.",
  // Goal phrases ({name} is the exercise name).
  goalReps_one: "Eine Wiederholung",
  goalReps_other: "{count} {name}",
  goalMinutes: "{count}-Minuten-{name}",
  goalSeconds: "{count}-Sekunden-{name}",
  goalReached: "Ziel! {goal}.",
  // Durations while holding.
  seconds: "{count} Sekunden",
  minutes_one: "Eine Minute",
  minutes_other: "{count} Minuten",
  minutesAndSeconds: "{minutes} {seconds}",
  // Rep milestones.
  repWithMilestone: "{count}. {milestone}",
  halfway: "Halbzeit.",
  fiveLeft: "Noch 5.",
  lastOne: "Letzte.",
  // Form cues.
  rejected: "Zählt nicht. {cue}",
  issueBodyNotVisible: "Geh zurück, damit ich dich sehe.",
  issueUnstableTracking: "Handy ruhig halten.",
  issueGoLower: "Tiefer.",
  issueExtendFully: "Ganz durchstrecken.",
  issueHipsSagging: "Hüfte hoch.",
  issueHipsPiked: "Körper gerade.",
  issueBodyNotHorizontal: "Geh in Position.",
  issueBodyOnFloor: "Auf die Zehen.",
  issueChestUp: "Brust raus.",
  issueTooFast: "Langsamer.",
  issueFaceCamera: "Schau zur Kamera.",
  issueTurnSideOn: "Dreh dich seitlich.",
  issueKeepBackOnWall: "Rücken flach an die Wand.",
  issueKeepHipsHigh: "Hüfte hoch.",
  issueChinOverBar: "Kinn über die Stange.",
  issueGoHigher: "Höher.",
  issueArmsOverhead: "Hände über den Kopf.",
  issueJumpHigher: "Höher springen.",
  phoneTilted: "Stell dein Handy aufrecht.",
  // Live checks.
  challengeRaiseRightHand: "Rechte Hand hoch!",
  challengeRaiseLeftHand: "Linke Hand hoch!",
  challengeRaiseHand: "Eine Hand hoch!",
  challengeHoldStillTop: "Aufrecht stehen und stillhalten!",
  challengeGeneric: "Live-Check!",
  challengePassed: "Gut.",
  // Toggling the coach.
  voiceCoachOn: "Sprachcoach an",
};

export default voice;
