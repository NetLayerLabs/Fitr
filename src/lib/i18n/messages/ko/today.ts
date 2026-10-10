import type { NsMessages } from "../types";

const today: Partial<NsMessages<"today">> = {
  // Header
  todayTitle: "오늘",
  greetingMorning: "좋은 아침이에요",
  greetingAfternoon: "좋은 오후예요",
  greetingEvening: "좋은 저녁이에요",
  dayStreak: "일 연속",
  dayUnit_one: "일",
  dayUnit_other: "일",

  // Time left until the deadline
  deadlinePassed: "마감 시간이 지났어요",
  timeLeftUnderMinute: "1분 미만 남음",
  timeLeftHoursMinutes: "{hours}시간 {minutes}분 남음",
  timeLeftMinutes: "{minutes}분 남음",
  spokenUnderMinute: "1분도 안 남았어요",
  spokenLeft: "{time} 남았어요",
  spokenHours_one: "{count}시간",
  spokenHours_other: "{count}시간",
  spokenMinutes_one: "{count}분",
  spokenMinutes_other: "{count}분",
  spokenSeconds_one: "{count}초",
  spokenSeconds_other: "{count}초",

  // Amounts in an exercise unit
  goalReps_one: "{count}회",
  goalReps_other: "{count}회",
  goalSeconds_one: "{count}초",
  goalSeconds_other: "{count}초",

  // Hero card
  heroLoadingTitle: "약속을 확인하는 중…",
  heroGoalEyebrow: "나의 목표",
  heroGoalFallback: "오늘의 목표",
  start: "시작",
  viewCommitment: "약속 보기",
  atStake: "{amount} 스테이킹 중",
  verifyingEyebrow: "거의 다 됐어요",
  verifyingTitle: "운동을 검증하는 중…",
  verifyingBody: "Fitr가 횟수와 실시간 챌린지를 다시 확인하고 있어요. 보통 금방 끝나요.",
  verifiedTitle: "목표 검증 완료",
  seeProgress: "기록 보기",
  verifiedBodyWithGoal: "{goal} 완료, 온체인에 기록됐어요. 스테이크는 안전해요. 내일 또 만나요.",
  verifiedBody: "완료, 온체인에 기록됐어요. 스테이크는 안전해요. 내일 또 만나요.",
  claimEyebrow: "받을 준비 완료",
  claimFallbackTitle: "스테이크가 돌아왔어요",
  claim: "받기",
  claimBody: "약속을 지켰어요. 스테이크와 내 몫을 받으세요.",
  missedEyebrow: "목표 미달성",
  missedTitle: "내일은 새로운 날이에요",
  commitAgain: "다시 약속하기",
  missedBody: "검증된 운동 없이 마감 시간이 지났어요. 지킬 수 있는 목표를 정해 보세요.",
  revokedEyebrow: "검토 중",
  revokedTitle: "검증 취소됨",
  viewDetails: "자세히 보기",
  revokedBody:
    "Fitr 검토 결과 오늘의 검증이 취소됐어요. 스테이크는 몰수되지 않아요. 하루가 마감되면 돌려받을 수 있어요(보너스 없음).",
  trainFreeEyebrow: "무료 운동",
  pickWorkout: "운동 고르기",
  notSeekerTitle: "약속하려면 Seeker가 필요해요",
  notSeekerBody: "스테이킹은 Solana Seeker 사용자 전용이에요. 모든 운동과 횟수 카운터는 그대로 쓸 수 있어요.",
  pausedTitle: "약속이 일시 중지됐어요",
  pausedBody: "지금은 스테이킹을 쓸 수 없어요. 운동 기록은 그대로 남아요.",
  commitTitle: "나 자신과 약속하세요",
  commit: "약속하기",
  commitBodyNoWallet: "지갑을 연결하고 목표를 정한 뒤, 오늘 운동하겠다는 약속에 SKR을 스테이킹하세요.",
  commitBody: "목표를 정하고 오늘 운동하겠다는 약속에 SKR을 스테이킹하세요. 목표를 달성하면 스테이크가 돌아와요.",

  // Commitment card
  commitmentCardTitle: "매일 $SKR 약속",
  stepStakeTitle: "스테이킹.",
  stepStakeBody: "하루 목표와 잠글 SKR 수량을 정하세요. 약속하는 순간 둘 다 온체인에 고정돼요.",
  stepShowUpTitle: "운동하기.",
  stepShowUpBody:
    "목표를 달성하세요. 기기의 자세 추적이 횟수를 세고 Fitr 검증 서버가 다시 확인해요. 스테이크와 함께 풀의 일부를 돌려받아요.",
  stepPayUpTitle: "아니면 대가를.",
  stepPayUpBody: "목표를 놓치면 스테이크는 운동을 완료한 사람들에게 가요(수수료 5% 제외).",
  currentStreak: "현재 연속 기록",
  poolMultiplier: "풀 배수",
  notAvailableYet: "아직 이용할 수 없어요",
  commitToken: "{token} 약속하기",
  stakeNote: "목표와 스테이크는 직접 정해요. 지갑에서 서명하기 전까지는 아무것도 스테이킹되지 않아요.",

  // Wallet row
  balanceUnavailable: "잔액을 불러올 수 없어요",
  loadingBalance: "잔액 불러오는 중…",
  connectWallet: "지갑 연결",
  seeBalance: "{token} 잔액 보기",

  // Activity + quick start
  activityHeading: "오늘의 활동",
  nothingLoggedYet: "오늘은 아직 기록이 없어요.",
  defaultGoalHit: "기본 목표 달성",
  quickStartHeading: "빠른 시작",
  allWorkouts: "전체 운동",
  heroGoalTomorrowEyebrow: "내일 목표",
  practiceNow: "지금 연습하기",
  countsFrom: "{time}부터 인정",
};

export default today;
