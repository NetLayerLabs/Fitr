/** English source for the "you" namespace. Keys are stable ids; values may use {placeholders}. */
const you = {
  languageTitle: "Language",
  languageHint: "Changes every screen in the app",

  // You tab page
  pageTitle: "You",
  pageDescription: "Your wallet, Seeker status, settings, and how Fitr verifies workouts and handles your data.",
  walletHeading: "Wallet",
  settingsHeading: "Settings",
  aboutHeading: "About Fitr",

  // Profile header
  profileLabel: "Profile",
  changePhoto: "Change profile photo",
  addPhoto: "Add profile photo",
  photoNotImage: "Please choose an image file.",
  photoTooLarge: "That image is too large.",
  namePlaceholder: "Your name",
  saveName: "Save name",
  addName: "Add your name",
  editName: "Edit name",
  adjustPhotoTitle: "Adjust photo",
  photoMenuTitle: "Profile photo",
  chooseNewPhoto: "Choose a new photo",
  removePhoto: "Remove photo",
  photoStaysOnDevice: "Your photo stays on this device. It is never uploaded.",

  // Avatar crop editor
  cropOpenFailed: "Couldn't open that image. Try a JPEG or PNG.",
  cropProcessFailed: "Couldn't process that image.",
  cropClose: "Close",
  cropLoading: "Loading photo…",
  cropViewportLabel: "Photo framing. Drag or use arrow keys to move, pinch or plus and minus to zoom.",
  cropZoom: "Zoom",
  cropHint: "Drag to position. Pinch or use the slider to zoom.",
  cropCancel: "Cancel",
  cropSave: "Save photo",

  // Settings
  remindersTitle: "Clock-in reminders",
  remindersOff: "Off. Fitr won't nudge you before a stake deadline.",
  remindersBlocked: "Notifications are blocked for Fitr. Tap the switch to open Android settings.",
  remindersAllow: "Allow notifications so Fitr can remind you before your deadline.",
  remindersOn: "A nudge 2 hours before your stake deadline, and a last call 30 minutes before.",
  cameraTitle: "Default camera",
  cameraHint: "Which camera a workout opens with. You can still flip it on the workout screen.",
  cameraFront: "Front",
  cameraBack: "Back",
  hapticsTitle: "Haptics",
  hapticsHint: "A short buzz on every counted rep and when you reach your goal.",
  voiceCoachTitle: "Voice coach",
  voiceCoachHint: "Counts your reps out loud and calls form cues and live checks, so you never need to read the screen.",
  formGuidesTitle: "Form guides",
  formGuidesAllShown: "Every exercise shows its form guide before you start.",
  formGuidesHidden_one: "Hidden for {count} exercise.",
  formGuidesHidden_other: "Hidden for {count} exercises.",
  formGuidesShowAll: "Show all form guides again",

  // About links
  websiteTitle: "Fitr website",
  websiteHint: "fitr.day · share it with friends",
  opensInBrowser: " (opens in your browser)",
  verificationLinkTitle: "How verification works",
  verificationLinkHint: "What Fitr checks, and what it can't",
  privacyLinkTitle: "Privacy",
  privacyLinkHint: "Your video never leaves your phone",
  creditsLinkTitle: "Credits & licenses",
  creditsLinkHint: "Open-source software we build on",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "Trust",
  verificationTitle: "How verification works",
  verificationDescription:
    "What Fitr checks before a staked day counts, what the blockchain enforces, and what you have to trust.",
  verificationLead:
    "Fitr is built to be cheat-resistant, not cheat-proof. Here is exactly what is checked, by whom, and what you are trusting.",
  verificationPhoneHeading: "1. Your phone counts the reps",
  verificationPhoneBody:
    "On-device pose AI finds 33 body points in each camera frame and counts a rep only when your joints move through the full range (for example, elbows past 90° on a push-up). Half reps are shown as “not counted”. This runs entirely on your phone.",
  verificationServerHeading: "2. For staked workouts, Fitr's server checks again",
  verificationServerIntro:
    "When money is on the line, your phone also sends the skeleton points (never video) to Fitr's verification server while you work out. The server:",
  verificationServerRecount:
    "re-counts every rep itself with the same counting engine, so it never takes your phone's word for it;",
  verificationServerChallengesBefore: "gives you ",
  verificationServerChallengesStrong: "live challenges",
  verificationServerChallengesAfter:
    " at random moments, such as “raise your right hand”, that a pre-recorded video can't know in advance;",
  verificationServerPlausible:
    "checks the movement is physically plausible: bone lengths stay constant, joints don't teleport, the pace is human;",
  verificationServerTiming: "checks timing against its own clock, and rejects a session that was already submitted.",
  verificationServerOutro: "Only when all of that passes does the server mark your day complete onchain.",
  verificationChainHeading: "3. The blockchain enforces the money rules",
  verificationChainBody:
    "Your stake sits in an onchain vault program on Solana, not with Fitr. The program enforces the deadlines, one commitment per wallet per day, the payout math (your stake back plus a pro-rata share of forfeited stakes, minus a 5% fee taken only from forfeits) and no double claims. Fitr can't move your stake to itself, and if a day is voided everyone is refunded.",
  verificationTrustHeading: "What you are trusting",
  verificationTrustBody:
    "The blockchain can't see your workout, so you trust Fitr's server to judge it fairly: to mark you complete when you did the work, and not to mark anyone complete who didn't. Each decision carries a fingerprint of the session it judged, so it can be audited.",
  verificationLimitsBody:
    "No camera-based system is impossible to fool. A determined cheater with a modified app or a convincing body double might get through. The checks above are there to make that hard, slow and not worth the stake.",

  // Privacy doc
  privacyEyebrow: "Your data",
  privacyTitle: "Privacy",
  privacyDescription: "Your video never leaves your phone. What Fitr stores, what it sends, and when.",
  privacyLeadStrong: "Your camera video never leaves your phone.",
  privacyLeadRest: " It is analysed on the device, frame by frame, and never recorded or uploaded.",
  privacyFreeHeading: "Free workouts",
  privacyFreeBody:
    "Nothing about the workout is sent anywhere. Your history, streaks, records and awards are saved only in this app on this phone. Clearing your history on the Progress tab deletes them.",
  privacyStakedHeading: "Staked workouts",
  privacyStakedBody:
    "To verify a staked day, your phone sends Fitr's verification server the skeleton points of the session: the positions of 33 body joints over time, plus your answers to the live challenges. No video, no images, no audio. The server uses them to check your reps and keeps a fingerprint of the session to stop the same workout being submitted twice.",
  privacyWalletHeading: "Your wallet",
  privacyWalletBody:
    "Fitr sees your public wallet address when you connect, to show your balance and Seeker status. Your keys stay in your wallet, and every transaction is approved by you. Stakes, completions and payouts are recorded on the Solana blockchain, which is public.",
  privacyThirdPartiesHeading: "Third parties",
  privacyThirdPartiesBody:
    "The on-device pose AI (Google MediaPipe) may send anonymous usage statistics about the library itself to Google. These contain no video, images or body points.",
  privacySettingsHeading: "Settings",
  privacySettingsBody: "Your camera, haptics and form-guide preferences are stored only on this phone.",

  // Credits doc
  creditsEyebrow: "Thank you",
  creditsTitle: "Credits & licenses",
  creditsDescription: "The open-source software, fonts and media Fitr is built with.",
  creditsIntro: "Fitr is built on open-source software. Thanks to everyone who makes it.",
  creditsClipsHeading: "Form guide videos",
  creditsClipLabel: "{exercise} demo by {author}",

  // Root layout
  skipToContent: "Skip to content",
  appDescription:
    "Fitr counts your push-ups, squats and planks with on-device AI pose tracking. Every rep is checked by joint angles, and your video never leaves your phone.",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "{left} left: {goal}",
  nativeReminderTitle: "{left} left to clock in",
  nativeReminderBodyStake: "Finish today or your {stake} stake goes to the people who showed up.",
  nativeReminderBody: "Finish today's workout before the deadline.",
  builtBy: "Built by",
} as const;

export default you;
