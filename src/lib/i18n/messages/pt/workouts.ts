import type { NsMessages } from "../types";

const workouts: Partial<NsMessages<"workouts">> = {
  // /workouts page
  pageTitle: "Treinos",
  pageDescription: "Todos os {count} treinos do Fitr por grupo muscular, cada rep conferida por IA de pose no aparelho.",
  pageSubtitle: "{count} exercícios, cada rep verificada no seu aparelho.",

  // Home "Start a workout" block
  startTitle: "Começar um treino",
  browseAll: "Ver todos os {count}",
  quickStart: "Início rápido",
  categoryGroupLabel: "Categoria de treino",
  carouselLabel: "Treinos de {category}, {count}, deslize para o lado para ver mais",
  seeAllInCategory: "Tudo de {category}",

  // Category chips and the catalogue
  categoryAll: "Todos",
  chipWithCount_one: "{name}, {count} treino",
  chipWithCount_other: "{name}, {count} treinos",
  filterByCategory: "Filtrar treinos por categoria",
  noEquipment: "Sem equipamento",
  resultCount_one: "{count} treino",
  resultCount_other: "{count} treinos",
  resultCountInCategory_one: "{count} treino em {category}",
  resultCountInCategory_other: "{count} treinos em {category}",
  resultNoEquipment: "{result}, sem equipamento",
  emptyNeedsEquipment: "Todo treino de {category} precisa de equipamento.",
  showWithEquipment: "Mostrar treinos com equipamento",

  // Workout cards
  frontCameraBadge: "Câmera frontal",
  frontCameraSpoken: "câmera frontal",
  /** Joins the parts of a card's accessible name ("Pull-ups, 8 reps, needs a bar"). */
  listSeparator: ", ",
};

export default workouts;
