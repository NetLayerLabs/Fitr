import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "开发者测试模式：Solana {cluster}，使用测试代币（{token}），没有实际价值。",
  disconnect: "断开连接",
  disconnecting: "正在断开…",
  copyAddress: "复制地址",
  addressCopied: "地址已复制",
  copied: "已复制",
  walletFallbackName: "钱包",
  viewOnExplorer: "在区块浏览器中查看",
  balanceTitle: "{token} 余额",
  refreshBalances: "刷新余额",
  loading: "加载中…",
  balanceLoadFailed: "无法加载你的 {token} 余额。{reason}",
  solForFees: "用于网络手续费的 SOL：{amount}",
  unavailable: "不可用",
  lowSol: "SOL 不足。质押前请先充入少量 SOL 支付网络手续费。",
  neverMovesFunds: "Fitr 从不擅自动用资金。每一笔质押或领取都需要你在钱包中批准。",
  connectTitle: "连接钱包",
  connectHint: "连接后即可查看 {token} 余额，并为每日目标质押。",

  // Connect list
  installedWallet: "使用已安装的钱包",
  waitingForWallet: "正在等待钱包…",
  iosUnsupported: "iOS 不支持钱包连接。Fitr 质押功能适用于 Android，专为 Solana Seeker 打造。",
  noWalletAndroid: "未找到 Solana 钱包应用。请先安装一个（Seeker 已内置），然后再回来。",
  noWalletBrowser: "此浏览器中未找到 Solana 钱包。请在你的 Seeker 或 Android 手机上打开 Fitr。",
  walletsLabel: "钱包",

  // Seeker badge
  seekerChecking: "正在检查 Seeker…",
  seekerUnavailable: "暂时无法检查 Seeker",
  seekerVerified: "Seeker 已验证",
  seekerMissing: "无 Seeker Genesis Token",

  // Errors
  connectCancelled: "已在钱包中取消请求。",
  noAccountShared: "钱包未提供账户。",
  connectFailed: "无法连接钱包。",
  requestFailed: "请求失败",
  mintNotConfigured: "{token} 代币地址未配置",
  networkError: "网络错误。请检查网络连接。",
  seekerCheckBadResponse: "Seeker 检查返回了异常响应",
  seekerCheckFailed: "Seeker 检查失败（{status}）",
  tokenAccountWrongProgram: "该代币账户不属于 SPL Token 程序",
  tokenAccountMismatch: "代币账户与预期的代币地址/所有者不匹配",
};

export default wallet;
