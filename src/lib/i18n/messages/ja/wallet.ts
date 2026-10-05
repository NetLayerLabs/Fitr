import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "開発者テストモード：テストトークン（{token}）を使ったSolana {cluster}。実際の価値はありません。",
  disconnect: "接続を解除",
  disconnecting: "接続を解除中…",
  copyAddress: "アドレスをコピー",
  addressCopied: "アドレスをコピーしました",
  copied: "コピーしました",
  walletFallbackName: "ウォレット",
  viewOnExplorer: "エクスプローラーで見る",
  balanceTitle: "{token}残高",
  refreshBalances: "残高を更新",
  loading: "読み込み中…",
  balanceLoadFailed: "{token}残高を読み込めませんでした。{reason}",
  solForFees: "ネットワーク手数料用のSOL：{amount}",
  unavailable: "取得できません",
  lowSol: "SOLが不足しています。ステークの前に、ネットワーク手数料用のSOLを少し追加してください。",
  neverMovesFunds: "Fitrが勝手に資金を動かすことはありません。ステークや受け取りはすべて、あなたがウォレットで承認します。",
  connectTitle: "ウォレットを接続",
  connectHint: "接続すると{token}残高を確認し、毎日の目標にステークできます。",

  // Connect list
  installedWallet: "インストール済みのウォレットを使う",
  waitingForWallet: "ウォレットを待っています…",
  iosUnsupported: "iOSではウォレット接続に対応していません。FitrのステークはSolana Seeker向けに作られたAndroidで利用できます。",
  noWalletAndroid: "Solanaウォレットアプリが見つかりません。インストールしてから戻ってきてください（Seekerには標準搭載されています）。",
  noWalletBrowser: "このブラウザにSolanaウォレットが見つかりません。SeekerまたはAndroidスマホでFitrを開いてください。",
  walletsLabel: "ウォレット",

  // Seeker badge
  seekerChecking: "Seekerを確認中…",
  seekerUnavailable: "Seekerを確認できません",
  seekerVerified: "Seeker確認済み",
  seekerMissing: "Seeker Genesis Tokenなし",

  // Errors
  connectCancelled: "ウォレットでリクエストがキャンセルされました。",
  noAccountShared: "ウォレットからアカウントが共有されませんでした。",
  connectFailed: "ウォレットに接続できませんでした。",
  requestFailed: "リクエストに失敗しました",
  mintNotConfigured: "{token}のミントが設定されていません",
  networkError: "ネットワークエラーです。接続を確認してください。",
  seekerCheckBadResponse: "Seeker確認で予期しない応答がありました",
  seekerCheckFailed: "Seekerの確認に失敗しました（{status}）",
  tokenAccountWrongProgram: "トークンアカウントがSPL Tokenプログラムの所有ではありません",
  tokenAccountMismatch: "トークンアカウントが想定されたミント/所有者と一致しません",
};

export default wallet;
