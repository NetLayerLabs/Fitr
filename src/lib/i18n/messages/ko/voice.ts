import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "시작해요.",
  letsGoGoal: "시작해요. {goal}.",
  go: "시작.",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1회",
  goalReps_other: "{name} {count}회",
  goalMinutes: "{name} {count}분",
  goalSeconds: "{name} {count}초",
  goalReached: "목표 달성! {goal}.",
  // Durations while holding.
  seconds: "{count}초",
  minutes_one: "1분",
  minutes_other: "{count}분",
  minutesAndSeconds: "{minutes} {seconds}",
  // Rep milestones.
  repWithMilestone: "{count}. {milestone}",
  halfway: "절반 왔어요.",
  fiveLeft: "5개 남았어요.",
  lastOne: "마지막 하나.",
  // Form cues.
  rejected: "인정 안 됐어요. {cue}",
  issueBodyNotVisible: "몸이 다 보이게 뒤로 물러나세요.",
  issueUnstableTracking: "휴대폰을 고정하세요.",
  issueGoLower: "더 내려가세요.",
  issueExtendFully: "끝까지 펴세요.",
  issueHipsSagging: "엉덩이를 올리세요.",
  issueHipsPiked: "몸을 일직선으로.",
  issueBodyNotHorizontal: "자세를 잡으세요.",
  issueBodyOnFloor: "발끝으로 버티세요.",
  issueChestUp: "가슴을 펴세요.",
  issueTooFast: "천천히 하세요.",
  issueFaceCamera: "카메라를 정면으로 보세요.",
  issueTurnSideOn: "옆으로 서세요.",
  issueKeepBackOnWall: "등을 벽에 붙이세요.",
  issueKeepHipsHigh: "엉덩이를 높게.",
  issueChinOverBar: "턱을 바 위로.",
  issueGoHigher: "더 높이.",
  issueArmsOverhead: "손을 머리 위로.",
  issueJumpHigher: "더 높이 뛰세요.",
  phoneTilted: "휴대폰을 세워 주세요.",
  // Live checks.
  challengeRaiseRightHand: "오른손을 드세요!",
  challengeRaiseLeftHand: "왼손을 드세요!",
  challengeRaiseHand: "한 손을 드세요!",
  challengeHoldStillTop: "똑바로 서서 멈추세요!",
  challengeGeneric: "실시간 확인!",
  challengePassed: "좋아요.",
  // Toggling the coach.
  voiceCoachOn: "음성 코치 켜짐",
};

export default voice;
