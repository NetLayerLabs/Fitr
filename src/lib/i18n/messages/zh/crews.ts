import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "个人",
  unnamedCrew: "小队 {suffix}",
  challengeFree: "每人自选训练",
  challengeFixedGoal: "所有人：{goal}",
  challengeFixedExercise: "{exercise}，每人自定目标",
  inviteShareText: "加入我的 Fitr 小队“{name}”。{challenge}。质押 SKR，承诺到场：缺席者的质押归到场的人。",
  inviteShareTitle: "Fitr 上的{name}",

  // Page metadata
  metaTitle: "小队",
  metaDescription: "你的 Fitr 小队：今日挑战、谁到场了、小队连续打卡和排行榜。",

  // Crew hub (Commit tab)
  yourCrewsTitle: "你的小队",
  lookingForCrews: "正在查找你的小队…",
  crewsLoadError: "暂时无法加载你的小队，请稍后再试。",
  noCrewsYet: "还没有小队。在下方创建一个并分享链接，或打开朋友发来的邀请。",
  yoursTag: "你创建的",
  joinTitle: "加入小队",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "邀请链接或小队编号",
  joinOpen: "打开",
  joinInvalid: "请粘贴类似 fitr.day/c/123… 的邀请链接或小队编号。",

  // Create a crew
  createTitle: "创建小队",
  createHint:
    "你的小队有自己的资金池：缺席者的质押归到场的成员。如果某天没有人到场，质押会顺延到下一个有人完成的日子。",
  crewNameLabel: "小队名称",
  crewNamePlaceholder: "晨练小分队",
  crewNameEmpty: "给你的小队起个名字。",
  crewNameChars: "只能使用字母、数字和 emoji。",
  crewNameTooLong: "名称太长（最多 32 字节）。",
  sameExerciseToggle: "所有人做同一个动作",
  sameGoalToggle: "所有人目标相同",
  createNeedsSol:
    "创建小队需要约 {needed} 用于账户租金和网络手续费。此钱包有 {balance}。",
  createPaused: "新建小队因维护暂停。",
  working: "处理中…",
  createButton: "创建小队",
  createFine:
    "签名一次 · 约 {rent} 账户租金（不退还）。创建者对小队没有任何特殊权限：所有人遵守相同的链上规则。",
  createTimeout: "钱包已发送，但网络尚未确认。请在区块浏览器中查看后刷新。",
  createFailedOnchain: "创建小队在链上失败。除网络手续费外未扣除任何费用。",
  vaultReadError: "无法读取金库",

  // Commitments across pools
  commitmentsTodayTitle: "你今天的承诺",
  goalFallback: "目标",
  forTomorrow: "明天",
  tagToDo: "待完成",
  tagVerifying: "验证中",
  tagVerified: "已验证",
  tagClaim: "领取",
  tagMissed: "未完成",
  tagWithdrawn: "已撤回",
  tagCommitted: "已承诺",

  // Crew page
  eyebrowCrew: "小队",
  eyebrowCommitTogether: "一起承诺",
  loadingCrew: "正在加载小队",
  notFoundTitle: "找不到小队",
  notFoundBody: "在链上找不到这个小队。请检查邀请链接，也可能质押尚未开放。",
  goToCommit: "前往承诺",
  unreachableTitle: "无法连接金库",
  unreachableBody: "无法读取这个小队。请检查网络连接后重试。",
  tryAgain: "重试",
  connectToCommit: "连接钱包，与小队一起承诺。每一笔质押都由你亲自签名。",
  seekerOnly:
    "质押仅限 Seeker：此钱包未持有 Seeker Genesis Token。你仍可关注小队并参与训练。",
  checkSeekerAgain: "重新检查我的 Seeker",
  checkingSeeker: "正在检查你的 Seeker…",
  deletedTitle: "该小队已被删除",
  deletedBody:
    "创建者已将其从 Fitr 移除，任何人都无法再加入或质押。如果你在这里质押过，仍可在下方领取。",
  todaysChallenge: "今日挑战",
  ownWorkoutOwnGoal: "自选训练，自定目标",
  sameGoalSentence: "所有人目标相同。",
  challengeSentence: "{challenge}。",
  challengeRules:
    "缺席者的质押归到场的小队成员。如果没有人到场，质押会顺延到下一个有人完成的小队日。",
  statStreak: "小队连续",
  statVerifiedToday: "今日已验证",
  statMembers: "成员",
  todayTitle: "今天",
  dayLoadError: "无法加载小队今日数据，稍后会自动刷新。",
  loading: "加载中…",
  nobodyCommitted: "今天还没有人承诺。做第一个，然后分享链接吧。",
  you: "你",
  streakExplainer: "小队连续天数：当天所有承诺的成员都通过验证才算一天。",
  streakExplainerBest: "小队连续天数：当天所有承诺的成员都通过验证才算一天（最佳：{best}）。",
  yourStakeTitle: "你的质押",
  leaderboardTitle: "排行榜",
  leaderboardLabel: "小队排行榜",
  leaderboardEmpty: "第一个验证日之后，排行榜就会有数据。",
  leaderDays_one: "已验证 {count} 天 · 连续 {streak}",
  leaderDays_other: "已验证 {count} 天 · 连续 {streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "奖励",
  bonusExplainer:
    "奖励是成员在取回自己质押之外，从未完成的小队成员那里分得的部分（Fitr 仅从没收部分收取 {fee}% 手续费）。{token} 金额来自小队的链上记录。",
  rolloverNote: "顺延中：无人完成的小队日累积的 {amount} 将归入下一个有人完成的小队日。",

  // Invite actions
  inviteButton: "邀请",
  copyButton: "复制",
  copiedButton: "已复制",
  copyInviteLink: "复制邀请链接",
  inviteLinkCopied: "邀请链接已复制",
  inviteLinkLabel: "邀请链接",

  // Delete crew
  deleteButton: "删除小队",
  deleteConfirmTitle: "删除{name}？",
  deleteConfirmBody:
    "小队将从 Fitr 消失，邀请链接也会失效。任何人都无法再加入或质押。已质押的人仍可领取。你的钱包会签署一条消息来证明你是创建者：无需交易，无手续费。",
  keepIt: "保留",
  deleting: "删除中…",
  deleteCancelled: "已在钱包中取消，没有任何变更。",
  deleteFailed: "无法删除小队。请重试。",
  deleteFailedStatus: "无法删除小队（{status}）。",
};

export default crews;
