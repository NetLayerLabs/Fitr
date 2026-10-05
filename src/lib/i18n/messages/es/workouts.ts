import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  // /workouts page
  pageTitle: "Ejercicios",
  pageDescription: "Los {count} ejercicios de Fitr por grupo muscular, con cada repetición revisada por IA de postura en tu dispositivo.",
  pageSubtitle: "{count} ejercicios, cada repetición verificada en tu dispositivo.",

  // Home "Start a workout" block
  startTitle: "Empieza a entrenar",
  browseAll: "Ver los {count}",
  quickStart: "Inicio rápido",
  categoryGroupLabel: "Categoría de ejercicio",
  carouselLabel: "Ejercicios de {category}, {count}, desliza para ver más",
  seeAllInCategory: "Ver todo: {category}",

  // Category chips and the catalogue
  categoryAll: "Todos",
  chipWithCount_one: "{name}, {count} ejercicio",
  chipWithCount_other: "{name}, {count} ejercicios",
  filterByCategory: "Filtrar ejercicios por categoría",
  noEquipment: "Sin equipo",
  resultCount_one: "{count} ejercicio",
  resultCount_other: "{count} ejercicios",
  resultCountInCategory_one: "{count} ejercicio en {category}",
  resultCountInCategory_other: "{count} ejercicios en {category}",
  resultNoEquipment: "{result}, sin equipo",
  emptyNeedsEquipment: "Todos los ejercicios de {category} necesitan equipo.",
  showWithEquipment: "Mostrar ejercicios con equipo",

  // Workout cards
  frontCameraBadge: "Cámara frontal",
  frontCameraSpoken: "cámara frontal",
  listSeparator: ", ",
};

export default workouts;
