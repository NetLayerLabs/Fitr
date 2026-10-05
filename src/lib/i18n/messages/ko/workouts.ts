import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  // /workouts page
  pageTitle: "운동",
  pageDescription: "근육 부위별 Fitr 운동 {count}가지. 모든 횟수를 기기 내 자세 AI가 확인해요.",
  pageSubtitle: "운동 {count}가지, 모든 횟수를 기기에서 검증해요.",

  // Home "Start a workout" block
  startTitle: "운동 시작하기",
  browseAll: "전체 {count}개 보기",
  quickStart: "빠른 시작",
  categoryGroupLabel: "운동 카테고리",
  carouselLabel: "{category} 운동 {count}개, 옆으로 스크롤하면 더 볼 수 있어요",
  seeAllInCategory: "{category} 전체",

  // Category chips and the catalogue
  categoryAll: "전체",
  chipWithCount_one: "{name}, 운동 {count}개",
  chipWithCount_other: "{name}, 운동 {count}개",
  filterByCategory: "카테고리로 운동 필터링",
  noEquipment: "기구 없이",
  resultCount_one: "운동 {count}개",
  resultCount_other: "운동 {count}개",
  resultCountInCategory_one: "{category} 운동 {count}개",
  resultCountInCategory_other: "{category} 운동 {count}개",
  resultNoEquipment: "{result}, 기구 없이",
  emptyNeedsEquipment: "{category} 운동은 모두 기구가 필요해요.",
  showWithEquipment: "기구가 필요한 운동 보기",

  // Workout cards
  frontCameraBadge: "전면 카메라",
  frontCameraSpoken: "전면 카메라",
  listSeparator: ", ",
};

export default workouts;
