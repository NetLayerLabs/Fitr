import type { NsMessages } from "../types";

const voice: Partial<NsMessages<"voice">> = {
  // Workout start and the ready countdown.
  letsGo: "开始吧。",
  letsGoGoal: "开始吧。目标{goal}。",
  go: "开始。",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1 次",
  goalReps_other: "{count} 个{name}",
  goalMinutes: "{name} {count} 分钟",
  goalSeconds: "{name} {count} 秒",
  goalReached: "达成目标！{goal}。",
  // Durations while holding.
  seconds: "{count} 秒",
  minutes_one: "1 分钟",
  minutes_other: "{count} 分钟",
  minutesAndSeconds: "{minutes}{seconds}",
  // Rep milestones.
  repWithMilestone: "{count}。{milestone}",
  halfway: "过半了。",
  fiveLeft: "还剩 5 个。",
  lastOne: "最后一个。",
  // Form cues.
  rejected: "不算。{cue}",
  issueBodyNotVisible: "往后退一点，让我看到你。",
  issueUnstableTracking: "把手机放稳。",
  issueGoLower: "再低一点。",
  issueExtendFully: "完全伸直。",
  issueHipsSagging: "臀部抬起来。",
  issueHipsPiked: "身体伸直。",
  issueBodyNotHorizontal: "摆好姿势。",
  issueBodyOnFloor: "脚尖撑起来。",
  issueChestUp: "挺胸。",
  issueTooFast: "慢一点。",
  issueFaceCamera: "面向摄像头。",
  issueTurnSideOn: "侧过身来。",
  issueKeepBackOnWall: "背贴紧墙。",
  issueKeepHipsHigh: "臀部抬高。",
  issueChinOverBar: "下巴过杠。",
  issueGoHigher: "再高一点。",
  issueArmsOverhead: "双手举过头顶。",
  issueJumpHigher: "跳高一点。",
  phoneTilted: "把手机竖起来。",
  // Live checks.
  challengeRaiseRightHand: "举起右手！",
  challengeRaiseLeftHand: "举起左手！",
  challengeRaiseHand: "举起一只手！",
  challengeHoldStillTop: "站直，保持不动！",
  challengeGeneric: "实时检查！",
  challengePassed: "很好。",
  // Toggling the coach.
  voiceCoachOn: "语音教练已开启",
};

export default voice;
