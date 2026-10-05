import type { NsMessages } from "../types";

const wallet: Partial<NsMessages<"wallet">> = {
  // Panel
  testMode: "개발자 테스트 모드: 테스트 토큰({token})을 쓰는 Solana {cluster}예요. 실제 가치는 없어요.",
  disconnect: "연결 해제",
  disconnecting: "연결 해제 중…",
  copyAddress: "주소 복사",
  addressCopied: "주소를 복사했어요",
  copied: "복사됨",
  walletFallbackName: "지갑",
  viewOnExplorer: "Explorer에서 보기",
  balanceTitle: "{token} 잔액",
  refreshBalances: "잔액 새로고침",
  loading: "불러오는 중…",
  balanceLoadFailed: "{token} 잔액을 불러오지 못했어요. {reason}",
  solForFees: "네트워크 수수료용 SOL: {amount}",
  unavailable: "확인 불가",
  lowSol: "SOL이 부족해요. 스테이킹 전에 네트워크 수수료용 SOL을 조금 충전하세요.",
  neverMovesFunds: "Fitr는 자금을 임의로 옮기지 않아요. 모든 스테이킹과 수령은 지갑에서 직접 승인해요.",
  connectTitle: "지갑 연결하기",
  connectHint: "연결하면 {token} 잔액을 확인하고 하루 목표에 스테이킹할 수 있어요.",

  // Connect list
  installedWallet: "설치된 지갑 사용",
  waitingForWallet: "지갑 응답 기다리는 중…",
  iosUnsupported: "iOS에서는 지갑 연결을 지원하지 않아요. Fitr 스테이킹은 Solana Seeker용으로 만들어졌으며 Android에서 작동해요.",
  noWalletAndroid: "Solana 지갑 앱을 찾을 수 없어요. 지갑을 설치한 뒤(Seeker에는 기본 내장) 다시 돌아오세요.",
  noWalletBrowser: "이 브라우저에서 Solana 지갑을 찾을 수 없어요. Seeker나 Android 휴대폰에서 Fitr를 열어 주세요.",
  walletsLabel: "지갑",

  // Seeker badge
  seekerChecking: "Seeker 확인 중…",
  seekerUnavailable: "Seeker 확인 불가",
  seekerVerified: "Seeker 인증됨",
  seekerMissing: "Seeker Genesis Token 없음",

  // Errors
  connectCancelled: "지갑에서 요청이 취소됐어요.",
  noAccountShared: "지갑이 계정을 공유하지 않았어요.",
  connectFailed: "지갑에 연결하지 못했어요.",
  requestFailed: "요청 실패",
  mintNotConfigured: "{token} 민트가 설정되지 않았어요",
  networkError: "네트워크 오류예요. 연결 상태를 확인하세요.",
  seekerCheckBadResponse: "Seeker 확인 응답이 올바르지 않아요",
  seekerCheckFailed: "Seeker 확인 실패({status})",
  tokenAccountWrongProgram: "토큰 계정의 소유자가 SPL Token 프로그램이 아니에요",
  tokenAccountMismatch: "토큰 계정이 예상한 민트/소유자와 일치하지 않아요",
};

export default wallet;
