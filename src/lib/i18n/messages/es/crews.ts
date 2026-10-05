import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "En solitario",
  unnamedCrew: "Grupo {suffix}",
  challengeFree: "Cada uno elige su entrenamiento",
  challengeFixedGoal: "{goal} para todos",
  challengeFixedExercise: "{exercise}, cada uno fija su meta",
  inviteShareText: "Únete a mi grupo de Fitr “{name}”. {challenge}. Deposita SKR como garantía de que entrenarás: quienes fallan financian a quienes cumplen.",
  inviteShareTitle: "{name} en Fitr",

  // Page metadata
  metaTitle: "Grupo",
  metaDescription: "Tu grupo de Fitr: el reto de hoy, quién cumplió, la racha del grupo y la clasificación.",

  // Crew hub (Commit tab)
  yourCrewsTitle: "Tus grupos",
  lookingForCrews: "Buscando tus grupos…",
  crewsLoadError: "No se pudieron cargar tus grupos ahora mismo. Inténtalo de nuevo en un momento.",
  noCrewsYet: "Aún no tienes grupos. Crea uno abajo y comparte el enlace, o abre una invitación de un amigo.",
  yoursTag: "Tuyo",
  joinTitle: "Únete a un grupo",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "Enlace de invitación o número del grupo",
  joinOpen: "Abrir",
  joinInvalid: "Pega un enlace de invitación como fitr.day/c/123… o el número del grupo.",

  // Create a crew
  createTitle: "Crea un grupo",
  createHint:
    "Tu grupo tiene su propio fondo: quienes fallan financian a los miembros que cumplen. Si nadie cumple un día, los depósitos pasan al siguiente día en que alguien cumpla.",
  crewNameLabel: "Nombre del grupo",
  crewNamePlaceholder: "Madrugadores",
  crewNameEmpty: "Ponle un nombre a tu grupo.",
  crewNameChars: "Usa solo letras, números y emoji.",
  crewNameTooLong: "Ese nombre es demasiado largo (máx. 32 bytes).",
  sameExerciseToggle: "Todos hacen el mismo ejercicio",
  sameGoalToggle: "La misma meta para todos",
  createNeedsSol:
    "Crear un grupo requiere unos {needed} para la renta de la cuenta y la comisión de red. Esta billetera tiene {balance}.",
  createPaused: "La creación de grupos está en pausa por mantenimiento.",
  working: "Procesando…",
  createButton: "Crear grupo",
  createFine:
    "Una firma · unos {rent} de renta de cuenta (no reembolsable). Crear un grupo no te da poderes especiales sobre él: las mismas reglas onchain se aplican a todos.",
  createTimeout: "Tu billetera la envió, pero la red aún no la ha confirmado. Revisa el explorador y actualiza.",
  createFailedOnchain: "No se pudo crear el grupo onchain. Solo se cobró la comisión de red.",
  vaultReadError: "No se pudo leer la bóveda",

  // Commitments across pools
  commitmentsTodayTitle: "Tus compromisos de hoy",
  goalFallback: "Meta",
  forTomorrow: "mañana",
  tagToDo: "Pendiente",
  tagVerifying: "Verificando",
  tagVerified: "Verificado",
  tagClaim: "Reclamar",
  tagMissed: "No cumplido",
  tagWithdrawn: "Retirado",
  tagCommitted: "Comprometido",

  // Crew page
  eyebrowCrew: "Grupo",
  eyebrowCommitTogether: "Comprométete en grupo",
  loadingCrew: "Cargando el grupo",
  notFoundTitle: "Grupo no encontrado",
  notFoundBody: "No encontramos este grupo onchain. Revisa el enlace de invitación; puede que los depósitos aún no estén abiertos.",
  goToCommit: "Ir a Compromiso",
  unreachableTitle: "No se puede acceder a la bóveda",
  unreachableBody: "No pudimos leer este grupo. Revisa tu conexión e inténtalo de nuevo.",
  tryAgain: "Reintentar",
  connectToCommit: "Conecta tu billetera para comprometerte con el grupo. Tú firmas cada depósito.",
  seekerOnly:
    "Los depósitos son solo para Seeker: esta billetera no tiene un Seeker Genesis Token. Aun así puedes seguir al grupo y entrenar.",
  checkSeekerAgain: "Volver a comprobar mi Seeker",
  checkingSeeker: "Comprobando tu Seeker…",
  deletedTitle: "Este grupo se eliminó",
  deletedBody:
    "Su creador lo eliminó de Fitr, así que ya nadie puede unirse ni depositar en él. Si depositaste aquí, aún puedes reclamar abajo.",
  todaysChallenge: "El reto de hoy",
  ownWorkoutOwnGoal: "Tu entrenamiento, tu meta",
  sameGoalSentence: "La misma meta para todos.",
  challengeSentence: "{challenge}.",
  challengeRules:
    "Quienes fallan financian a los miembros que cumplen. Si nadie cumple, los depósitos pasan al siguiente día del grupo que alguien complete.",
  statStreak: "Racha del grupo",
  statVerifiedToday: "Verificados hoy",
  statMembers: "Miembros",
  todayTitle: "Hoy",
  dayLoadError: "No se pudo cargar el día del grupo. Se actualizará solo.",
  loading: "Cargando…",
  nobodyCommitted: "Nadie se ha comprometido hoy todavía. Sé el primero y comparte el enlace.",
  you: "Tú",
  streakExplainer: "La racha del grupo cuenta los días en que todos los que se comprometieron quedaron verificados.",
  streakExplainerBest: "La racha del grupo cuenta los días en que todos los que se comprometieron quedaron verificados (mejor: {best}).",
  yourStakeTitle: "Tu depósito",
  leaderboardTitle: "Clasificación",
  leaderboardLabel: "Clasificación del grupo",
  leaderboardEmpty: "La clasificación se llena tras el primer día verificado.",
  leaderDays_one: "{count} día verificado · racha {streak}",
  leaderDays_other: "{count} días verificados · racha {streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "bonificación",
  bonusExplainer:
    "La bonificación es lo que los miembros recibieron además de recuperar su depósito, de los miembros que no cumplieron (Fitr solo cobra una comisión del {fee}% sobre lo perdido). Las cantidades en {token} vienen de los perfiles onchain del grupo.",
  rolloverNote: "Se acumula: {amount} de días del grupo que nadie completó pasan al siguiente día que alguien complete.",

  // Invite actions
  inviteButton: "Invitar",
  copyButton: "Copiar",
  copiedButton: "Copiado",
  copyInviteLink: "Copiar enlace de invitación",
  inviteLinkCopied: "Enlace de invitación copiado",
  inviteLinkLabel: "Enlace de invitación",

  // Delete crew
  deleteButton: "Eliminar grupo",
  deleteConfirmTitle: "¿Eliminar {name}?",
  deleteConfirmBody:
    "Desaparece de Fitr y su enlace de invitación deja de funcionar. Ya nadie podrá unirse ni depositar en él. Quien ya haya depositado aún puede reclamar. Tu billetera firma un mensaje para demostrar que lo creaste: sin transacción ni comisión.",
  keepIt: "Conservar",
  deleting: "Eliminando…",
  deleteCancelled: "Cancelado en tu billetera. No cambió nada.",
  deleteFailed: "No se pudo eliminar el grupo. Inténtalo de nuevo.",
  deleteFailedStatus: "No se pudo eliminar el grupo ({status}).",
};

export default crews;
