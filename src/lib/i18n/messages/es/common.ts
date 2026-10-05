import type { NsMessages } from "../types";

const common: Partial<NsMessages<"common">> = {
  back: "Atrás",
  close: "Cerrar",
  loading: "Cargando…",
  notFoundMetaTitle: "No encontrado",
  notFoundTitle: "Esta página se saltó el día de pierna",
  notFoundText: "No encontramos lo que buscabas.",
  notFoundCta: "Volver a Hoy",
  offlineMetaTitle: "Sin conexión",
  offlineTitle: "Estás sin conexión",
  offlineBody: "Esta pantalla aún no está guardada en este dispositivo. Vuelve a conectarte e inténtalo de nuevo.",
  offlineNote: "Las pantallas que ya abriste siguen disponibles sin conexión, y el seguimiento de postura siempre funciona en tu teléfono.",
  tryAgain: "Reintentar",
  home: "Inicio",
};

export default common;
