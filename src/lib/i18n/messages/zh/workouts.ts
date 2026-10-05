import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  // /workouts page
  pageTitle: "训练",
  pageDescription: "Fitr 全部 {count} 项训练，按肌群分类，每一次动作都由设备端姿态 AI 检查。",
  pageSubtitle: "{count} 个动作，每一次都在你的设备上验证。",

  // Home "Start a workout" block
  startTitle: "开始训练",
  browseAll: "浏览全部 {count} 项",
  quickStart: "快速开始",
  categoryGroupLabel: "训练分类",
  carouselLabel: "{category}训练，共 {count} 项，左右滑动查看更多",
  seeAllInCategory: "全部{category}",

  // Category chips and the catalogue
  categoryAll: "全部",
  chipWithCount_one: "{name}，{count} 项训练",
  chipWithCount_other: "{name}，{count} 项训练",
  filterByCategory: "按分类筛选训练",
  noEquipment: "无需器械",
  resultCount_one: "{count} 项训练",
  resultCount_other: "{count} 项训练",
  resultCountInCategory_one: "{category}：{count} 项训练",
  resultCountInCategory_other: "{category}：{count} 项训练",
  resultNoEquipment: "{result}，无需器械",
  emptyNeedsEquipment: "所有{category}训练都需要器械。",
  showWithEquipment: "显示需要器械的训练",

  // Workout cards
  frontCameraBadge: "前置摄像头",
  frontCameraSpoken: "前置摄像头",
  listSeparator: "，",
};

export default workouts;
