import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "Langue",
  languageHint: "Change tous les écrans de l’appli",

  // You tab page
  pageTitle: "Toi",
  pageDescription: "Ton wallet, ton statut Seeker, tes réglages, et comment Fitr vérifie les séances et gère tes données.",
  walletHeading: "Wallet",
  settingsHeading: "Réglages",
  aboutHeading: "À propos de Fitr",

  // Profile header
  profileLabel: "Profil",
  changePhoto: "Changer la photo de profil",
  addPhoto: "Ajouter une photo de profil",
  photoNotImage: "Choisis un fichier image.",
  photoTooLarge: "Cette image est trop lourde.",
  namePlaceholder: "Ton nom",
  saveName: "Enregistrer le nom",
  addName: "Ajoute ton nom",
  editName: "Modifier le nom",
  adjustPhotoTitle: "Ajuster la photo",
  photoMenuTitle: "Photo de profil",
  chooseNewPhoto: "Choisir une nouvelle photo",
  removePhoto: "Supprimer la photo",
  photoStaysOnDevice: "Ta photo reste sur cet appareil. Elle n’est jamais envoyée.",

  // Avatar crop editor
  cropOpenFailed: "Impossible d’ouvrir cette image. Essaie un JPEG ou un PNG.",
  cropProcessFailed: "Impossible de traiter cette image.",
  cropClose: "Fermer",
  cropLoading: "Chargement de la photo…",
  cropViewportLabel: "Cadrage de la photo. Fais glisser ou utilise les flèches pour déplacer, pince ou utilise plus et moins pour zoomer.",
  cropZoom: "Zoom",
  cropHint: "Fais glisser pour positionner. Pince ou utilise le curseur pour zoomer.",
  cropCancel: "Annuler",
  cropSave: "Enregistrer la photo",

  // Settings
  remindersTitle: "Rappels de pointage",
  remindersOff: "Désactivés. Fitr ne te relancera pas avant la limite d’une mise.",
  remindersBlocked: "Les notifications sont bloquées pour Fitr. Appuie sur l’interrupteur pour ouvrir les réglages Android.",
  remindersAllow: "Autorise les notifications pour que Fitr te rappelle ta limite.",
  remindersOn: "Un rappel 2 heures avant la limite de ta mise, et un dernier appel 30 minutes avant.",
  cameraTitle: "Caméra par défaut",
  cameraHint: "La caméra utilisée à l’ouverture d’une séance. Tu peux toujours la changer sur l’écran de séance.",
  cameraFront: "Avant",
  cameraBack: "Arrière",
  hapticsTitle: "Vibrations",
  hapticsHint: "Une courte vibration à chaque répétition comptée et quand tu atteins ton objectif.",
  voiceCoachTitle: "Coach vocal",
  voiceCoachHint: "Compte tes répétitions à voix haute et annonce les conseils de posture et les vérifs en direct : plus besoin de lire l’écran.",
  formGuidesTitle: "Guides d’exécution",
  formGuidesAllShown: "Chaque exercice affiche son guide d’exécution avant de commencer.",
  formGuidesHidden_one: "Masqué pour {count} exercice.",
  formGuidesHidden_other: "Masqués pour {count} exercices.",
  formGuidesShowAll: "Réafficher tous les guides d’exécution",

  // About links
  websiteTitle: "Site web de Fitr",
  websiteHint: "fitr.day · partage-le avec tes amis",
  opensInBrowser: " (s’ouvre dans ton navigateur)",
  verificationLinkTitle: "Comment fonctionne la vérification",
  verificationLinkHint: "Ce que Fitr vérifie, et ce qu’il ne peut pas vérifier",
  privacyLinkTitle: "Confidentialité",
  privacyLinkHint: "Ta vidéo ne quitte jamais ton téléphone",
  creditsLinkTitle: "Crédits et licences",
  creditsLinkHint: "Les logiciels open source sur lesquels on s’appuie",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "Confiance",
  verificationTitle: "Comment fonctionne la vérification",
  verificationDescription:
    "Ce que Fitr vérifie avant qu’une journée avec mise compte, ce que la blockchain impose, et ce à quoi tu dois faire confiance.",
  verificationLead:
    "Fitr est conçu pour résister à la triche, pas pour la rendre impossible. Voici exactement ce qui est vérifié, par qui, et à quoi tu fais confiance.",
  verificationPhoneHeading: "1. Ton téléphone compte les répétitions",
  verificationPhoneBody:
    "Une IA de suivi des mouvements embarquée repère 33 points du corps sur chaque image de la caméra et ne compte une répétition que si tes articulations parcourent toute l’amplitude (par exemple, coudes sous 90° sur une pompe). Les demi-répétitions s’affichent « non comptées ». Tout se passe sur ton téléphone.",
  verificationServerHeading: "2. Pour les séances avec mise, le serveur de Fitr revérifie",
  verificationServerIntro:
    "Quand de l’argent est en jeu, ton téléphone envoie aussi les points du squelette (jamais la vidéo) au serveur de vérification de Fitr pendant ta séance. Le serveur :",
  verificationServerRecount:
    "recompte lui-même chaque répétition avec le même moteur de comptage, sans jamais se fier à ton téléphone ;",
  verificationServerChallengesBefore: "te lance des ",
  verificationServerChallengesStrong: "défis en direct",
  verificationServerChallengesAfter:
    " à des moments aléatoires, comme « lève la main droite », qu’une vidéo préenregistrée ne peut pas anticiper ;",
  verificationServerPlausible:
    "vérifie que le mouvement est physiquement plausible : la longueur des os reste constante, les articulations ne se téléportent pas, le rythme est humain ;",
  verificationServerTiming: "contrôle le timing avec sa propre horloge et rejette une séance déjà soumise.",
  verificationServerOutro: "C’est seulement quand tout ça est validé que le serveur marque ta journée comme réussie onchain.",
  verificationChainHeading: "3. La blockchain fait respecter les règles financières",
  verificationChainBody:
    "Ta mise est dans un programme de coffre onchain sur Solana, pas chez Fitr. Le programme impose les délais, un engagement par wallet et par jour, le calcul des paiements (ta mise rendue plus une part au prorata des mises perdues, moins 5 % de frais prélevés uniquement sur les mises perdues) et l’absence de double récupération. Fitr ne peut pas s’attribuer ta mise, et si une journée est annulée, tout le monde est remboursé.",
  verificationTrustHeading: "Ce à quoi tu fais confiance",
  verificationTrustBody:
    "La blockchain ne voit pas ta séance : tu fais donc confiance au serveur de Fitr pour la juger équitablement, c’est-à-dire te valider quand tu as fait l’effort, et ne valider personne qui ne l’a pas fait. Chaque décision porte une empreinte de la séance jugée, ce qui permet de l’auditer.",
  verificationLimitsBody:
    "Aucun système basé sur une caméra n’est infaillible. Un tricheur déterminé avec une appli modifiée ou une doublure convaincante pourrait passer. Les contrôles ci-dessus sont là pour rendre ça difficile, lent et pas rentable par rapport à la mise.",

  // Privacy doc
  privacyEyebrow: "Tes données",
  privacyTitle: "Confidentialité",
  privacyDescription: "Ta vidéo ne quitte jamais ton téléphone. Ce que Fitr stocke, ce qu’il envoie, et quand.",
  privacyLeadStrong: "La vidéo de ta caméra ne quitte jamais ton téléphone.",
  privacyLeadRest: " Elle est analysée sur l’appareil, image par image, et n’est jamais enregistrée ni envoyée.",
  privacyFreeHeading: "Séances libres",
  privacyFreeBody:
    "Rien de la séance n’est envoyé nulle part. Ton historique, tes séries, tes records et tes trophées sont enregistrés uniquement dans cette appli, sur ce téléphone. Effacer ton historique dans l’onglet Progrès les supprime.",
  privacyStakedHeading: "Séances avec mise",
  privacyStakedBody:
    "Pour vérifier une journée avec mise, ton téléphone envoie au serveur de vérification de Fitr les points du squelette de la séance : les positions de 33 articulations dans le temps, plus tes réponses aux défis en direct. Pas de vidéo, pas d’images, pas de son. Le serveur s’en sert pour vérifier tes répétitions et garde une empreinte de la séance pour empêcher qu’elle soit soumise deux fois.",
  privacyWalletHeading: "Ton wallet",
  privacyWalletBody:
    "Fitr voit l’adresse publique de ton wallet quand tu te connectes, pour afficher ton solde et ton statut Seeker. Tes clés restent dans ton wallet, et chaque transaction est validée par toi. Les mises, validations et paiements sont enregistrés sur la blockchain Solana, qui est publique.",
  privacyThirdPartiesHeading: "Services tiers",
  privacyThirdPartiesBody:
    "L’IA de suivi des mouvements embarquée (Google MediaPipe) peut envoyer à Google des statistiques d’utilisation anonymes sur la bibliothèque elle-même. Elles ne contiennent ni vidéo, ni images, ni points du corps.",
  privacySettingsHeading: "Réglages",
  privacySettingsBody: "Tes préférences de caméra, de vibrations et de guides d’exécution sont stockées uniquement sur ce téléphone.",

  // Credits doc
  creditsEyebrow: "Merci",
  creditsTitle: "Crédits et licences",
  creditsDescription: "Les logiciels open source, polices et médias avec lesquels Fitr est construit.",
  creditsIntro: "Fitr repose sur des logiciels open source. Merci à toutes celles et ceux qui les font vivre.",
  creditsClipsHeading: "Vidéos des guides d’exécution",
  creditsClipLabel: "Démo {exercise} par {author}",

  // Root layout
  skipToContent: "Aller au contenu",
  appDescription:
    "Fitr compte tes pompes, squats et gainages grâce au suivi des mouvements par IA sur l’appareil. Chaque répétition est vérifiée par les angles des articulations, et ta vidéo ne quitte jamais ton téléphone.",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "Encore {left} : {goal}",
  nativeReminderTitle: "Encore {left} pour pointer",
  nativeReminderBodyStake: "Termine aujourd’hui, sinon ta mise de {stake} ira à ceux qui étaient au rendez-vous.",
  nativeReminderBody: "Termine ta séance du jour avant la limite.",
};

export default you;
