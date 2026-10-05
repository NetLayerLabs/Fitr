import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  // /workouts page
  pageTitle: "ワークアウト",
  pageDescription: "Fitrの全{count}種のワークアウトを筋肉部位別に。すべてのレップを端末上の姿勢AIがチェックします。",
  pageSubtitle: "{count}種目。すべてのレップを端末上で検証。",

  // Home "Start a workout" block
  startTitle: "ワークアウトを始める",
  browseAll: "全{count}種を見る",
  quickStart: "クイックスタート",
  categoryGroupLabel: "ワークアウトのカテゴリー",
  carouselLabel: "{category}のワークアウト、{count}件。横にスクロールするとさらに表示されます",
  seeAllInCategory: "{category}をすべて見る",

  // Category chips and the catalogue
  categoryAll: "すべて",
  chipWithCount_one: "{name}、{count}件のワークアウト",
  chipWithCount_other: "{name}、{count}件のワークアウト",
  filterByCategory: "カテゴリーでワークアウトを絞り込む",
  noEquipment: "器具なし",
  resultCount_one: "{count}件のワークアウト",
  resultCount_other: "{count}件のワークアウト",
  resultCountInCategory_one: "{category}のワークアウト{count}件",
  resultCountInCategory_other: "{category}のワークアウト{count}件",
  resultNoEquipment: "{result}、器具なし",
  emptyNeedsEquipment: "{category}のワークアウトはすべて器具が必要です。",
  showWithEquipment: "器具ありのワークアウトを表示",

  // Workout cards
  frontCameraBadge: "インカメラ",
  frontCameraSpoken: "インカメラ",
  listSeparator: "、",
};

export default workouts;
