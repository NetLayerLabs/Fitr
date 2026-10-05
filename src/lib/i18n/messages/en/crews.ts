/** English source for the "crews" namespace. Keys are stable ids; values may use {placeholders}. */
const crews = {
  // Names and labels (labels.ts, crewDisplayName)
  soloName: "Solo",
  unnamedCrew: "Crew {suffix}",
  challengeFree: "Everyone picks their own workout",
  challengeFixedGoal: "{goal} for everyone",
  challengeFixedExercise: "{exercise}, everyone sets their own goal",
  inviteShareText: 'Join my Fitr crew "{name}". {challenge}. Stake SKR on showing up: no-shows fund the people who do.',
  inviteShareTitle: "{name} on Fitr",

  // Page metadata
  metaTitle: "Crew",
  metaDescription: "Your Fitr crew: today's challenge, who showed up, the crew streak and the leaderboard.",

  // Crew hub (Commit tab)
  yourCrewsTitle: "Your crews",
  lookingForCrews: "Looking for your crews…",
  crewsLoadError: "Couldn’t load your crews right now. Try again in a moment.",
  noCrewsYet: "No crews yet. Start one below and share the link, or open an invite from a friend.",
  yoursTag: "Yours",
  joinTitle: "Join a crew",
  joinPlaceholder: "fitr.day/c/…",
  joinInputLabel: "Invite link or crew number",
  joinOpen: "Open",
  joinInvalid: "Paste an invite link like fitr.day/c/123… or the crew number.",

  // Create a crew
  createTitle: "Start a crew",
  createHint:
    "Your crew gets its own pool: no-shows fund the members who showed up. If nobody shows up on a day, the stakes roll over to the next day someone does.",
  crewNameLabel: "Crew name",
  crewNamePlaceholder: "Morning Movers",
  crewNameEmpty: "Give your crew a name.",
  crewNameChars: "Use letters, numbers and emoji only.",
  crewNameTooLong: "That name is too long (32 bytes max).",
  sameExerciseToggle: "Everyone does the same exercise",
  sameGoalToggle: "Same goal for everyone",
  createNeedsSol:
    "Creating a crew needs about {needed} for account rent and the network fee. This wallet has {balance}.",
  createPaused: "New crews are paused for maintenance right now.",
  working: "Working…",
  createButton: "Create crew",
  createFine:
    "One signature · about {rent} of account rent (not refunded). Creating a crew gives you no special powers over it: the same onchain rules apply to everyone.",
  createTimeout: "Your wallet sent it, but the network has not confirmed it yet. Check the explorer, then refresh.",
  createFailedOnchain: "Creating the crew failed onchain. Nothing was charged except the network fee.",
  vaultReadError: "Could not read the vault",

  // Commitments across pools
  commitmentsTodayTitle: "Your commitments today",
  goalFallback: "Goal",
  forTomorrow: "tomorrow",
  tagToDo: "To do",
  tagVerifying: "Verifying",
  tagVerified: "Verified",
  tagClaim: "Claim",
  tagMissed: "Missed",
  tagWithdrawn: "Withdrawn",
  tagCommitted: "Committed",

  // Crew page
  eyebrowCrew: "Crew",
  eyebrowCommitTogether: "Commit together",
  loadingCrew: "Loading the crew",
  notFoundTitle: "Crew not found",
  notFoundBody: "We couldn't find this crew onchain. Check the invite link, or staking may not be open yet.",
  goToCommit: "Go to Commit",
  unreachableTitle: "Can't reach the vault",
  unreachableBody: "We couldn't read this crew. Check your connection and try again.",
  tryAgain: "Try again",
  connectToCommit: "Connect your wallet to commit with the crew. You sign every stake yourself.",
  seekerOnly:
    "Staking is Seeker-only: this wallet does not hold a Seeker Genesis Token. You can still follow the crew and train.",
  checkSeekerAgain: "Check my Seeker again",
  checkingSeeker: "Checking your Seeker…",
  deletedTitle: "This crew was deleted",
  deletedBody:
    "Its creator removed it from Fitr, so nobody can join or stake in it any more. If you staked here, you can still claim below.",
  todaysChallenge: "Today's challenge",
  ownWorkoutOwnGoal: "Your workout, your goal",
  sameGoalSentence: "Same goal for everyone.",
  challengeSentence: "{challenge}.",
  challengeRules:
    "No-shows fund the crew members who showed up. If nobody shows up, the stakes roll over to the next crew day someone completes.",
  statStreak: "Crew streak",
  statVerifiedToday: "Verified today",
  statMembers: "Members",
  todayTitle: "Today",
  dayLoadError: "Couldn't load the crew's day. It refreshes on its own.",
  loading: "Loading…",
  nobodyCommitted: "Nobody has committed today yet. Be the first, then share the link.",
  you: "You",
  streakExplainer: "The crew streak counts days on which everyone who committed was verified.",
  streakExplainerBest: "The crew streak counts days on which everyone who committed was verified (best: {best}).",
  yourStakeTitle: "Your stake",
  leaderboardTitle: "Leaderboard",
  leaderboardLabel: "Crew leaderboard",
  leaderboardEmpty: "The board fills up after the first verified day.",
  leaderDays_one: "{count} day verified · streak {streak}",
  leaderDays_other: "{count} days verified · streak {streak}",
  bonusAmount: "+{amount}",
  bonusLabel: "bonus",
  bonusExplainer:
    "Bonus is what members got on top of their own stake back, from crew members who missed (Fitr keeps a {fee}% fee on forfeits only). {token} amounts come from the crew's onchain profiles.",
  rolloverNote: "Rolling over: {amount} from crew days nobody completed goes to the next crew day someone does.",

  // Invite actions
  inviteButton: "Invite",
  copyButton: "Copy",
  copiedButton: "Copied",
  copyInviteLink: "Copy invite link",
  inviteLinkCopied: "Invite link copied",
  inviteLinkLabel: "Invite link",

  // Delete crew
  deleteButton: "Delete crew",
  deleteConfirmTitle: "Delete {name}?",
  deleteConfirmBody:
    "It disappears from Fitr and its invite link stops working. Nobody can join or stake in it any more. Anyone who already staked can still claim. Your wallet signs a message to prove you created it: no transaction, no fee.",
  keepIt: "Keep it",
  deleting: "Deleting…",
  deleteCancelled: "Cancelled in your wallet. Nothing changed.",
  deleteFailed: "Couldn't delete the crew. Try again.",
  deleteFailedStatus: "Couldn't delete the crew ({status}).",
} as const;

export default crews;
