import type { NsMessages } from "../types";

const crews: Partial<NsMessages<"crews">> = {
  // Names and labels
  soloName: "Solo",
  unnamedCrew: "Crew {suffix}",
  challengeFree: "Alle wählen ihr eigenes Workout",
  challengeFixedGoal: "{goal} für alle",
  challengeFixedExercise: "{exercise}, alle wählen ihr eigenes Ziel",
  inviteShareText: "Komm in meine Fitr-Crew „{name}“. {challenge}. Setz SKR darauf, dass du trainierst: Wer nicht kommt, finanziert die, die kommen.",
  inviteShareTitle: "{name} auf Fitr",

  // Page metadata
  metaTitle: "Crew",
  metaDescription: "Deine Fitr-Crew: heutige Challenge, wer trainiert hat, die Crew-Streak und die Rangliste.",

  // Crew hub (Commit tab)
  yourCrewsTitle: "Deine Crews",
  lookingForCrews: "Suche deine Crews…",
  crewsLoadError: "Deine Crews konnten gerade nicht geladen werden. Versuch es gleich noch mal.",
  noCrewsYet: "Noch keine Crews. Gründe unten eine und teil den Link, oder öffne eine Einladung von Freunden.",
  yoursTag: "Deine",
  joinTitle: "Crew beitreten",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "Einladungslink oder Crew-Nummer",
  joinOpen: "Öffnen",
  joinInvalid: "Füg einen Einladungslink wie fitr.day/c/123… oder die Crew-Nummer ein.",

  // Create a crew
  createTitle: "Crew gründen",
  createHint:
    "Deine Crew bekommt einen eigenen Pool: Wer nicht kommt, finanziert die Mitglieder, die trainiert haben. Trainiert an einem Tag niemand, gehen die Einsätze auf den nächsten Tag über, an dem jemand durchzieht.",
  crewNameLabel: "Crew-Name",
  crewNamePlaceholder: "Frühsportler",
  crewNameEmpty: "Gib deiner Crew einen Namen.",
  crewNameChars: "Nur Buchstaben, Zahlen und Emoji.",
  crewNameTooLong: "Der Name ist zu lang (max. 32 Bytes).",
  sameExerciseToggle: "Alle machen dieselbe Übung",
  sameGoalToggle: "Gleiches Ziel für alle",
  createNeedsSol:
    "Eine Crew zu gründen braucht etwa {needed} für Konto-Miete und Netzwerkgebühr. Diese Wallet hat {balance}.",
  createPaused: "Neue Crews sind gerade wegen Wartung pausiert.",
  working: "Läuft…",
  createButton: "Crew gründen",
  createFine:
    "Eine Signatur · etwa {rent} Konto-Miete (nicht erstattet). Als Gründer hast du keine Sonderrechte: Für alle gelten dieselben Onchain-Regeln.",
  createTimeout: "Deine Wallet hat sie gesendet, aber das Netzwerk hat sie noch nicht bestätigt. Sieh im Explorer nach und aktualisiere dann.",
  createFailedOnchain: "Die Crew konnte onchain nicht gegründet werden. Außer der Netzwerkgebühr wurde nichts berechnet.",
  vaultReadError: "Vault konnte nicht gelesen werden",

  // Commitments across pools
  commitmentsTodayTitle: "Deine Einsätze heute",
  goalFallback: "Ziel",
  forTomorrow: "morgen",
  tagToDo: "Offen",
  tagVerifying: "In Prüfung",
  tagVerified: "Bestätigt",
  tagClaim: "Abholen",
  tagMissed: "Verpasst",
  tagWithdrawn: "Zurückgezogen",
  tagCommitted: "Eingesetzt",

  // Crew page
  eyebrowCrew: "Crew",
  eyebrowCommitTogether: "Gemeinsam einsetzen",
  loadingCrew: "Crew lädt",
  notFoundTitle: "Crew nicht gefunden",
  notFoundBody: "Wir konnten diese Crew onchain nicht finden. Prüf den Einladungslink, oder Einsätze sind noch nicht geöffnet.",
  goToCommit: "Zu Einsatz",
  unreachableTitle: "Vault nicht erreichbar",
  unreachableBody: "Wir konnten diese Crew nicht lesen. Prüf deine Verbindung und versuch es noch mal.",
  tryAgain: "Erneut versuchen",
  connectToCommit: "Verbinde deine Wallet, um mit der Crew einzusetzen. Du signierst jeden Einsatz selbst.",
  seekerOnly:
    "Einsätze nur mit Seeker: Diese Wallet hat kein Seeker Genesis Token. Du kannst der Crew trotzdem folgen und trainieren.",
  checkSeekerAgain: "Seeker erneut prüfen",
  checkingSeeker: "Dein Seeker wird geprüft…",
  deletedTitle: "Diese Crew wurde gelöscht",
  deletedBody:
    "Die Gründerin oder der Gründer hat sie aus Fitr entfernt, daher kann niemand mehr beitreten oder einsetzen. Hast du hier eingesetzt, kannst du unten trotzdem abholen.",
  todaysChallenge: "Heutige Challenge",
  ownWorkoutOwnGoal: "Dein Workout, dein Ziel",
  sameGoalSentence: "Gleiches Ziel für alle.",
  challengeSentence: "{challenge}.",
  challengeRules:
    "Wer nicht kommt, finanziert die Crew-Mitglieder, die trainiert haben. Trainiert niemand, gehen die Einsätze auf den nächsten Crew-Tag über, an dem jemand durchzieht.",
  statStreak: "Crew-Streak",
  statVerifiedToday: "Heute bestätigt",
  statMembers: "Mitglieder",
  todayTitle: "Heute",
  dayLoadError: "Der Crew-Tag konnte nicht geladen werden. Er aktualisiert sich von selbst.",
  loading: "Lädt…",
  nobodyCommitted: "Heute hat noch niemand eingesetzt. Mach den Anfang und teil dann den Link.",
  you: "Du",
  streakExplainer: "Die Crew-Streak zählt Tage, an denen alle mit Einsatz bestätigt wurden.",
  streakExplainerBest: "Die Crew-Streak zählt Tage, an denen alle mit Einsatz bestätigt wurden (Rekord: {best}).",
  yourStakeTitle: "Dein Einsatz",
  leaderboardTitle: "Rangliste",
  leaderboardLabel: "Crew-Rangliste",
  leaderboardEmpty: "Die Rangliste füllt sich nach dem ersten bestätigten Tag.",
  leaderDays_one: "{count} Tag bestätigt · Streak {streak}",
  leaderDays_other: "{count} Tage bestätigt · Streak {streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "Bonus",
  bonusExplainer:
    "Der Bonus ist, was Mitglieder zusätzlich zu ihrem zurückerhaltenen Einsatz bekommen haben, von Crew-Mitgliedern, die es verpasst haben (Fitr behält nur von verfallenen Einsätzen {fee} % Gebühr). {token}-Beträge stammen aus den Onchain-Profilen der Crew.",
  rolloverNote: "Übertrag: {amount} aus Crew-Tagen, an denen niemand durchgezogen hat, geht an den nächsten Crew-Tag, an dem jemand durchzieht.",

  // Invite actions
  inviteButton: "Einladen",
  copyButton: "Kopieren",
  copiedButton: "Kopiert",
  copyInviteLink: "Einladungslink kopieren",
  inviteLinkCopied: "Einladungslink kopiert",
  inviteLinkLabel: "Einladungslink",

  // Delete crew
  deleteButton: "Crew löschen",
  deleteConfirmTitle: "{name} löschen?",
  deleteConfirmBody:
    "Sie verschwindet aus Fitr und ihr Einladungslink funktioniert nicht mehr. Niemand kann mehr beitreten oder einsetzen. Wer schon eingesetzt hat, kann trotzdem abholen. Deine Wallet signiert eine Nachricht als Nachweis, dass du sie gegründet hast: keine Transaktion, keine Gebühr.",
  keepIt: "Behalten",
  deleting: "Wird gelöscht…",
  deleteCancelled: "In deiner Wallet abgebrochen. Nichts wurde geändert.",
  deleteFailed: "Die Crew konnte nicht gelöscht werden. Versuch es noch mal.",
  deleteFailedStatus: "Die Crew konnte nicht gelöscht werden ({status}).",
};

export default crews;
