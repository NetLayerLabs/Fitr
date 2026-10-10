import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "今日",
  greetingMorning: "早上好",
  greetingAfternoon: "下午好",
  greetingEvening: "晚上好",
  dayStreak: "天连续打卡",
  dayUnit_one: "天",
  dayUnit_other: "天",

  // Time left until the deadline
  deadlinePassed: "已过截止时间",
  timeLeftUnderMinute: "剩余不到 1 分钟",
  timeLeftHoursMinutes: "剩余 {hours} 小时 {minutes} 分",
  timeLeftMinutes: "剩余 {minutes} 分钟",
  spokenUnderMinute: "剩余不到一分钟",
  spokenLeft: "还剩 {time}",
  spokenHours_one: "{count} 小时",
  spokenHours_other: "{count} 小时",
  spokenMinutes_one: "{count} 分钟",
  spokenMinutes_other: "{count} 分钟",
  spokenSeconds_one: "{count} 秒",
  spokenSeconds_other: "{count} 秒",

  // Amounts in an exercise unit
  goalReps_one: "{count} 次",
  goalReps_other: "{count} 次",
  goalSeconds_one: "{count} 秒",
  goalSeconds_other: "{count} 秒",

  // Hero card
  heroLoadingTitle: "正在查询你的承诺…",
  heroGoalEyebrow: "你的目标",
  heroGoalFallback: "今日目标",
  start: "开始",
  viewCommitment: "查看承诺",
  atStake: "已质押 {amount}",
  verifyingEyebrow: "马上就好",
  verifyingTitle: "正在验证你的训练…",
  verifyingBody: "Fitr 正在复核你的动作次数和实时挑战，通常只需片刻。",
  verifiedTitle: "目标已验证",
  seeProgress: "查看进度",
  verifiedBodyWithGoal: "{goal}，已完成并记录上链。你的质押安全无虞，明天见。",
  verifiedBody: "已完成并记录上链。你的质押安全无虞，明天见。",
  claimEyebrow: "可以领取",
  claimFallbackTitle: "你的质押已返还",
  claim: "领取",
  claimBody: "你说到做到。领取你的质押和你应得的份额。",
  missedEyebrow: "未完成目标",
  missedTitle: "明天又是新的一天",
  commitAgain: "再次承诺",
  missedBody: "截止前未完成经验证的训练。设一个你能坚持的目标吧。",
  revokedEyebrow: "审核中",
  revokedTitle: "验证已撤回",
  viewDetails: "查看详情",
  revokedBody:
    "Fitr 审核后撤回了今天的验证。你的质押不会被没收：当天结算后可以领回（无奖励）。",
  trainFreeEyebrow: "免费训练",
  pickWorkout: "选择训练",
  notSeekerTitle: "承诺功能需要 Seeker",
  notSeekerBody: "质押仅限 Solana Seeker 用户。所有训练和计数功能你仍可随意使用。",
  pausedTitle: "承诺功能已暂停",
  pausedBody: "质押暂时不可用，你的训练照样记录。",
  commitTitle: "许下你的承诺",
  commit: "承诺",
  commitBodyNoWallet: "连接钱包，选个目标，质押 SKR，承诺今天一定到场。",
  commitBody: "选个目标，质押 SKR，承诺今天一定到场。完成目标，质押即可返还。",

  // Commitment card
  commitmentCardTitle: "每日 $SKR 承诺",
  stepStakeTitle: "质押。",
  stepStakeBody: "选择每日目标和要锁定的 SKR 数量。承诺时两者都会在链上锁定。",
  stepShowUpTitle: "到场。",
  stepShowUpBody:
    "完成目标：由设备端姿态识别计数，再经 Fitr 验证服务复核。质押全额返还，并分得资金池的一份。",
  stepPayUpTitle: "否则就认罚。",
  stepPayUpBody: "没完成的话，你的质押将分给按时完成的人（扣除 5% 手续费）。",
  currentStreak: "当前连续",
  poolMultiplier: "资金池倍数",
  notAvailableYet: "暂未开放",
  commitToken: "承诺 {token}",
  stakeNote: "目标和质押金额由你决定。在钱包中签名之前，不会质押任何资产。",

  // Wallet row
  balanceUnavailable: "无法获取余额",
  loadingBalance: "正在加载余额…",
  connectWallet: "连接钱包",
  seeBalance: "查看你的 {token} 余额",

  // Activity + quick start
  activityHeading: "今日动态",
  nothingLoggedYet: "今天还没有记录。",
  defaultGoalHit: "已达成默认目标",
  quickStartHeading: "快速开始",
  allWorkouts: "全部训练",
  heroGoalTomorrowEyebrow: "明日目标",
  practiceNow: "现在练习",
  countsFrom: "{time} 起计入",
};

export default today;
