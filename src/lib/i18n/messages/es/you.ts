import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "Idioma",
  languageHint: "Cambia todas las pantallas de la app",

  // You tab page
  pageTitle: "Tú",
  pageDescription: "Tu billetera, el estado de tu Seeker, los ajustes, y cómo Fitr verifica los entrenamientos y trata tus datos.",
  walletHeading: "Billetera",
  settingsHeading: "Ajustes",
  aboutHeading: "Acerca de Fitr",

  // Profile header
  profileLabel: "Perfil",
  changePhoto: "Cambiar foto de perfil",
  addPhoto: "Añadir foto de perfil",
  photoNotImage: "Elige un archivo de imagen.",
  photoTooLarge: "Esa imagen es demasiado grande.",
  namePlaceholder: "Tu nombre",
  saveName: "Guardar nombre",
  addName: "Añade tu nombre",
  editName: "Editar nombre",
  adjustPhotoTitle: "Ajustar foto",
  photoMenuTitle: "Foto de perfil",
  chooseNewPhoto: "Elegir otra foto",
  removePhoto: "Quitar foto",
  photoStaysOnDevice: "Tu foto se queda en este dispositivo. Nunca se sube.",

  // Avatar crop editor
  cropOpenFailed: "No se pudo abrir esa imagen. Prueba con un JPEG o PNG.",
  cropProcessFailed: "No se pudo procesar esa imagen.",
  cropClose: "Cerrar",
  cropLoading: "Cargando foto…",
  cropViewportLabel: "Encuadre de la foto. Arrastra o usa las flechas para moverla; pellizca o usa más y menos para hacer zoom.",
  cropZoom: "Zoom",
  cropHint: "Arrastra para colocarla. Pellizca o usa el control deslizante para hacer zoom.",
  cropCancel: "Cancelar",
  cropSave: "Guardar foto",

  // Settings
  remindersTitle: "Recordatorios para entrenar",
  remindersOff: "Desactivados. Fitr no te avisará antes del plazo de un depósito.",
  remindersBlocked: "Las notificaciones de Fitr están bloqueadas. Toca el interruptor para abrir los ajustes de Android.",
  remindersAllow: "Permite las notificaciones para que Fitr te avise antes de tu plazo.",
  remindersOn: "Un aviso 2 horas antes del plazo de tu depósito y un último aviso 30 minutos antes.",
  cameraTitle: "Cámara predeterminada",
  cameraHint: "La cámara con la que se abre un entrenamiento. Puedes cambiarla en la pantalla del entrenamiento.",
  cameraFront: "Frontal",
  cameraBack: "Trasera",
  hapticsTitle: "Vibración",
  hapticsHint: "Una vibración corta en cada repetición contada y al alcanzar tu meta.",
  voiceCoachTitle: "Entrenador de voz",
  voiceCoachHint: "Cuenta tus repeticiones en voz alta y te avisa de la técnica y los controles en vivo, para que nunca tengas que mirar la pantalla.",
  formGuidesTitle: "Guías de técnica",
  formGuidesAllShown: "Cada ejercicio muestra su guía de técnica antes de empezar.",
  formGuidesHidden_one: "Oculta en {count} ejercicio.",
  formGuidesHidden_other: "Ocultas en {count} ejercicios.",
  formGuidesShowAll: "Volver a mostrar todas las guías",

  // About links
  websiteTitle: "Web de Fitr",
  websiteHint: "fitr.day · compártela con tus amigos",
  opensInBrowser: " (se abre en tu navegador)",
  verificationLinkTitle: "Cómo funciona la verificación",
  verificationLinkHint: "Qué revisa Fitr y qué no puede revisar",
  privacyLinkTitle: "Privacidad",
  privacyLinkHint: "Tu video nunca sale de tu teléfono",
  creditsLinkTitle: "Créditos y licencias",
  creditsLinkHint: "El software de código abierto en el que nos basamos",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "Confianza",
  verificationTitle: "Cómo funciona la verificación",
  verificationDescription:
    "Qué revisa Fitr antes de que cuente un día con depósito, qué impone la blockchain y en qué tienes que confiar.",
  verificationLead:
    "Fitr está diseñado para ser resistente a las trampas, no a prueba de trampas. Esto es exactamente lo que se revisa, quién lo revisa y en qué estás confiando.",
  verificationPhoneHeading: "1. Tu teléfono cuenta las repeticiones",
  verificationPhoneBody:
    "La IA de postura del dispositivo detecta 33 puntos del cuerpo en cada fotograma y solo cuenta una repetición cuando tus articulaciones recorren todo el rango (por ejemplo, codos más allá de 90° en una flexión). Las repeticiones a medias se muestran como “sin contar”. Todo esto ocurre en tu teléfono.",
  verificationServerHeading: "2. En los entrenamientos con depósito, el servidor de Fitr vuelve a revisar",
  verificationServerIntro:
    "Cuando hay dinero en juego, tu teléfono también envía los puntos del esqueleto (nunca video) al servidor de verificación de Fitr mientras entrenas. El servidor:",
  verificationServerRecount:
    "vuelve a contar cada repetición con el mismo motor de conteo, así que nunca se fía solo de tu teléfono;",
  verificationServerChallengesBefore: "te propone ",
  verificationServerChallengesStrong: "retos en vivo",
  verificationServerChallengesAfter:
    " en momentos aleatorios, como “levanta la mano derecha”, que un video pregrabado no puede conocer de antemano;",
  verificationServerPlausible:
    "comprueba que el movimiento sea físicamente posible: los huesos mantienen su longitud, las articulaciones no se teletransportan y el ritmo es humano;",
  verificationServerTiming: "compara los tiempos con su propio reloj y rechaza una sesión que ya se haya enviado.",
  verificationServerOutro: "Solo cuando todo eso se cumple, el servidor marca tu día como completado onchain.",
  verificationChainHeading: "3. La blockchain impone las reglas del dinero",
  verificationChainBody:
    "Tu depósito está en un programa de bóveda onchain en Solana, no en manos de Fitr. El programa hace cumplir los plazos, un compromiso por billetera y día, el cálculo de pagos (tu depósito de vuelta más una parte proporcional de los depósitos perdidos, menos una comisión del 5% que solo se aplica a lo perdido) y que no haya reclamos dobles. Fitr no puede transferirse tu depósito, y si un día se anula, a todos se les devuelve.",
  verificationTrustHeading: "En qué estás confiando",
  verificationTrustBody:
    "La blockchain no puede ver tu entrenamiento, así que confías en que el servidor de Fitr lo juzgue con justicia: que te marque como completado cuando hiciste el trabajo y que no marque a nadie que no lo hizo. Cada decisión lleva una huella de la sesión que juzgó, para que se pueda auditar.",
  verificationLimitsBody:
    "Ningún sistema basado en cámara es imposible de engañar. Alguien muy decidido a hacer trampa, con una app modificada o un doble convincente, podría colarse. Las comprobaciones de arriba existen para que eso sea difícil, lento y no compense el depósito.",

  // Privacy doc
  privacyEyebrow: "Tus datos",
  privacyTitle: "Privacidad",
  privacyDescription: "Tu video nunca sale de tu teléfono. Qué guarda Fitr, qué envía y cuándo.",
  privacyLeadStrong: "El video de tu cámara nunca sale de tu teléfono.",
  privacyLeadRest: " Se analiza en el dispositivo, fotograma a fotograma, y nunca se graba ni se sube.",
  privacyFreeHeading: "Entrenamientos gratis",
  privacyFreeBody:
    "No se envía nada del entrenamiento a ningún sitio. Tu historial, rachas, récords y logros se guardan solo en esta app, en este teléfono. Si borras tu historial en la pestaña Progreso, se eliminan.",
  privacyStakedHeading: "Entrenamientos con depósito",
  privacyStakedBody:
    "Para verificar un día con depósito, tu teléfono envía al servidor de verificación de Fitr los puntos del esqueleto de la sesión: las posiciones de 33 articulaciones a lo largo del tiempo, más tus respuestas a los retos en vivo. Sin video, sin imágenes, sin audio. El servidor los usa para revisar tus repeticiones y guarda una huella de la sesión para evitar que el mismo entrenamiento se envíe dos veces.",
  privacyWalletHeading: "Tu billetera",
  privacyWalletBody:
    "Fitr ve la dirección pública de tu billetera al conectarte, para mostrar tu saldo y el estado de tu Seeker. Tus claves se quedan en tu billetera y cada transacción la apruebas tú. Los depósitos, las verificaciones y los pagos se registran en la blockchain de Solana, que es pública.",
  privacyThirdPartiesHeading: "Terceros",
  privacyThirdPartiesBody:
    "La IA de postura del dispositivo (Google MediaPipe) puede enviar a Google estadísticas de uso anónimas sobre la propia biblioteca. No contienen video, imágenes ni puntos del cuerpo.",
  privacySettingsHeading: "Ajustes",
  privacySettingsBody: "Tus preferencias de cámara, vibración y guías de técnica se guardan solo en este teléfono.",

  // Credits doc
  creditsEyebrow: "Gracias",
  creditsTitle: "Créditos y licencias",
  creditsDescription: "El software de código abierto, las fuentes y los recursos con los que está hecho Fitr.",
  creditsIntro: "Fitr está hecho con software de código abierto. Gracias a todas las personas que lo hacen posible.",
  creditsClipsHeading: "Videos de las guías de técnica",
  creditsClipLabel: "Demostración de {exercise} por {author}",

  // Root layout
  skipToContent: "Saltar al contenido",
  appDescription:
    "Fitr cuenta tus flexiones, sentadillas y planchas con seguimiento de postura por IA en el dispositivo. Cada repetición se revisa por los ángulos de las articulaciones, y tu video nunca sale de tu teléfono.",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "Quedan {left}: {goal}",
  nativeReminderTitle: "Quedan {left} para entrenar",
  nativeReminderBodyStake: "Termina hoy o tu depósito de {stake} irá para quienes cumplieron.",
  nativeReminderBody: "Termina el entrenamiento de hoy antes del plazo.",
  builtBy: "Creado por",
};

export default you;
