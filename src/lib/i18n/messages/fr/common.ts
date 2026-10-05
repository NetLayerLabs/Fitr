import type { NsMessages } from "../types";

const common: Partial<NsMessages<"common">> = {
  back: "Retour",
  close: "Fermer",
  loading: "Chargement…",
  notFoundMetaTitle: "Introuvable",
  notFoundTitle: "Cette page a séché la séance jambes",
  notFoundText: "On n’a pas trouvé ce que tu cherches.",
  notFoundCta: "Retour à Aujourd’hui",
  offlineMetaTitle: "Hors ligne",
  offlineTitle: "Tu es hors ligne",
  offlineBody: "Cet écran n’est pas encore enregistré sur cet appareil. Reconnecte-toi, puis réessaie.",
  offlineNote: "Les écrans déjà ouverts restent disponibles hors ligne, et le suivi des mouvements tourne toujours sur ton téléphone.",
  tryAgain: "Réessayer",
  home: "Accueil",
};

export default common;
