import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "さあ、始めよう。",
  letsGoGoal: "さあ、始めよう。{goal}。",
  go: "スタート。",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1回",
  goalReps_other: "{name}{count}回",
  goalMinutes: "{name}{count}分",
  goalSeconds: "{name}{count}秒",
  goalReached: "目標達成！{goal}。",
  // Durations while holding.
  seconds: "{count}秒",
  minutes_one: "1分",
  minutes_other: "{count}分",
  minutesAndSeconds: "{minutes}{seconds}",
  // Rep milestones.
  repWithMilestone: "{count}。{milestone}",
  halfway: "半分。",
  fiveLeft: "あと5回。",
  lastOne: "ラスト1回。",
  // Form cues.
  rejected: "カウントなし。{cue}",
  issueBodyNotVisible: "全身が見えるように下がって。",
  issueUnstableTracking: "スマホを固定して。",
  issueGoLower: "もっと深く。",
  issueExtendFully: "伸ばし切って。",
  issueHipsSagging: "腰を上げて。",
  issueHipsPiked: "体をまっすぐに。",
  issueBodyNotHorizontal: "姿勢を整えて。",
  issueBodyOnFloor: "つま先で体を支えて。",
  issueChestUp: "胸を張って。",
  issueTooFast: "ゆっくり。",
  issueFaceCamera: "カメラの方を向いて。",
  issueTurnSideOn: "横向きになって。",
  issueKeepBackOnWall: "背中を壁につけて。",
  issueKeepHipsHigh: "お尻を高く。",
  issueChinOverBar: "あごをバーの上へ。",
  issueGoHigher: "もっと高く。",
  issueArmsOverhead: "手を頭の上へ。",
  issueJumpHigher: "もっと高く跳んで。",
  phoneTilted: "スマホをまっすぐ立てて。",
  // Live checks.
  challengeRaiseRightHand: "右手を上げて！",
  challengeRaiseLeftHand: "左手を上げて！",
  challengeRaiseHand: "手を上げて！",
  challengeHoldStillTop: "まっすぐ立って、止まって！",
  challengeGeneric: "ライブチェック！",
  challengePassed: "いいね。",
  // Toggling the coach.
  voiceCoachOn: "音声コーチ オン",
};

export default voice;
