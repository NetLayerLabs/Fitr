import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "Sprache",
  languageHint: "Ändert alle Ansichten der App",

  // You tab page
  pageTitle: "Du",
  pageDescription: "Deine Wallet, dein Seeker-Status, Einstellungen und wie Fitr Workouts prüft und mit deinen Daten umgeht.",
  walletHeading: "Wallet",
  settingsHeading: "Einstellungen",
  aboutHeading: "Über Fitr",

  // Profile header
  profileLabel: "Profil",
  changePhoto: "Profilfoto ändern",
  addPhoto: "Profilfoto hinzufügen",
  photoNotImage: "Bitte wähl eine Bilddatei.",
  photoTooLarge: "Das Bild ist zu groß.",
  namePlaceholder: "Dein Name",
  saveName: "Name speichern",
  addName: "Namen hinzufügen",
  editName: "Name bearbeiten",
  adjustPhotoTitle: "Foto anpassen",
  photoMenuTitle: "Profilfoto",
  chooseNewPhoto: "Neues Foto wählen",
  removePhoto: "Foto entfernen",
  photoStaysOnDevice: "Dein Foto bleibt auf diesem Gerät. Es wird nie hochgeladen.",

  // Avatar crop editor
  cropOpenFailed: "Das Bild konnte nicht geöffnet werden. Probier ein JPEG oder PNG.",
  cropProcessFailed: "Das Bild konnte nicht verarbeitet werden.",
  cropClose: "Schließen",
  cropLoading: "Foto lädt…",
  cropViewportLabel: "Bildausschnitt. Zum Verschieben ziehen oder Pfeiltasten nutzen, zum Zoomen zwei Finger oder Plus und Minus.",
  cropZoom: "Zoom",
  cropHint: "Zum Ausrichten ziehen. Mit zwei Fingern oder dem Regler zoomen.",
  cropCancel: "Abbrechen",
  cropSave: "Foto speichern",

  // Settings
  remindersTitle: "Erinnerungen",
  remindersOff: "Aus. Fitr erinnert dich nicht vor einer Einsatz-Frist.",
  remindersBlocked: "Benachrichtigungen sind für Fitr blockiert. Tippe auf den Schalter, um die Android-Einstellungen zu öffnen.",
  remindersAllow: "Erlaube Benachrichtigungen, damit Fitr dich vor deiner Frist erinnern kann.",
  remindersOn: "Ein Hinweis 2 Stunden vor deiner Einsatz-Frist und ein letzter Aufruf 30 Minuten vorher.",
  cameraTitle: "Standardkamera",
  cameraHint: "Mit welcher Kamera ein Workout startet. Im Workout kannst du sie trotzdem wechseln.",
  cameraFront: "Vorne",
  cameraBack: "Hinten",
  hapticsTitle: "Vibration",
  hapticsHint: "Ein kurzes Vibrieren bei jeder gezählten Wdh. und wenn du dein Ziel erreichst.",
  voiceCoachTitle: "Sprachcoach",
  voiceCoachHint: "Zählt deine Wiederholungen laut mit und sagt Technik-Tipps und Live-Checks an, damit du nie auf den Bildschirm schauen musst.",
  formGuidesTitle: "Technik-Guides",
  formGuidesAllShown: "Jede Übung zeigt vor dem Start ihren Technik-Guide.",
  formGuidesHidden_one: "Für {count} Übung ausgeblendet.",
  formGuidesHidden_other: "Für {count} Übungen ausgeblendet.",
  formGuidesShowAll: "Alle Technik-Guides wieder zeigen",

  // About links
  websiteTitle: "Fitr-Website",
  websiteHint: "fitr.day · teil sie mit Freunden",
  opensInBrowser: " (öffnet in deinem Browser)",
  verificationLinkTitle: "So funktioniert die Prüfung",
  verificationLinkHint: "Was Fitr prüft und was nicht",
  privacyLinkTitle: "Datenschutz",
  privacyLinkHint: "Dein Video verlässt nie dein Handy",
  creditsLinkTitle: "Credits & Lizenzen",
  creditsLinkHint: "Open-Source-Software, auf der wir aufbauen",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "Vertrauen",
  verificationTitle: "So funktioniert die Prüfung",
  verificationDescription:
    "Was Fitr prüft, bevor ein Einsatz-Tag zählt, was die Blockchain durchsetzt und wem du vertrauen musst.",
  verificationLead:
    "Fitr ist schummelresistent gebaut, nicht schummelsicher. Hier steht genau, was geprüft wird, von wem und worauf du vertraust.",
  verificationPhoneHeading: "1. Dein Handy zählt die Wiederholungen",
  verificationPhoneBody:
    "Pose-KI auf dem Gerät findet in jedem Kamerabild 33 Körperpunkte und zählt eine Wiederholung nur, wenn deine Gelenke den vollen Bewegungsumfang durchlaufen (zum Beispiel Ellbogen über 90° beim Liegestütz). Halbe Wiederholungen erscheinen als „nicht gezählt“. Das läuft komplett auf deinem Handy.",
  verificationServerHeading: "2. Bei Workouts mit Einsatz prüft Fitrs Server nach",
  verificationServerIntro:
    "Wenn Geld im Spiel ist, sendet dein Handy während des Workouts zusätzlich die Skelettpunkte (nie Video) an Fitrs Prüfserver. Der Server:",
  verificationServerRecount:
    "zählt jede Wiederholung selbst mit derselben Zähl-Engine nach, verlässt sich also nie nur auf dein Handy;",
  verificationServerChallengesBefore: "stellt dir zu zufälligen Zeitpunkten ",
  verificationServerChallengesStrong: "Live-Challenges",
  verificationServerChallengesAfter:
    " wie „Heb deine rechte Hand“, die ein vorab aufgenommenes Video nicht kennen kann;",
  verificationServerPlausible:
    "prüft, ob die Bewegung physikalisch plausibel ist: Knochenlängen bleiben gleich, Gelenke springen nicht, das Tempo ist menschlich;",
  verificationServerTiming: "prüft das Timing mit seiner eigenen Uhr und lehnt eine bereits eingereichte Session ab.",
  verificationServerOutro: "Erst wenn all das passt, markiert der Server deinen Tag onchain als erledigt.",
  verificationChainHeading: "3. Die Blockchain setzt die Geldregeln durch",
  verificationChainBody:
    "Dein Einsatz liegt in einem Onchain-Vault-Programm auf Solana, nicht bei Fitr. Das Programm setzt die Fristen durch, einen Einsatz pro Wallet und Tag, die Auszahlungsrechnung (dein Einsatz zurück plus ein anteiliger Teil der verfallenen Einsätze, abzüglich 5 % Gebühr, die nur auf Verfallenes anfällt) und kein doppeltes Abholen. Fitr kann deinen Einsatz nicht zu sich verschieben, und wird ein Tag annulliert, bekommen alle ihr Geld zurück.",
  verificationTrustHeading: "Worauf du vertraust",
  verificationTrustBody:
    "Die Blockchain kann dein Workout nicht sehen, also vertraust du darauf, dass Fitrs Server fair urteilt: dich als erledigt markiert, wenn du trainiert hast, und niemanden, der es nicht hat. Jede Entscheidung trägt einen Fingerabdruck der geprüften Session und ist so überprüfbar.",
  verificationLimitsBody:
    "Kein kamerabasiertes System ist unmöglich zu täuschen. Wer mit einer manipulierten App oder einem überzeugenden Double betrügen will, kommt vielleicht durch. Die Prüfungen oben machen das schwer, langsam und den Einsatz nicht wert.",

  // Privacy doc
  privacyEyebrow: "Deine Daten",
  privacyTitle: "Datenschutz",
  privacyDescription: "Dein Video verlässt nie dein Handy. Was Fitr speichert, was es sendet und wann.",
  privacyLeadStrong: "Dein Kameravideo verlässt nie dein Handy.",
  privacyLeadRest: " Es wird auf dem Gerät Bild für Bild analysiert und nie aufgenommen oder hochgeladen.",
  privacyFreeHeading: "Freie Workouts",
  privacyFreeBody:
    "Zum Workout wird nichts irgendwohin gesendet. Verlauf, Streaks, Bestleistungen und Auszeichnungen werden nur in dieser App auf diesem Handy gespeichert. Löschst du den Verlauf im Tab Fortschritt, sind sie weg.",
  privacyStakedHeading: "Workouts mit Einsatz",
  privacyStakedBody:
    "Um einen Einsatz-Tag zu prüfen, sendet dein Handy Fitrs Prüfserver die Skelettpunkte der Session: die Positionen von 33 Körpergelenken über die Zeit, plus deine Antworten auf die Live-Challenges. Kein Video, keine Bilder, kein Ton. Der Server prüft damit deine Wiederholungen und speichert einen Fingerabdruck der Session, damit dasselbe Workout nicht zweimal eingereicht wird.",
  privacyWalletHeading: "Deine Wallet",
  privacyWalletBody:
    "Fitr sieht beim Verbinden deine öffentliche Wallet-Adresse, um Guthaben und Seeker-Status anzuzeigen. Deine Schlüssel bleiben in deiner Wallet, und jede Transaktion bestätigst du selbst. Einsätze, Abschlüsse und Auszahlungen werden auf der öffentlichen Solana-Blockchain erfasst.",
  privacyThirdPartiesHeading: "Drittanbieter",
  privacyThirdPartiesBody:
    "Die Pose-KI auf dem Gerät (Google MediaPipe) kann anonyme Nutzungsstatistiken über die Bibliothek selbst an Google senden. Diese enthalten kein Video, keine Bilder und keine Körperpunkte.",
  privacySettingsHeading: "Einstellungen",
  privacySettingsBody: "Deine Einstellungen für Kamera, Vibration und Technik-Guides werden nur auf diesem Handy gespeichert.",

  // Credits doc
  creditsEyebrow: "Danke",
  creditsTitle: "Credits & Lizenzen",
  creditsDescription: "Die Open-Source-Software, Schriften und Medien, mit denen Fitr gebaut ist.",
  creditsIntro: "Fitr baut auf Open-Source-Software auf. Danke an alle, die sie möglich machen.",
  creditsClipsHeading: "Videos der Technik-Guides",
  creditsClipLabel: "{exercise}-Demo von {author}",

  // Root layout
  skipToContent: "Zum Inhalt springen",
  appDescription:
    "Fitr zählt deine Liegestütze, Kniebeugen und Planks mit Pose-Tracking per KI auf dem Gerät. Jede Wiederholung wird über Gelenkwinkel geprüft, und dein Video verlässt nie dein Handy.",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "Noch {left}: {goal}",
  nativeReminderTitle: "Noch {left} für dein Workout",
  nativeReminderBodyStake: "Zieh heute durch, sonst geht dein Einsatz von {stake} an alle, die trainiert haben.",
  nativeReminderBody: "Schließ dein heutiges Workout vor der Frist ab.",
  builtBy: "Entwickelt von",
};

export default you;
