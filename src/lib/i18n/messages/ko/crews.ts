import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "개인",
  unnamedCrew: "크루 {suffix}",
  challengeFree: "각자 원하는 운동 선택",
  challengeFixedGoal: "모두 {goal}",
  challengeFixedExercise: "{exercise}, 목표는 각자 설정",
  inviteShareText: "내 Fitr 크루 \"{name}\"에 함께해요. {challenge}. 운동하겠다는 약속에 SKR을 스테이킹하세요. 빠진 사람의 스테이크는 운동한 사람들에게 가요.",
  inviteShareTitle: "Fitr의 {name}",

  // Page metadata
  metaTitle: "크루",
  metaDescription: "나의 Fitr 크루: 오늘의 챌린지, 운동한 사람, 크루 연속 기록과 순위표.",

  // Crew hub (Commit tab)
  yourCrewsTitle: "내 크루",
  lookingForCrews: "크루를 찾는 중…",
  crewsLoadError: "지금은 크루를 불러올 수 없어요. 잠시 후 다시 시도하세요.",
  noCrewsYet: "아직 크루가 없어요. 아래에서 크루를 만들어 링크를 공유하거나, 친구의 초대 링크를 여세요.",
  yoursTag: "내 크루",
  joinTitle: "크루 참여하기",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "초대 링크 또는 크루 번호",
  joinOpen: "열기",
  joinInvalid: "fitr.day/c/123… 같은 초대 링크나 크루 번호를 붙여 넣으세요.",

  // Create a crew
  createTitle: "크루 만들기",
  createHint:
    "크루에는 전용 풀이 생겨요. 빠진 사람의 스테이크는 운동한 크루원들에게 가요. 어떤 날 아무도 운동하지 않으면 스테이크는 누군가 운동하는 다음 날로 이월돼요.",
  crewNameLabel: "크루 이름",
  crewNamePlaceholder: "아침 운동 크루",
  crewNameEmpty: "크루 이름을 지어 주세요.",
  crewNameChars: "문자, 숫자, 이모지만 사용할 수 있어요.",
  crewNameTooLong: "이름이 너무 길어요(최대 32바이트).",
  sameExerciseToggle: "모두 같은 운동하기",
  sameGoalToggle: "모두 같은 목표",
  createNeedsSol:
    "크루를 만들려면 계정 렌트와 네트워크 수수료로 약 {needed}이(가) 필요해요. 이 지갑에는 {balance}이(가) 있어요.",
  createPaused: "점검으로 지금은 새 크루를 만들 수 없어요.",
  working: "처리 중…",
  createButton: "크루 만들기",
  createFine:
    "서명 한 번 · 계정 렌트 약 {rent}(환불되지 않음). 크루를 만들어도 특별한 권한은 없어요. 모두에게 같은 온체인 규칙이 적용돼요.",
  createTimeout: "지갑에서 전송했지만 아직 네트워크에서 확인되지 않았어요. Explorer를 확인한 뒤 새로고침하세요.",
  createFailedOnchain: "온체인에서 크루 만들기에 실패했어요. 네트워크 수수료 외에는 청구되지 않았어요.",
  vaultReadError: "볼트를 읽지 못했어요",

  // Commitments across pools
  commitmentsTodayTitle: "오늘의 내 약속",
  goalFallback: "목표",
  forTomorrow: "내일",
  tagToDo: "할 일",
  tagVerifying: "검증 중",
  tagVerified: "검증 완료",
  tagClaim: "받기",
  tagMissed: "놓침",
  tagWithdrawn: "취소됨",
  tagCommitted: "약속함",

  // Crew page
  eyebrowCrew: "크루",
  eyebrowCommitTogether: "함께 약속하기",
  loadingCrew: "크루 불러오는 중",
  notFoundTitle: "크루를 찾을 수 없어요",
  notFoundBody: "온체인에서 이 크루를 찾지 못했어요. 초대 링크를 확인하세요. 스테이킹이 아직 열리지 않았을 수도 있어요.",
  goToCommit: "약속 탭으로 가기",
  unreachableTitle: "볼트에 연결할 수 없어요",
  unreachableBody: "이 크루를 읽지 못했어요. 연결을 확인하고 다시 시도하세요.",
  tryAgain: "다시 시도",
  connectToCommit: "지갑을 연결하고 크루와 함께 약속하세요. 모든 스테이킹은 직접 서명해요.",
  seekerOnly:
    "스테이킹은 Seeker 전용이에요. 이 지갑에는 Seeker Genesis Token이 없어요. 크루를 팔로우하며 운동은 계속할 수 있어요.",
  checkSeekerAgain: "Seeker 다시 확인하기",
  checkingSeeker: "Seeker 확인 중…",
  deletedTitle: "삭제된 크루예요",
  deletedBody:
    "만든 사람이 Fitr에서 이 크루를 삭제해서 더 이상 참여하거나 스테이킹할 수 없어요. 여기에 스테이킹했다면 아래에서 계속 받을 수 있어요.",
  todaysChallenge: "오늘의 챌린지",
  ownWorkoutOwnGoal: "내 운동, 내 목표",
  sameGoalSentence: "모두 같은 목표예요.",
  challengeSentence: "{challenge}.",
  challengeRules:
    "빠진 사람의 스테이크는 운동한 크루원들에게 가요. 아무도 운동하지 않으면 스테이크는 누군가 완료하는 다음 크루 날로 이월돼요.",
  statStreak: "크루 연속 기록",
  statVerifiedToday: "오늘 검증",
  statMembers: "멤버",
  todayTitle: "오늘",
  dayLoadError: "크루의 오늘 현황을 불러오지 못했어요. 자동으로 새로고침돼요.",
  loading: "불러오는 중…",
  nobodyCommitted: "오늘은 아직 아무도 약속하지 않았어요. 첫 번째로 약속하고 링크를 공유하세요.",
  you: "나",
  streakExplainer: "크루 연속 기록은 약속한 모든 사람이 검증받은 날을 세요.",
  streakExplainerBest: "크루 연속 기록은 약속한 모든 사람이 검증받은 날을 세요(최고: {best}).",
  yourStakeTitle: "나의 스테이크",
  leaderboardTitle: "순위표",
  leaderboardLabel: "크루 순위표",
  leaderboardEmpty: "첫 검증일이 지나면 순위표가 채워져요.",
  leaderDays_one: "{count}일 검증 · {streak}일 연속",
  leaderDays_other: "{count}일 검증 · {streak}일 연속",
  bonusAmount: "+{amount}",
  bonusLabel: "보너스",
  bonusExplainer:
    "보너스는 놓친 크루원들로부터 받은 금액으로, 자기 스테이크 외에 추가로 받은 몫이에요(Fitr는 몰수분에서만 {fee}% 수수료를 가져가요). {token} 금액은 크루의 온체인 프로필에서 가져와요.",
  rolloverNote: "이월 중: 아무도 완료하지 않은 크루 날의 {amount}이(가) 누군가 완료하는 다음 크루 날로 넘어가요.",

  // Invite actions
  inviteButton: "초대",
  copyButton: "복사",
  copiedButton: "복사됨",
  copyInviteLink: "초대 링크 복사",
  inviteLinkCopied: "초대 링크를 복사했어요",
  inviteLinkLabel: "초대 링크",

  // Delete crew
  deleteButton: "크루 삭제",
  deleteConfirmTitle: "{name}을(를) 삭제할까요?",
  deleteConfirmBody:
    "Fitr에서 사라지고 초대 링크도 더 이상 작동하지 않아요. 누구도 참여하거나 스테이킹할 수 없어요. 이미 스테이킹한 사람은 계속 받을 수 있어요. 크루를 만든 사람임을 증명하기 위해 지갑으로 메시지에 서명해요. 트랜잭션도 수수료도 없어요.",
  keepIt: "유지하기",
  deleting: "삭제 중…",
  deleteCancelled: "지갑에서 취소했어요. 바뀐 건 없어요.",
  deleteFailed: "크루를 삭제하지 못했어요. 다시 시도하세요.",
  deleteFailedStatus: "크루를 삭제하지 못했어요({status}).",
};

export default crews;
