import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  // /workouts page
  pageTitle: "Allenamenti",
  pageDescription: "Tutti i {count} allenamenti di Fitr per gruppo muscolare, ogni ripetizione controllata dall'AI di postura sul dispositivo.",
  pageSubtitle: "{count} esercizi, ogni ripetizione verificata sul tuo dispositivo.",

  // Home "Start a workout" block
  startTitle: "Inizia un allenamento",
  browseAll: "Vedi tutti e {count}",
  quickStart: "Avvio rapido",
  categoryGroupLabel: "Categoria di allenamento",
  carouselLabel: "Allenamenti {category}, {count}, scorri di lato per vederne altri",
  seeAllInCategory: "Tutti: {category}",

  // Category chips and the catalogue
  categoryAll: "Tutti",
  chipWithCount_one: "{name}, {count} allenamento",
  chipWithCount_other: "{name}, {count} allenamenti",
  filterByCategory: "Filtra gli allenamenti per categoria",
  noEquipment: "Senza attrezzi",
  resultCount_one: "{count} allenamento",
  resultCount_other: "{count} allenamenti",
  resultCountInCategory_one: "{count} allenamento in {category}",
  resultCountInCategory_other: "{count} allenamenti in {category}",
  resultNoEquipment: "{result}, senza attrezzi",
  emptyNeedsEquipment: "Tutti gli allenamenti {category} richiedono attrezzi.",
  showWithEquipment: "Mostra allenamenti con attrezzi",

  // Workout cards
  frontCameraBadge: "Fotocamera frontale",
  frontCameraSpoken: "fotocamera frontale",
  listSeparator: ", ",
};

export default workouts;
