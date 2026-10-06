import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "语言",
  languageHint: "更改应用内所有页面的语言",

  // You tab page
  pageTitle: "我的",
  pageDescription: "你的钱包、Seeker 状态、设置，以及 Fitr 如何验证训练和处理你的数据。",
  walletHeading: "钱包",
  settingsHeading: "设置",
  aboutHeading: "关于 Fitr",

  // Profile header
  profileLabel: "个人资料",
  changePhoto: "更换头像",
  addPhoto: "添加头像",
  photoNotImage: "请选择图片文件。",
  photoTooLarge: "图片太大。",
  namePlaceholder: "你的名字",
  saveName: "保存名字",
  addName: "添加名字",
  editName: "编辑名字",
  adjustPhotoTitle: "调整照片",
  photoMenuTitle: "头像",
  chooseNewPhoto: "选择新照片",
  removePhoto: "移除照片",
  photoStaysOnDevice: "你的照片只保存在本设备上，不会上传。",

  // Avatar crop editor
  cropOpenFailed: "无法打开该图片。请尝试 JPEG 或 PNG 格式。",
  cropProcessFailed: "无法处理该图片。",
  cropClose: "关闭",
  cropLoading: "正在加载照片…",
  cropViewportLabel: "照片取景。拖动或使用方向键移动，双指捏合或使用加减键缩放。",
  cropZoom: "缩放",
  cropHint: "拖动调整位置。双指捏合或使用滑块缩放。",
  cropCancel: "取消",
  cropSave: "保存照片",

  // Settings
  remindersTitle: "打卡提醒",
  remindersOff: "已关闭。Fitr 不会在质押截止前提醒你。",
  remindersBlocked: "Fitr 的通知已被禁止。点击开关打开 Android 设置。",
  remindersAllow: "允许通知，Fitr 才能在截止前提醒你。",
  remindersOn: "质押截止前 2 小时提醒一次，截止前 30 分钟再最后提醒一次。",
  cameraTitle: "默认摄像头",
  cameraHint: "训练开始时使用的摄像头。在训练页面仍可切换。",
  cameraFront: "前置",
  cameraBack: "后置",
  hapticsTitle: "触感反馈",
  hapticsHint: "每计入一次以及达成目标时，轻轻振动一下。",
  voiceCoachTitle: "语音教练",
  voiceCoachHint: "大声报数，并播报动作提示和实时检查，让你无需看屏幕。",
  formGuidesTitle: "动作指南",
  formGuidesAllShown: "每个动作开始前都会显示动作指南。",
  formGuidesHidden_one: "已为 {count} 个动作隐藏。",
  formGuidesHidden_other: "已为 {count} 个动作隐藏。",
  formGuidesShowAll: "重新显示所有动作指南",

  // About links
  websiteTitle: "Fitr 官网",
  websiteHint: "fitr.day · 分享给朋友",
  opensInBrowser: "（在浏览器中打开）",
  verificationLinkTitle: "验证机制说明",
  verificationLinkHint: "Fitr 能检查什么，不能检查什么",
  privacyLinkTitle: "隐私",
  privacyLinkHint: "你的视频绝不会离开你的手机",
  creditsLinkTitle: "致谢与许可",
  creditsLinkHint: "我们所依托的开源软件",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "信任",
  verificationTitle: "验证机制说明",
  verificationDescription:
    "质押日计入前 Fitr 会检查什么，区块链强制执行什么，以及你需要信任什么。",
  verificationLead:
    "Fitr 的设计目标是难以作弊，而不是绝对无法作弊。下面详细说明检查了什么、由谁检查，以及你需要信任什么。",
  verificationPhoneHeading: "1. 你的手机负责计数",
  verificationPhoneBody:
    "设备端姿态 AI 在每一帧画面中识别 33 个身体关键点，只有当关节完成完整动作幅度时才计为一次（例如俯卧撑时肘部弯曲超过 90°）。半程动作会显示为“未计入”。这一切完全在你的手机上运行。",
  verificationServerHeading: "2. 质押训练由 Fitr 服务器再次检查",
  verificationServerIntro:
    "当涉及资金时，你的手机还会在训练过程中将骨骼关键点（绝不是视频）发送给 Fitr 的验证服务器。服务器会：",
  verificationServerRecount:
    "用同一套计数引擎自行重新计数每一次动作，绝不只听手机的一面之词；",
  verificationServerChallengesBefore: "在随机时刻给出",
  verificationServerChallengesStrong: "实时挑战",
  verificationServerChallengesAfter:
    "，例如“举起右手”，预先录制的视频不可能提前知道；",
  verificationServerPlausible:
    "检查动作在物理上是否合理：骨骼长度保持不变、关节不会瞬移、节奏符合人类水平；",
  verificationServerTiming: "用自己的时钟核对时间，并拒绝已提交过的训练。",
  verificationServerOutro: "只有全部通过，服务器才会在链上将你的当天标记为完成。",
  verificationChainHeading: "3. 区块链强制执行资金规则",
  verificationChainBody:
    "你的质押存放在 Solana 上的链上金库程序中，而不是由 Fitr 保管。程序强制执行截止时间、每个钱包每天一份承诺、返还计算（取回你的质押，加上按比例分得的没收质押，只从没收部分扣除 5% 手续费），并防止重复领取。Fitr 无法把你的质押转给自己；如果某天被作废，所有人都会获得退款。",
  verificationTrustHeading: "你需要信任什么",
  verificationTrustBody:
    "区块链看不到你的训练，所以你需要信任 Fitr 的服务器会公正判定：你完成了就标记为完成，没完成的人不会被标记。每次判定都附带所判定训练的指纹，因此可以审计。",
  verificationLimitsBody:
    "没有任何基于摄像头的系统是骗不过的。一个铁了心的作弊者，用修改过的应用或以假乱真的替身，也许能蒙混过关。上述检查的目的，是让作弊变得困难、耗时，且得不偿失。",

  // Privacy doc
  privacyEyebrow: "你的数据",
  privacyTitle: "隐私",
  privacyDescription: "你的视频绝不会离开你的手机。Fitr 存储什么、发送什么、何时发送。",
  privacyLeadStrong: "你的摄像头视频绝不会离开你的手机。",
  privacyLeadRest: "视频在设备上逐帧分析，从不录制或上传。",
  privacyFreeHeading: "免费训练",
  privacyFreeBody:
    "训练相关的任何信息都不会发送到任何地方。你的历史记录、连续打卡、纪录和奖章只保存在这部手机上的本应用中。在“进度”页清除历史记录即可删除。",
  privacyStakedHeading: "质押训练",
  privacyStakedBody:
    "为验证质押日，你的手机会把本次训练的骨骼关键点发送给 Fitr 的验证服务器：即 33 个身体关节随时间变化的位置，以及你对实时挑战的响应。没有视频、图片或音频。服务器用这些数据检查你的动作次数，并保留训练指纹，防止同一次训练被重复提交。",
  privacyWalletHeading: "你的钱包",
  privacyWalletBody:
    "连接钱包时，Fitr 会看到你的公开钱包地址，用于显示余额和 Seeker 状态。你的私钥始终留在钱包中，每一笔交易都需要你批准。质押、完成记录和返还都记录在公开的 Solana 区块链上。",
  privacyThirdPartiesHeading: "第三方",
  privacyThirdPartiesBody:
    "设备端姿态 AI（Google MediaPipe）可能会向 Google 发送关于该库本身的匿名使用统计数据，其中不包含视频、图片或身体关键点。",
  privacySettingsHeading: "设置",
  privacySettingsBody: "你的摄像头、触感反馈和动作指南偏好只保存在这部手机上。",

  // Credits doc
  creditsEyebrow: "致谢",
  creditsTitle: "致谢与许可",
  creditsDescription: "Fitr 所使用的开源软件、字体和媒体素材。",
  creditsIntro: "Fitr 基于开源软件构建。感谢所有为之付出的人。",
  creditsClipsHeading: "动作指南视频",
  creditsClipLabel: "{exercise}示范：{author}",

  // Root layout
  skipToContent: "跳到主要内容",
  appDescription:
    "Fitr 通过设备端 AI 姿态识别为你的俯卧撑、深蹲和平板支撑计数。每一次动作都通过关节角度检查，视频绝不会离开你的手机。",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "还剩 {left}：{goal}",
  nativeReminderTitle: "还剩 {left} 打卡",
  nativeReminderBodyStake: "今天完成训练，否则你的 {stake} 质押将归按时完成的人。",
  nativeReminderBody: "在截止前完成今天的训练。",
  builtBy: "出品方",
};

export default you;
