import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  pageTitle: "Workouts",
  pageDescription: "Alle {count} Fitr-Workouts nach Muskelgruppe, jede Wiederholung per Pose-KI auf dem Gerät geprüft.",
  pageSubtitle: "{count} Übungen, jede Wiederholung auf deinem Gerät geprüft.",

  startTitle: "Workout starten",
  browseAll: "Alle {count} ansehen",
  quickStart: "Schnellstart",
  categoryGroupLabel: "Workout-Kategorie",
  carouselLabel: "{category}-Workouts, {count}, seitlich scrollen für mehr",
  seeAllInCategory: "Alle: {category}",

  categoryAll: "Alle",
  chipWithCount_one: "{name}, {count} Workout",
  chipWithCount_other: "{name}, {count} Workouts",
  filterByCategory: "Workouts nach Kategorie filtern",
  noEquipment: "Ohne Geräte",
  resultCount_one: "{count} Workout",
  resultCount_other: "{count} Workouts",
  resultCountInCategory_one: "{count} Workout in {category}",
  resultCountInCategory_other: "{count} Workouts in {category}",
  resultNoEquipment: "{result}, ohne Geräte",
  emptyNeedsEquipment: "Alle Workouts in {category} brauchen Geräte.",
  showWithEquipment: "Workouts mit Geräten zeigen",

  frontCameraBadge: "Frontkamera",
  frontCameraSpoken: "Frontkamera",
  listSeparator: ", ",
};

export default workouts;
