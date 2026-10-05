import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "¡Vamos!",
  letsGoGoal: "¡Vamos! {goal}.",
  go: "¡Ya!",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1 repetición",
  goalReps_other: "{count} {name}",
  goalMinutes: "{name}, {count} min",
  goalSeconds: "{name}, {count} segundos",
  goalReached: "¡Meta! {goal}.",
  // Durations while holding.
  seconds: "{count} segundos",
  minutes_one: "1 minuto",
  minutes_other: "{count} minutos",
  minutesAndSeconds: "{minutes} y {seconds}",
  // Rep milestones.
  repWithMilestone: "{count}. {milestone}",
  halfway: "A la mitad.",
  fiveLeft: "Quedan 5.",
  lastOne: "¡La última!",
  // Form cues.
  rejected: "No cuenta. {cue}",
  issueBodyNotVisible: "Aléjate para que te vea.",
  issueUnstableTracking: "Estabiliza el teléfono.",
  issueGoLower: "Baja más.",
  issueExtendFully: "Extiende del todo.",
  issueHipsSagging: "Sube la cadera.",
  issueHipsPiked: "Endereza el cuerpo.",
  issueBodyNotHorizontal: "Ponte en posición.",
  issueBodyOnFloor: "Arriba, sobre las puntas.",
  issueChestUp: "Pecho arriba.",
  issueTooFast: "Más despacio.",
  issueFaceCamera: "Mira a la cámara.",
  issueTurnSideOn: "Ponte de lado.",
  issueKeepBackOnWall: "Espalda pegada a la pared.",
  issueKeepHipsHigh: "Cadera alta.",
  issueChinOverBar: "Barbilla sobre la barra.",
  issueGoHigher: "Sube más.",
  issueArmsOverhead: "Manos arriba.",
  issueJumpHigher: "Salta más alto.",
  phoneTilted: "Pon el teléfono en vertical.",
  // Live checks.
  challengeRaiseRightHand: "¡Levanta la mano derecha!",
  challengeRaiseLeftHand: "¡Levanta la mano izquierda!",
  challengeRaiseHand: "¡Levanta una mano!",
  challengeHoldStillTop: "¡Ponte recto y quédate quieto!",
  challengeGeneric: "¡Control en vivo!",
  challengePassed: "Bien.",
  // Toggling the coach.
  voiceCoachOn: "Entrenador de voz activado",
};

export default voice;
