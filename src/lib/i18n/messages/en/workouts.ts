/** English source for the "workouts" namespace. Keys are stable ids; values may use {placeholders}. */
const workouts = {
  // /workouts page
  pageTitle: "Workouts",
  pageDescription: "All {count} Fitr workouts by muscle group, each rep checked by on-device pose AI.",
  pageSubtitle: "{count} exercises, every rep verified on your device.",

  // Home "Start a workout" block
  startTitle: "Start a workout",
  browseAll: "Browse all {count}",
  quickStart: "Quick start",
  categoryGroupLabel: "Workout category",
  carouselLabel: "{category} workouts, {count}, scroll sideways for more",
  seeAllInCategory: "All {category}",

  // Category chips and the catalogue
  categoryAll: "All",
  chipWithCount_one: "{name}, {count} workout",
  chipWithCount_other: "{name}, {count} workouts",
  filterByCategory: "Filter workouts by category",
  noEquipment: "No equipment",
  resultCount_one: "{count} workout",
  resultCount_other: "{count} workouts",
  resultCountInCategory_one: "{count} workout in {category}",
  resultCountInCategory_other: "{count} workouts in {category}",
  resultNoEquipment: "{result}, no equipment",
  emptyNeedsEquipment: "Every {category} workout needs equipment.",
  showWithEquipment: "Show workouts with equipment",

  // Workout cards
  frontCameraBadge: "Front camera",
  frontCameraSpoken: "front camera",
  /** Joins the parts of a card's accessible name ("Pull-ups, 8 reps, needs a bar"). */
  listSeparator: ", ",
} as const;

export default workouts;
