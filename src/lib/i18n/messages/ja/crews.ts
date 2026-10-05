import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "ソロ",
  unnamedCrew: "クルー {suffix}",
  challengeFree: "各自が好きなワークアウトを選ぶ",
  challengeFixedGoal: "全員で{goal}",
  challengeFixedExercise: "{exercise}、目標は各自で設定",
  inviteShareText: "Fitrのクルー「{name}」に参加しよう。{challenge}。やり切ることにSKRをステーク。来なかった人の分は、やり切った人に分配されます。",
  inviteShareTitle: "Fitrの{name}",

  // Page metadata
  metaTitle: "クルー",
  metaDescription: "あなたのFitrクルー：今日のチャレンジ、やり切った人、クルーの連続記録、ランキング。",

  // Crew hub (Commit tab)
  yourCrewsTitle: "あなたのクルー",
  lookingForCrews: "クルーを探しています…",
  crewsLoadError: "クルーを読み込めませんでした。少ししてからもう一度お試しください。",
  noCrewsYet: "まだクルーがありません。下で作成してリンクを共有するか、友だちからの招待を開いてください。",
  yoursTag: "作成者",
  joinTitle: "クルーに参加",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "招待リンクまたはクルー番号",
  joinOpen: "開く",
  joinInvalid: "fitr.day/c/123… のような招待リンクか、クルー番号を貼り付けてください。",

  // Create a crew
  createTitle: "クルーを作る",
  createHint:
    "クルーには専用のプールがあり、来なかった人の分はやり切ったメンバーに分配されます。誰もやり切らなかった日のステークは、次に誰かがやり切った日に繰り越されます。",
  crewNameLabel: "クルー名",
  crewNamePlaceholder: "朝活トレーニング部",
  crewNameEmpty: "クルーに名前を付けてください。",
  crewNameChars: "文字、数字、絵文字のみ使えます。",
  crewNameTooLong: "名前が長すぎます（最大32バイト）。",
  sameExerciseToggle: "全員が同じ種目を行う",
  sameGoalToggle: "全員同じ目標",
  createNeedsSol:
    "クルーの作成には、アカウントのレントとネットワーク手数料として約{needed}が必要です。このウォレットの残高は{balance}です。",
  createPaused: "現在メンテナンスのため、新しいクルーの作成を一時停止しています。",
  working: "処理中…",
  createButton: "クルーを作成",
  createFine:
    "署名は1回 · アカウントのレント約{rent}（返金なし）。クルーを作成しても特別な権限はありません。オンチェーンのルールは全員に同じように適用されます。",
  createTimeout: "ウォレットからは送信されましたが、まだネットワークで確認されていません。エクスプローラーを確認してから更新してください。",
  createFailedOnchain: "クルーの作成がオンチェーンで失敗しました。ネットワーク手数料以外は請求されていません。",
  vaultReadError: "ボールトを読み込めませんでした",

  // Commitments across pools
  commitmentsTodayTitle: "今日のあなたのコミットメント",
  goalFallback: "目標",
  forTomorrow: "明日",
  tagToDo: "未実施",
  tagVerifying: "検証中",
  tagVerified: "検証済み",
  tagClaim: "受け取る",
  tagMissed: "未達成",
  tagWithdrawn: "取り消し",
  tagCommitted: "コミット済み",

  // Crew page
  eyebrowCrew: "クルー",
  eyebrowCommitTogether: "みんなでコミット",
  loadingCrew: "クルーを読み込み中",
  notFoundTitle: "クルーが見つかりません",
  notFoundBody: "このクルーがオンチェーンで見つかりませんでした。招待リンクを確認してください。ステークがまだ開始していない可能性もあります。",
  goToCommit: "コミットへ",
  unreachableTitle: "ボールトに接続できません",
  unreachableBody: "このクルーを読み込めませんでした。接続を確認して、もう一度お試しください。",
  tryAgain: "もう一度試す",
  connectToCommit: "ウォレットを接続して、クルーでコミットしましょう。ステークの署名はすべてあなた自身が行います。",
  seekerOnly:
    "ステークはSeeker専用です。このウォレットにはSeeker Genesis Tokenがありません。クルーのフォローやトレーニングは引き続きできます。",
  checkSeekerAgain: "Seekerを再確認",
  checkingSeeker: "Seekerを確認中…",
  deletedTitle: "このクルーは削除されました",
  deletedBody:
    "作成者がFitrから削除したため、今後は誰も参加やステークができません。ここでステークしていた場合は、下から受け取れます。",
  todaysChallenge: "今日のチャレンジ",
  ownWorkoutOwnGoal: "ワークアウトも目標も自由",
  sameGoalSentence: "全員同じ目標です。",
  challengeSentence: "{challenge}。",
  challengeRules:
    "来なかった人の分は、やり切ったクルーメンバーに分配されます。誰もやり切らなかった場合、ステークは次に誰かがやり切ったクルーの日に繰り越されます。",
  statStreak: "クルーの連続記録",
  statVerifiedToday: "今日の検証済み",
  statMembers: "メンバー",
  todayTitle: "今日",
  dayLoadError: "クルーの今日の状況を読み込めませんでした。自動で更新されます。",
  loading: "読み込み中…",
  nobodyCommitted: "今日はまだ誰もコミットしていません。一番乗りになって、リンクを共有しましょう。",
  you: "あなた",
  streakExplainer: "クルーの連続記録は、コミットした全員が検証された日を数えます。",
  streakExplainerBest: "クルーの連続記録は、コミットした全員が検証された日を数えます（最高：{best}）。",
  yourStakeTitle: "あなたのステーク",
  leaderboardTitle: "ランキング",
  leaderboardLabel: "クルーのランキング",
  leaderboardEmpty: "最初の検証済みの日の後に、ランキングが表示されます。",
  leaderDays_one: "検証済み{count}日 · 連続記録{streak}",
  leaderDays_other: "検証済み{count}日 · 連続記録{streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "ボーナス",
  bonusExplainer:
    "ボーナスは、メンバーが自分のステークに加えて受け取った、達成できなかったクルーメンバーからの分配分です（Fitrの手数料は没収分の{fee}%のみ）。{token}の金額はクルーのオンチェーンのプロフィールに基づきます。",
  rolloverNote: "繰り越し中：誰もやり切らなかったクルーの日の{amount}は、次に誰かがやり切ったクルーの日に回ります。",

  // Invite actions
  inviteButton: "招待",
  copyButton: "コピー",
  copiedButton: "コピーしました",
  copyInviteLink: "招待リンクをコピー",
  inviteLinkCopied: "招待リンクをコピーしました",
  inviteLinkLabel: "招待リンク",

  // Delete crew
  deleteButton: "クルーを削除",
  deleteConfirmTitle: "{name}を削除しますか？",
  deleteConfirmBody:
    "クルーはFitrから消え、招待リンクも使えなくなります。今後は誰も参加やステークができません。すでにステークした人は引き続き受け取れます。作成者であることを証明するため、ウォレットでメッセージに署名します。トランザクションや手数料は発生しません。",
  keepIt: "残す",
  deleting: "削除中…",
  deleteCancelled: "ウォレットでキャンセルされました。何も変更されていません。",
  deleteFailed: "クルーを削除できませんでした。もう一度お試しください。",
  deleteFailedStatus: "クルーを削除できませんでした（{status}）。",
};

export default crews;
