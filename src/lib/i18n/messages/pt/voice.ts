import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "Vamos lá.",
  letsGoGoal: "Vamos lá. {goal}.",
  go: "Já.",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1 repetição",
  goalReps_other: "{count} {name}",
  goalMinutes: "{count} min de {name}",
  goalSeconds: "{count} segundos de {name}",
  goalReached: "Meta! {goal}.",
  // Durations while holding.
  seconds: "{count} segundos",
  minutes_one: "1 minuto",
  minutes_other: "{count} minutos",
  minutesAndSeconds: "{minutes} e {seconds}",
  // Rep milestones.
  repWithMilestone: "{count}. {milestone}",
  halfway: "Metade.",
  fiveLeft: "Faltam 5.",
  lastOne: "Última.",
  // Form cues.
  rejected: "Não contou. {cue}",
  issueBodyNotVisible: "Dê um passo para trás para eu te ver.",
  issueUnstableTracking: "Firme o celular.",
  issueGoLower: "Desça mais.",
  issueExtendFully: "Estique tudo.",
  issueHipsSagging: "Suba o quadril.",
  issueHipsPiked: "Alinhe o corpo.",
  issueBodyNotHorizontal: "Fique em posição.",
  issueBodyOnFloor: "Na ponta dos pés.",
  issueChestUp: "Peito para cima.",
  issueTooFast: "Mais devagar.",
  issueFaceCamera: "Fique de frente para a câmera.",
  issueTurnSideOn: "Fique de lado.",
  issueKeepBackOnWall: "Costas retas na parede.",
  issueKeepHipsHigh: "Quadril alto.",
  issueChinOverBar: "Queixo acima da barra.",
  issueGoHigher: "Suba mais.",
  issueArmsOverhead: "Mãos acima da cabeça.",
  issueJumpHigher: "Salte mais alto.",
  phoneTilted: "Deixe o celular em pé.",
  // Live checks.
  challengeRaiseRightHand: "Levante a mão direita!",
  challengeRaiseLeftHand: "Levante a mão esquerda!",
  challengeRaiseHand: "Levante uma mão!",
  challengeHoldStillTop: "Fique em pé e parado!",
  challengeGeneric: "Checagem ao vivo!",
  challengePassed: "Boa.",
  // Toggling the coach.
  voiceCoachOn: "Treinador de voz ligado",
};

export default voice;
