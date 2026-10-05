import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  // /workouts page
  pageTitle: "Séances",
  pageDescription: "Les {count} séances Fitr par groupe musculaire, chaque répétition vérifiée par l’IA de suivi des mouvements sur l’appareil.",
  pageSubtitle: "{count} exercices, chaque répétition vérifiée sur ton appareil.",

  // Home "Start a workout" block
  startTitle: "Commencer une séance",
  browseAll: "Voir les {count}",
  quickStart: "Démarrage rapide",
  categoryGroupLabel: "Catégorie de séance",
  carouselLabel: "Séances {category}, {count}, fais défiler pour en voir plus",
  seeAllInCategory: "Tout : {category}",

  // Category chips and the catalogue
  categoryAll: "Tout",
  chipWithCount_one: "{name}, {count} séance",
  chipWithCount_other: "{name}, {count} séances",
  filterByCategory: "Filtrer les séances par catégorie",
  noEquipment: "Sans matériel",
  resultCount_one: "{count} séance",
  resultCount_other: "{count} séances",
  resultCountInCategory_one: "{count} séance dans {category}",
  resultCountInCategory_other: "{count} séances dans {category}",
  resultNoEquipment: "{result}, sans matériel",
  emptyNeedsEquipment: "Toutes les séances {category} demandent du matériel.",
  showWithEquipment: "Afficher les séances avec matériel",

  // Workout cards
  frontCameraBadge: "Caméra avant",
  frontCameraSpoken: "caméra avant",
  /** Joins the parts of a card's accessible name ("Pull-ups, 8 reps, needs a bar"). */
  listSeparator: ", ",
};

export default workouts;
