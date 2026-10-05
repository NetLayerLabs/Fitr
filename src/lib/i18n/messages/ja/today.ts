import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "今日",
  greetingMorning: "おはようございます",
  greetingAfternoon: "こんにちは",
  greetingEvening: "こんばんは",
  dayStreak: "日連続",
  dayUnit_one: "日",
  dayUnit_other: "日",

  // Time left until the deadline
  deadlinePassed: "締め切りを過ぎました",
  timeLeftUnderMinute: "残り1分未満",
  timeLeftHoursMinutes: "残り{hours}時間{minutes}分",
  timeLeftMinutes: "残り{minutes}分",
  spokenUnderMinute: "残り1分を切りました",
  spokenLeft: "残り{time}",
  spokenHours_one: "{count}時間",
  spokenHours_other: "{count}時間",
  spokenMinutes_one: "{count}分",
  spokenMinutes_other: "{count}分",
  spokenSeconds_one: "{count}秒",
  spokenSeconds_other: "{count}秒",

  // Amounts in an exercise unit
  goalReps_one: "{count}回",
  goalReps_other: "{count}回",
  goalSeconds_one: "{count}秒",
  goalSeconds_other: "{count}秒",

  // Hero card
  heroLoadingTitle: "コミットメントを確認中…",
  heroGoalEyebrow: "あなたの目標",
  heroGoalFallback: "今日の目標",
  start: "スタート",
  viewCommitment: "コミットメントを見る",
  atStake: "{amount}をステーク中",
  verifyingEyebrow: "あと少し",
  verifyingTitle: "ワークアウトを検証中…",
  verifyingBody: "Fitrがレップ数とライブチャレンジを再チェックしています。通常はすぐに終わります。",
  verifiedTitle: "目標を検証しました",
  seeProgress: "記録を見る",
  verifiedBodyWithGoal: "{goal}を達成し、オンチェーンに記録しました。ステークは無事です。また明日来てください。",
  verifiedBody: "達成し、オンチェーンに記録しました。ステークは無事です。また明日来てください。",
  claimEyebrow: "受け取り可能",
  claimFallbackTitle: "ステークが戻ってきました",
  claim: "受け取る",
  claimBody: "約束を守りましたね。ステークと分配分を受け取りましょう。",
  missedEyebrow: "目標未達成",
  missedTitle: "明日はまた新しい一日",
  commitAgain: "もう一度コミット",
  missedBody: "検証済みのワークアウトがないまま締め切りを過ぎました。続けられる目標を設定しましょう。",
  revokedEyebrow: "審査中",
  revokedTitle: "検証が取り消されました",
  viewDetails: "詳細を見る",
  revokedBody:
    "Fitrの審査により、今日の検証が取り消されました。ステークは没収されません。その日が締め切られた後に受け取れます（ボーナスなし）。",
  trainFreeEyebrow: "無料でトレーニング",
  pickWorkout: "ワークアウトを選ぶ",
  notSeekerTitle: "コミットにはSeekerが必要です",
  notSeekerBody: "ステークはSolana Seekerをお持ちの方向けです。ワークアウトとレップカウンターはすべて引き続き使えます。",
  pausedTitle: "コミットは一時停止中です",
  pausedBody: "現在ステークは利用できません。ワークアウトはこれまで通り記録されます。",
  commitTitle: "自分との約束をかけよう",
  commit: "コミット",
  commitBodyNoWallet: "ウォレットを接続し、目標を選んで、今日やり切ることにSKRをステークしましょう。",
  commitBody: "目標を選んで、今日やり切ることにSKRをステークしましょう。達成すればステークは戻ってきます。",

  // Commitment card
  commitmentCardTitle: "毎日の$SKRコミットメント",
  stepStakeTitle: "ステーク。",
  stepStakeBody: "毎日の目標とロックするSKRの額を選びます。どちらもコミット時にオンチェーンで確定します。",
  stepShowUpTitle: "やり切る。",
  stepShowUpBody:
    "目標を達成しましょう。端末上の姿勢トラッキングでカウントし、Fitrの検証システムが再チェックします。ステークに加えてプールの分配分が戻ってきます。",
  stepPayUpTitle: "できなければ、払う。",
  stepPayUpBody: "達成できなければ、ステークは5%の手数料を差し引いて、やり切った人たちに分配されます。",
  currentStreak: "現在の連続記録",
  poolMultiplier: "プール倍率",
  notAvailableYet: "まだ利用できません",
  commitToken: "{token}をコミット",
  stakeNote: "目標とステーク額はあなたが決めます。ウォレットで署名するまで何もステークされません。",

  // Wallet row
  balanceUnavailable: "残高を取得できません",
  loadingBalance: "残高を読み込み中…",
  connectWallet: "ウォレットを接続",
  seeBalance: "{token}の残高を見る",

  // Activity + quick start
  activityHeading: "今日のアクティビティ",
  nothingLoggedYet: "今日はまだ記録がありません。",
  defaultGoalHit: "デフォルト目標を達成",
  quickStartHeading: "クイックスタート",
  allWorkouts: "すべてのワークアウト",
};

export default today;
