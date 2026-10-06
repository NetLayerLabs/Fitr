import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "언어",
  languageHint: "앱의 모든 화면에 적용돼요",

  // You tab page
  pageTitle: "내 정보",
  pageDescription: "지갑, Seeker 상태, 설정, 그리고 Fitr가 운동을 검증하고 데이터를 다루는 방식.",
  walletHeading: "지갑",
  settingsHeading: "설정",
  aboutHeading: "Fitr 정보",

  // Profile header
  profileLabel: "프로필",
  changePhoto: "프로필 사진 변경",
  addPhoto: "프로필 사진 추가",
  photoNotImage: "이미지 파일을 선택하세요.",
  photoTooLarge: "이미지가 너무 커요.",
  namePlaceholder: "이름",
  saveName: "이름 저장",
  addName: "이름 추가",
  editName: "이름 수정",
  adjustPhotoTitle: "사진 조정",
  photoMenuTitle: "프로필 사진",
  chooseNewPhoto: "새 사진 선택",
  removePhoto: "사진 삭제",
  photoStaysOnDevice: "사진은 이 기기에만 저장돼요. 업로드되지 않아요.",

  // Avatar crop editor
  cropOpenFailed: "이미지를 열 수 없어요. JPEG나 PNG를 사용해 보세요.",
  cropProcessFailed: "이미지를 처리할 수 없어요.",
  cropClose: "닫기",
  cropLoading: "사진 불러오는 중…",
  cropViewportLabel: "사진 영역. 드래그하거나 방향키로 이동하고, 핀치하거나 더하기/빼기로 확대·축소하세요.",
  cropZoom: "확대/축소",
  cropHint: "드래그해서 위치를 맞추세요. 핀치하거나 슬라이더로 확대·축소하세요.",
  cropCancel: "취소",
  cropSave: "사진 저장",

  // Settings
  remindersTitle: "운동 알림",
  remindersOff: "꺼짐. 스테이크 마감 전에 알림을 보내지 않아요.",
  remindersBlocked: "Fitr 알림이 차단돼 있어요. 스위치를 눌러 Android 설정을 여세요.",
  remindersAllow: "알림을 허용하면 Fitr가 마감 전에 알려 드려요.",
  remindersOn: "스테이크 마감 2시간 전에 한 번, 30분 전에 마지막으로 알려 드려요.",
  cameraTitle: "기본 카메라",
  cameraHint: "운동을 시작할 때 열리는 카메라예요. 운동 화면에서도 전환할 수 있어요.",
  cameraFront: "전면",
  cameraBack: "후면",
  hapticsTitle: "진동",
  hapticsHint: "횟수가 인정될 때마다, 그리고 목표를 달성하면 짧게 진동해요.",
  voiceCoachTitle: "음성 코치",
  voiceCoachHint: "횟수를 소리 내어 세고 자세 안내와 실시간 확인을 알려 줘서 화면을 볼 필요가 없어요.",
  formGuidesTitle: "자세 가이드",
  formGuidesAllShown: "모든 운동은 시작 전에 자세 가이드를 보여 줘요.",
  formGuidesHidden_one: "운동 {count}개에서 숨김.",
  formGuidesHidden_other: "운동 {count}개에서 숨김.",
  formGuidesShowAll: "모든 자세 가이드 다시 보기",

  // About links
  websiteTitle: "Fitr 웹사이트",
  websiteHint: "fitr.day · 친구에게 공유하세요",
  opensInBrowser: " (브라우저에서 열림)",
  verificationLinkTitle: "검증 방식",
  verificationLinkHint: "Fitr가 확인하는 것과 확인할 수 없는 것",
  privacyLinkTitle: "개인정보 보호",
  privacyLinkHint: "영상은 절대 휴대폰 밖으로 나가지 않아요",
  creditsLinkTitle: "크레딧 및 라이선스",
  creditsLinkHint: "Fitr가 사용하는 오픈소스 소프트웨어",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "신뢰",
  verificationTitle: "검증 방식",
  verificationDescription:
    "스테이킹한 날이 인정되기 전에 Fitr가 확인하는 것, 블록체인이 강제하는 것, 그리고 신뢰해야 하는 것.",
  verificationLead:
    "Fitr는 부정행위를 완벽히 막는 게 아니라 부정행위에 강하도록 만들어졌어요. 무엇을, 누가 확인하는지, 그리고 무엇을 신뢰하게 되는지 정확히 알려 드릴게요.",
  verificationPhoneHeading: "1. 휴대폰이 횟수를 세요",
  verificationPhoneBody:
    "기기 내 자세 AI가 카메라 프레임마다 신체 좌표 33개를 찾아, 관절이 전체 가동 범위를 움직였을 때만 1회로 세요(예: 푸시업에서 팔꿈치 90° 이상). 반쪽짜리 동작은 “미인정”으로 표시돼요. 이 모든 과정은 휴대폰에서만 실행돼요.",
  verificationServerHeading: "2. 스테이킹한 운동은 Fitr 서버가 다시 확인해요",
  verificationServerIntro:
    "돈이 걸려 있을 때는 운동하는 동안 휴대폰이 골격 좌표(영상은 절대 아님)를 Fitr 검증 서버로도 보내요. 서버는:",
  verificationServerRecount:
    "같은 카운팅 엔진으로 모든 횟수를 직접 다시 세요. 휴대폰의 결과를 그대로 믿지 않아요.",
  verificationServerChallengesBefore: "무작위 순간에 ",
  verificationServerChallengesStrong: "실시간 챌린지",
  verificationServerChallengesAfter:
    "를 보내요. “오른손을 드세요” 같은 요청은 미리 녹화한 영상으로는 알 수 없어요.",
  verificationServerPlausible:
    "움직임이 물리적으로 가능한지 확인해요. 뼈 길이가 일정하고, 관절이 순간이동하지 않으며, 속도가 사람다운지 봐요.",
  verificationServerTiming: "자체 시계로 시간을 확인하고, 이미 제출된 세션은 거부해요.",
  verificationServerOutro: "이 모든 확인을 통과해야만 서버가 그날을 온체인에 완료로 기록해요.",
  verificationChainHeading: "3. 돈의 규칙은 블록체인이 강제해요",
  verificationChainBody:
    "스테이크는 Fitr가 아니라 Solana의 온체인 볼트 프로그램에 보관돼요. 프로그램은 마감 시간, 지갑당 하루 한 번의 약속, 지급 계산(내 스테이크 + 몰수된 스테이크의 비례 몫, 몰수분에서만 5% 수수료 차감), 중복 수령 방지를 강제해요. Fitr는 스테이크를 자기 쪽으로 옮길 수 없고, 어떤 날이 무효가 되면 모두 환불받아요.",
  verificationTrustHeading: "신뢰해야 하는 것",
  verificationTrustBody:
    "블록체인은 운동을 볼 수 없으므로, Fitr 서버가 공정하게 판단한다고 신뢰해야 해요. 운동했다면 완료로 기록하고, 하지 않은 사람은 완료로 기록하지 않는다는 것이죠. 각 판단에는 판단한 세션의 지문이 담겨 있어 감사할 수 있어요.",
  verificationLimitsBody:
    "카메라 기반 시스템을 절대 속일 수 없는 건 아니에요. 앱을 개조하거나 그럴듯한 대역을 쓰는 작정한 부정행위자는 통과할 수도 있어요. 위의 확인은 그런 시도를 어렵고, 느리고, 스테이크만큼의 가치가 없게 만들기 위한 거예요.",

  // Privacy doc
  privacyEyebrow: "내 데이터",
  privacyTitle: "개인정보 보호",
  privacyDescription: "영상은 절대 휴대폰 밖으로 나가지 않아요. Fitr가 무엇을 저장하고, 무엇을 언제 보내는지.",
  privacyLeadStrong: "카메라 영상은 절대 휴대폰 밖으로 나가지 않아요.",
  privacyLeadRest: " 기기에서 프레임별로 분석되며, 녹화되거나 업로드되지 않아요.",
  privacyFreeHeading: "무료 운동",
  privacyFreeBody:
    "운동에 관한 어떤 정보도 외부로 보내지 않아요. 운동 기록, 연속 기록, 최고 기록, 배지는 이 휴대폰의 앱에만 저장돼요. 기록 탭에서 기록을 지우면 모두 삭제돼요.",
  privacyStakedHeading: "스테이킹한 운동",
  privacyStakedBody:
    "스테이킹한 날을 검증하기 위해 휴대폰은 세션의 골격 좌표(시간에 따른 신체 관절 33개의 위치)와 실시간 챌린지에 대한 응답을 Fitr 검증 서버로 보내요. 영상, 이미지, 오디오는 보내지 않아요. 서버는 이 데이터로 횟수를 확인하고, 같은 운동이 두 번 제출되지 않도록 세션의 지문을 보관해요.",
  privacyWalletHeading: "내 지갑",
  privacyWalletBody:
    "지갑을 연결하면 Fitr는 잔액과 Seeker 상태를 보여 주기 위해 공개 지갑 주소를 확인해요. 키는 지갑에만 있고, 모든 트랜잭션은 직접 승인해요. 스테이크, 완료 기록, 지급 내역은 공개된 Solana 블록체인에 기록돼요.",
  privacyThirdPartiesHeading: "제3자",
  privacyThirdPartiesBody:
    "기기 내 자세 AI(Google MediaPipe)는 라이브러리 자체에 대한 익명 사용 통계를 Google에 보낼 수 있어요. 여기에는 영상, 이미지, 신체 좌표가 포함되지 않아요.",
  privacySettingsHeading: "설정",
  privacySettingsBody: "카메라, 진동, 자세 가이드 설정은 이 휴대폰에만 저장돼요.",

  // Credits doc
  creditsEyebrow: "감사합니다",
  creditsTitle: "크레딧 및 라이선스",
  creditsDescription: "Fitr를 만드는 데 사용한 오픈소스 소프트웨어, 폰트, 미디어.",
  creditsIntro: "Fitr는 오픈소스 소프트웨어로 만들어졌어요. 만들어 주신 모든 분께 감사드려요.",
  creditsClipsHeading: "자세 가이드 영상",
  creditsClipLabel: "{exercise} 시범: {author}",

  // Root layout
  skipToContent: "본문으로 건너뛰기",
  appDescription:
    "Fitr는 기기 내 AI 자세 추적으로 푸시업, 스쿼트, 플랭크를 세요. 모든 횟수를 관절 각도로 확인하며, 영상은 절대 휴대폰 밖으로 나가지 않아요.",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "{left} 남음: {goal}",
  nativeReminderTitle: "운동 마감까지 {left} 남음",
  nativeReminderBodyStake: "오늘 완료하지 않으면 {stake} 스테이크가 운동한 사람들에게 가요.",
  nativeReminderBody: "마감 전에 오늘의 운동을 완료하세요.",
  builtBy: "제작",
};

export default you;
