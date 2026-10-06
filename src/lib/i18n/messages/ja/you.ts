import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "言語",
  languageHint: "アプリのすべての画面に反映されます",

  // You tab page
  pageTitle: "マイページ",
  pageDescription: "ウォレット、Seekerのステータス、設定、そしてFitrによるワークアウトの検証方法とデータの扱いについて。",
  walletHeading: "ウォレット",
  settingsHeading: "設定",
  aboutHeading: "Fitrについて",

  // Profile header
  profileLabel: "プロフィール",
  changePhoto: "プロフィール写真を変更",
  addPhoto: "プロフィール写真を追加",
  photoNotImage: "画像ファイルを選んでください。",
  photoTooLarge: "画像が大きすぎます。",
  namePlaceholder: "あなたの名前",
  saveName: "名前を保存",
  addName: "名前を追加",
  editName: "名前を編集",
  adjustPhotoTitle: "写真を調整",
  photoMenuTitle: "プロフィール写真",
  chooseNewPhoto: "新しい写真を選ぶ",
  removePhoto: "写真を削除",
  photoStaysOnDevice: "写真はこの端末にのみ保存され、アップロードされることはありません。",

  // Avatar crop editor
  cropOpenFailed: "画像を開けませんでした。JPEGかPNGをお試しください。",
  cropProcessFailed: "画像を処理できませんでした。",
  cropClose: "閉じる",
  cropLoading: "写真を読み込み中…",
  cropViewportLabel: "写真の位置調整。ドラッグか矢印キーで移動、ピンチかプラス・マイナスでズームします。",
  cropZoom: "ズーム",
  cropHint: "ドラッグで位置を調整。ピンチかスライダーでズームします。",
  cropCancel: "キャンセル",
  cropSave: "写真を保存",

  // Settings
  remindersTitle: "リマインダー",
  remindersOff: "オフ。ステークの締め切り前にFitrから通知は届きません。",
  remindersBlocked: "Fitrの通知がブロックされています。スイッチをタップしてAndroidの設定を開いてください。",
  remindersAllow: "通知を許可すると、締め切り前にFitrがお知らせします。",
  remindersOn: "ステークの締め切り2時間前にお知らせし、30分前に最後のお知らせをします。",
  cameraTitle: "デフォルトのカメラ",
  cameraHint: "ワークアウト開始時に使うカメラです。ワークアウト画面でも切り替えられます。",
  cameraFront: "イン",
  cameraBack: "アウト",
  hapticsTitle: "触覚フィードバック",
  hapticsHint: "レップがカウントされるたびと、目標達成時に短く振動します。",
  voiceCoachTitle: "音声コーチ",
  voiceCoachHint: "レップ数を声で数え、フォームのアドバイスやライブチェックを読み上げるので、画面を見る必要がありません。",
  formGuidesTitle: "フォームガイド",
  formGuidesAllShown: "すべての種目で、開始前にフォームガイドを表示します。",
  formGuidesHidden_one: "{count}種目で非表示にしています。",
  formGuidesHidden_other: "{count}種目で非表示にしています。",
  formGuidesShowAll: "すべてのフォームガイドを再表示",

  // About links
  websiteTitle: "Fitrのウェブサイト",
  websiteHint: "fitr.day · 友だちにシェアしよう",
  opensInBrowser: "（ブラウザで開きます）",
  verificationLinkTitle: "検証のしくみ",
  verificationLinkHint: "Fitrがチェックすること、できないこと",
  privacyLinkTitle: "プライバシー",
  privacyLinkHint: "映像がスマホから出ることはありません",
  creditsLinkTitle: "クレジットとライセンス",
  creditsLinkHint: "Fitrを支えるオープンソースソフトウェア",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "信頼性",
  verificationTitle: "検証のしくみ",
  verificationDescription:
    "ステークした日がカウントされるまでにFitrがチェックすること、ブロックチェーンが保証すること、そしてあなたが信頼する必要があること。",
  verificationLead:
    "Fitrは不正を防ぎにくくする設計で、不正を完全に防げるわけではありません。何を、誰が確認し、あなたが何を信頼しているのかを正確に説明します。",
  verificationPhoneHeading: "1. スマホがレップを数える",
  verificationPhoneBody:
    "端末上の姿勢AIがカメラの各フレームから体の33か所のポイントを検出し、関節が可動域いっぱいに動いたときだけレップをカウントします（例：腕立て伏せではひじが90°より深く曲がること）。不完全なレップは「カウント外」と表示されます。この処理はすべてスマホ上で行われます。",
  verificationServerHeading: "2. ステークしたワークアウトは、Fitrのサーバーが再チェック",
  verificationServerIntro:
    "お金がかかっている場合、ワークアウト中にスマホから骨格のポイント（映像は送りません）がFitrの検証サーバーにも送られます。サーバーは：",
  verificationServerRecount:
    "同じカウントエンジンですべてのレップを独自に数え直します。スマホの結果をそのまま信用することはありません。",
  verificationServerChallengesBefore: "ランダムなタイミングで",
  verificationServerChallengesStrong: "ライブチャレンジ",
  verificationServerChallengesAfter:
    "（「右手を上げて」など）を出します。録画済みの動画では事前に予測できません。",
  verificationServerPlausible:
    "動きが物理的にありえるかを確認します：骨の長さが一定か、関節が瞬間移動していないか、ペースが人間的か。",
  verificationServerTiming: "サーバー自身の時計でタイミングを確認し、すでに提出されたセッションは拒否します。",
  verificationServerOutro: "これらすべてに合格したときだけ、サーバーはその日をオンチェーンで完了として記録します。",
  verificationChainHeading: "3. お金のルールはブロックチェーンが保証",
  verificationChainBody:
    "あなたのステークはFitrではなく、Solana上のオンチェーンのボールトプログラムに保管されます。プログラムが締め切り、1ウォレット1日1コミットメント、払い戻しの計算（ステークの返還＋没収されたステークの按分。手数料5%は没収分からのみ）、二重受け取りの防止を保証します。Fitrがあなたのステークを自分に移すことはできず、ある日が無効になった場合は全員に返金されます。",
  verificationTrustHeading: "あなたが信頼していること",
  verificationTrustBody:
    "ブロックチェーンはあなたのワークアウトを見られないため、Fitrのサーバーが公正に判定することを信頼することになります。つまり、やり切った人を完了とし、やっていない人を完了としないことです。各判定には判定したセッションのフィンガープリントが付いており、監査できます。",
  verificationLimitsBody:
    "カメラを使うシステムで、絶対にだませないものはありません。改造アプリや巧妙な替え玉を使う本気の不正者なら、すり抜けられるかもしれません。上記のチェックは、それを難しく、手間がかかり、ステークに見合わないものにするためのものです。",

  // Privacy doc
  privacyEyebrow: "あなたのデータ",
  privacyTitle: "プライバシー",
  privacyDescription: "映像がスマホから出ることはありません。Fitrが何を保存し、何をいつ送信するのか。",
  privacyLeadStrong: "カメラの映像がスマホから出ることはありません。",
  privacyLeadRest: "映像は端末上で1フレームずつ解析され、録画やアップロードは一切行われません。",
  privacyFreeHeading: "無料のワークアウト",
  privacyFreeBody:
    "ワークアウトに関する情報はどこにも送信されません。履歴、連続記録、自己ベスト、実績は、このスマホのこのアプリ内にのみ保存されます。「記録」タブで履歴を消去すると削除されます。",
  privacyStakedHeading: "ステークしたワークアウト",
  privacyStakedBody:
    "ステークした日を検証するため、スマホからFitrの検証サーバーにセッションの骨格ポイント（体の33か所の関節の位置の推移）とライブチャレンジへの応答を送信します。映像、画像、音声は送りません。サーバーはこれを使ってレップを確認し、同じワークアウトが二重に提出されないよう、セッションのフィンガープリントを保管します。",
  privacyWalletHeading: "あなたのウォレット",
  privacyWalletBody:
    "接続すると、残高とSeekerのステータスを表示するため、Fitrはあなたの公開ウォレットアドレスを参照します。鍵はウォレットの中にあり、すべてのトランザクションはあなたが承認します。ステーク、完了、払い戻しは公開されているSolanaブロックチェーンに記録されます。",
  privacyThirdPartiesHeading: "第三者",
  privacyThirdPartiesBody:
    "端末上の姿勢AI（Google MediaPipe）は、ライブラリ自体に関する匿名の利用統計をGoogleに送信する場合があります。映像、画像、体のポイントは含まれません。",
  privacySettingsHeading: "設定",
  privacySettingsBody: "カメラ、触覚フィードバック、フォームガイドの設定は、このスマホにのみ保存されます。",

  // Credits doc
  creditsEyebrow: "感謝",
  creditsTitle: "クレジットとライセンス",
  creditsDescription: "Fitrを構成するオープンソースソフトウェア、フォント、メディア。",
  creditsIntro: "Fitrはオープンソースソフトウェアの上に作られています。開発に関わるすべての方に感謝します。",
  creditsClipsHeading: "フォームガイドの動画",
  creditsClipLabel: "{exercise}のデモ：{author}",

  // Root layout
  skipToContent: "コンテンツへスキップ",
  appDescription:
    "Fitrは端末上のAI姿勢トラッキングで、腕立て伏せ、スクワット、プランクをカウントします。すべてのレップを関節の角度でチェックし、映像がスマホから出ることはありません。",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "残り{left}：{goal}",
  nativeReminderTitle: "締め切りまで残り{left}",
  nativeReminderBodyStake: "今日中に終えないと、{stake}のステークはやり切った人たちに分配されます。",
  nativeReminderBody: "締め切りまでに今日のワークアウトを終えましょう。",
  builtBy: "開発",
};

export default you;
