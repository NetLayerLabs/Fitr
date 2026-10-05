import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "Solo",
  unnamedCrew: "Équipe {suffix}",
  challengeFree: "Chacun choisit sa séance",
  challengeFixedGoal: "{goal} pour tout le monde",
  challengeFixedExercise: "{exercise}, chacun fixe son objectif",
  inviteShareText: "Rejoins mon équipe Fitr « {name} ». {challenge}. Mise des SKR sur ta présence : les absents financent ceux qui sont au rendez-vous.",
  inviteShareTitle: "{name} sur Fitr",

  // Page metadata
  metaTitle: "Équipe",
  metaDescription: "Ton équipe Fitr : le défi du jour, qui était au rendez-vous, la série de l’équipe et le classement.",

  // Crew hub (Commit tab)
  yourCrewsTitle: "Tes équipes",
  lookingForCrews: "Recherche de tes équipes…",
  crewsLoadError: "Impossible de charger tes équipes pour le moment. Réessaie dans un instant.",
  noCrewsYet: "Pas encore d’équipe. Crées-en une ci-dessous et partage le lien, ou ouvre l’invitation d’un ami.",
  yoursTag: "À toi",
  joinTitle: "Rejoindre une équipe",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "Lien d’invitation ou numéro d’équipe",
  joinOpen: "Ouvrir",
  joinInvalid: "Colle un lien d’invitation comme fitr.day/c/123… ou le numéro de l’équipe.",

  // Create a crew
  createTitle: "Créer une équipe",
  createHint:
    "Ton équipe a sa propre cagnotte : les absents financent les membres qui sont au rendez-vous. Si personne n’est au rendez-vous un jour, les mises sont reportées au prochain jour où quelqu’un l’est.",
  crewNameLabel: "Nom de l’équipe",
  crewNamePlaceholder: "Les Lève-tôt",
  crewNameEmpty: "Donne un nom à ton équipe.",
  crewNameChars: "Utilise uniquement des lettres, des chiffres et des emoji.",
  crewNameTooLong: "Ce nom est trop long (32 octets max).",
  sameExerciseToggle: "Tout le monde fait le même exercice",
  sameGoalToggle: "Même objectif pour tout le monde",
  createNeedsSol:
    "Créer une équipe nécessite environ {needed} pour le loyer du compte et les frais de réseau. Ce wallet contient {balance}.",
  createPaused: "La création d’équipes est suspendue pour maintenance.",
  working: "En cours…",
  createButton: "Créer l’équipe",
  createFine:
    "Une signature · environ {rent} de loyer de compte (non remboursé). Créer une équipe ne te donne aucun pouvoir particulier dessus : les mêmes règles onchain s’appliquent à tous.",
  createTimeout: "Ton wallet l’a envoyée, mais le réseau ne l’a pas encore confirmée. Vérifie l’explorateur, puis actualise.",
  createFailedOnchain: "La création de l’équipe a échoué onchain. Seuls les frais de réseau ont été prélevés.",
  vaultReadError: "Impossible de lire le coffre",

  // Commitments across pools
  commitmentsTodayTitle: "Tes engagements du jour",
  goalFallback: "Objectif",
  forTomorrow: "demain",
  tagToDo: "À faire",
  tagVerifying: "Vérification",
  tagVerified: "Validé",
  tagClaim: "À récupérer",
  tagMissed: "Manqué",
  tagWithdrawn: "Retiré",
  tagCommitted: "Engagé",

  // Crew page
  eyebrowCrew: "Équipe",
  eyebrowCommitTogether: "S’engager ensemble",
  loadingCrew: "Chargement de l’équipe",
  notFoundTitle: "Équipe introuvable",
  notFoundBody: "Impossible de trouver cette équipe onchain. Vérifie le lien d’invitation ; le staking n’est peut-être pas encore ouvert.",
  goToCommit: "Aller à Engagement",
  unreachableTitle: "Coffre injoignable",
  unreachableBody: "Impossible de lire cette équipe. Vérifie ta connexion et réessaie.",
  tryAgain: "Réessayer",
  connectToCommit: "Connecte ton wallet pour t’engager avec l’équipe. Tu signes chaque mise toi-même.",
  seekerOnly:
    "Le staking est réservé au Seeker : ce wallet ne détient pas de Seeker Genesis Token. Tu peux quand même suivre l’équipe et t’entraîner.",
  checkSeekerAgain: "Revérifier mon Seeker",
  checkingSeeker: "Vérification de ton Seeker…",
  deletedTitle: "Cette équipe a été supprimée",
  deletedBody:
    "Son créateur l’a retirée de Fitr : plus personne ne peut la rejoindre ni y miser. Si tu as misé ici, tu peux toujours récupérer ta mise ci-dessous.",
  todaysChallenge: "Défi du jour",
  ownWorkoutOwnGoal: "Ta séance, ton objectif",
  sameGoalSentence: "Même objectif pour tout le monde.",
  challengeSentence: "{challenge}.",
  challengeRules:
    "Les absents financent les membres de l’équipe qui sont au rendez-vous. Si personne n’est au rendez-vous, les mises sont reportées au prochain jour d’équipe réussi.",
  statStreak: "Série de l’équipe",
  statVerifiedToday: "Validés aujourd’hui",
  statMembers: "Membres",
  todayTitle: "Aujourd’hui",
  dayLoadError: "Impossible de charger la journée de l’équipe. Elle s’actualise toute seule.",
  loading: "Chargement…",
  nobodyCommitted: "Personne ne s’est encore engagé aujourd’hui. Sois le premier, puis partage le lien.",
  you: "Toi",
  streakExplainer: "La série de l’équipe compte les jours où tous ceux qui se sont engagés ont été validés.",
  streakExplainerBest: "La série de l’équipe compte les jours où tous ceux qui se sont engagés ont été validés (record : {best}).",
  yourStakeTitle: "Ta mise",
  leaderboardTitle: "Classement",
  leaderboardLabel: "Classement de l’équipe",
  leaderboardEmpty: "Le classement se remplit après le premier jour validé.",
  leaderDays_one: "{count} jour validé · série {streak}",
  leaderDays_other: "{count} jours validés · série {streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "bonus",
  bonusExplainer:
    "Le bonus, c’est ce que les membres ont reçu en plus de leur propre mise, venant des membres de l’équipe qui ont manqué (Fitr prélève {fee} % de frais uniquement sur les mises perdues). Les montants en {token} viennent des profils onchain de l’équipe.",
  rolloverNote: "Report : {amount} des jours d’équipe que personne n’a réussis iront au prochain jour d’équipe réussi.",

  // Invite actions
  inviteButton: "Inviter",
  copyButton: "Copier",
  copiedButton: "Copié",
  copyInviteLink: "Copier le lien d’invitation",
  inviteLinkCopied: "Lien d’invitation copié",
  inviteLinkLabel: "Lien d’invitation",

  // Delete crew
  deleteButton: "Supprimer l’équipe",
  deleteConfirmTitle: "Supprimer {name} ?",
  deleteConfirmBody:
    "Elle disparaît de Fitr et son lien d’invitation cesse de fonctionner. Plus personne ne peut la rejoindre ni y miser. Ceux qui ont déjà misé peuvent toujours récupérer leur mise. Ton wallet signe un message pour prouver que tu l’as créée : pas de transaction, pas de frais.",
  keepIt: "La garder",
  deleting: "Suppression…",
  deleteCancelled: "Annulé dans ton wallet. Rien n’a changé.",
  deleteFailed: "Impossible de supprimer l’équipe. Réessaie.",
  deleteFailedStatus: "Impossible de supprimer l’équipe ({status}).",
};

export default crews;
