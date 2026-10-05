import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "Lingua",
  languageHint: "Cambia tutte le schermate dell'app",

  // You tab page
  pageTitle: "Profilo",
  pageDescription: "Il tuo wallet, lo stato del Seeker, le impostazioni e come Fitr verifica gli allenamenti e gestisce i tuoi dati.",
  walletHeading: "Wallet",
  settingsHeading: "Impostazioni",
  aboutHeading: "Info su Fitr",

  // Profile header
  profileLabel: "Profilo",
  changePhoto: "Cambia foto profilo",
  addPhoto: "Aggiungi foto profilo",
  photoNotImage: "Scegli un file immagine.",
  photoTooLarge: "Immagine troppo grande.",
  namePlaceholder: "Il tuo nome",
  saveName: "Salva nome",
  addName: "Aggiungi il tuo nome",
  editName: "Modifica nome",
  adjustPhotoTitle: "Regola foto",
  photoMenuTitle: "Foto profilo",
  chooseNewPhoto: "Scegli una nuova foto",
  removePhoto: "Rimuovi foto",
  photoStaysOnDevice: "La tua foto resta su questo dispositivo. Non viene mai caricata.",

  // Avatar crop editor
  cropOpenFailed: "Impossibile aprire l'immagine. Prova con un JPEG o un PNG.",
  cropProcessFailed: "Impossibile elaborare l'immagine.",
  cropClose: "Chiudi",
  cropLoading: "Caricamento foto…",
  cropViewportLabel: "Inquadratura della foto. Trascina o usa le frecce per spostarla, avvicina le dita o usa più e meno per lo zoom.",
  cropZoom: "Zoom",
  cropHint: "Trascina per posizionare. Avvicina le dita o usa il cursore per lo zoom.",
  cropCancel: "Annulla",
  cropSave: "Salva foto",

  // Settings
  remindersTitle: "Promemoria allenamento",
  remindersOff: "Disattivati. Fitr non ti avviserà prima della scadenza di una posta.",
  remindersBlocked: "Le notifiche di Fitr sono bloccate. Tocca l'interruttore per aprire le impostazioni di Android.",
  remindersAllow: "Consenti le notifiche così Fitr può ricordartelo prima della scadenza.",
  remindersOn: "Un avviso 2 ore prima della scadenza della tua posta, e un ultimo richiamo 30 minuti prima.",
  cameraTitle: "Fotocamera predefinita",
  cameraHint: "La fotocamera con cui si apre un allenamento. Puoi comunque cambiarla nella schermata di allenamento.",
  cameraFront: "Frontale",
  cameraBack: "Posteriore",
  hapticsTitle: "Vibrazione",
  hapticsHint: "Una breve vibrazione a ogni ripetizione contata e quando raggiungi l'obiettivo.",
  voiceCoachTitle: "Coach vocale",
  voiceCoachHint: "Conta le ripetizioni ad alta voce e ti dà indicazioni sulla tecnica e sui controlli live, così non devi mai guardare lo schermo.",
  formGuidesTitle: "Guide alla tecnica",
  formGuidesAllShown: "Ogni esercizio mostra la sua guida alla tecnica prima di iniziare.",
  formGuidesHidden_one: "Nascosta per {count} esercizio.",
  formGuidesHidden_other: "Nascoste per {count} esercizi.",
  formGuidesShowAll: "Mostra di nuovo tutte le guide alla tecnica",

  // About links
  websiteTitle: "Sito di Fitr",
  websiteHint: "fitr.day · condividilo con gli amici",
  opensInBrowser: " (si apre nel browser)",
  verificationLinkTitle: "Come funziona la verifica",
  verificationLinkHint: "Cosa controlla Fitr, e cosa non può controllare",
  privacyLinkTitle: "Privacy",
  privacyLinkHint: "Il tuo video non lascia mai il telefono",
  creditsLinkTitle: "Crediti e licenze",
  creditsLinkHint: "Il software open source su cui ci basiamo",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "Fiducia",
  verificationTitle: "Come funziona la verifica",
  verificationDescription:
    "Cosa controlla Fitr prima che un giorno con posta in gioco sia valido, cosa garantisce la blockchain e di cosa devi fidarti.",
  verificationLead:
    "Fitr è progettato per essere resistente agli imbrogli, non a prova di imbroglio. Ecco esattamente cosa viene controllato, da chi, e di cosa ti stai fidando.",
  verificationPhoneHeading: "1. Il tuo telefono conta le ripetizioni",
  verificationPhoneBody:
    "L'AI di postura sul dispositivo individua 33 punti del corpo in ogni fotogramma e conta una ripetizione solo quando le articolazioni compiono l'intero movimento (per esempio, gomiti oltre i 90° in un piegamento). Le mezze ripetizioni compaiono come “non contate”. Tutto avviene sul tuo telefono.",
  verificationServerHeading: "2. Per gli allenamenti con posta in gioco, il server di Fitr ricontrolla",
  verificationServerIntro:
    "Quando ci sono soldi in gioco, mentre ti alleni il telefono invia anche i punti dello scheletro (mai il video) al server di verifica di Fitr. Il server:",
  verificationServerRecount:
    "riconta da sé ogni ripetizione con lo stesso motore di conteggio, quindi non si fida mai solo del tuo telefono;",
  verificationServerChallengesBefore: "ti propone ",
  verificationServerChallengesStrong: "controlli live",
  verificationServerChallengesAfter:
    " in momenti casuali, come “alza la mano destra”, che un video preregistrato non può conoscere in anticipo;",
  verificationServerPlausible:
    "verifica che il movimento sia fisicamente plausibile: le lunghezze delle ossa restano costanti, le articolazioni non si teletrasportano, il ritmo è umano;",
  verificationServerTiming: "controlla i tempi con il proprio orologio e rifiuta una sessione già inviata.",
  verificationServerOutro: "Solo quando tutto questo è superato, il server segna la tua giornata come completata onchain.",
  verificationChainHeading: "3. La blockchain fa rispettare le regole sul denaro",
  verificationChainBody:
    "La tua posta si trova in un programma vault onchain su Solana, non presso Fitr. Il programma fa rispettare le scadenze, un impegno per wallet al giorno, il calcolo dei pagamenti (la tua posta indietro più una quota proporzionale delle poste perse, meno una commissione del 5% presa solo dalle poste perse) e nessuna doppia riscossione. Fitr non può trasferire a sé la tua posta, e se una giornata viene annullata tutti vengono rimborsati.",
  verificationTrustHeading: "Di cosa ti fidi",
  verificationTrustBody:
    "La blockchain non può vedere il tuo allenamento, quindi ti fidi che il server di Fitr lo giudichi in modo equo: che ti segni come completato quando hai fatto il lavoro, e che non segni come completato chi non l'ha fatto. Ogni decisione porta un'impronta della sessione giudicata, così può essere verificata.",
  verificationLimitsBody:
    "Nessun sistema basato sulla fotocamera è impossibile da ingannare. Un imbroglione determinato con un'app modificata o un sosia convincente potrebbe riuscirci. I controlli qui sopra servono a rendere tutto questo difficile, lento e non conveniente rispetto alla posta.",

  // Privacy doc
  privacyEyebrow: "I tuoi dati",
  privacyTitle: "Privacy",
  privacyDescription: "Il tuo video non lascia mai il telefono. Cosa salva Fitr, cosa invia e quando.",
  privacyLeadStrong: "Il video della fotocamera non lascia mai il tuo telefono.",
  privacyLeadRest: " Viene analizzato sul dispositivo, fotogramma per fotogramma, e mai registrato o caricato.",
  privacyFreeHeading: "Allenamenti gratuiti",
  privacyFreeBody:
    "Nessun dato dell'allenamento viene inviato da nessuna parte. Storico, serie, record e premi sono salvati solo in questa app su questo telefono. Cancellando lo storico nella scheda Progressi li elimini.",
  privacyStakedHeading: "Allenamenti con posta in gioco",
  privacyStakedBody:
    "Per verificare un giorno con posta in gioco, il telefono invia al server di verifica di Fitr i punti dello scheletro della sessione: le posizioni di 33 articolazioni nel tempo, più le tue risposte ai controlli live. Niente video, immagini o audio. Il server li usa per controllare le tue ripetizioni e conserva un'impronta della sessione per evitare che lo stesso allenamento venga inviato due volte.",
  privacyWalletHeading: "Il tuo wallet",
  privacyWalletBody:
    "Quando ti colleghi, Fitr vede l'indirizzo pubblico del tuo wallet per mostrarti il saldo e lo stato del Seeker. Le tue chiavi restano nel wallet e ogni transazione la approvi tu. Poste, completamenti e pagamenti sono registrati sulla blockchain di Solana, che è pubblica.",
  privacyThirdPartiesHeading: "Terze parti",
  privacyThirdPartiesBody:
    "L'AI di postura sul dispositivo (Google MediaPipe) può inviare a Google statistiche d'uso anonime sulla libreria stessa. Non contengono video, immagini o punti del corpo.",
  privacySettingsHeading: "Impostazioni",
  privacySettingsBody: "Le tue preferenze su fotocamera, vibrazione e guide alla tecnica sono salvate solo su questo telefono.",

  // Credits doc
  creditsEyebrow: "Grazie",
  creditsTitle: "Crediti e licenze",
  creditsDescription: "Il software open source, i font e i media con cui è costruito Fitr.",
  creditsIntro: "Fitr è costruito su software open source. Grazie a tutti quelli che lo realizzano.",
  creditsClipsHeading: "Video delle guide alla tecnica",
  creditsClipLabel: "Dimostrazione di {exercise} di {author}",

  // Root layout
  skipToContent: "Vai al contenuto",
  appDescription:
    "Fitr conta i tuoi piegamenti, squat e plank con il rilevamento della postura tramite AI sul dispositivo. Ogni ripetizione è controllata dagli angoli delle articolazioni, e il tuo video non lascia mai il telefono.",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "Ancora {left}: {goal}",
  nativeReminderTitle: "Ancora {left} per allenarti",
  nativeReminderBodyStake: "Finisci oggi o la tua posta di {stake} andrà a chi si è presentato.",
  nativeReminderBody: "Completa l'allenamento di oggi prima della scadenza.",
};

export default you;
