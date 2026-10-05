/** English source for the "today" namespace. Keys are stable ids; values may use {placeholders}. */
const today = {
  // Header
  todayTitle: "Today",
  greetingMorning: "Good morning",
  greetingAfternoon: "Good afternoon",
  greetingEvening: "Good evening",
  dayStreak: "day streak",
  dayUnit_one: "day",
  dayUnit_other: "days",

  // Time left until the deadline
  deadlinePassed: "Deadline passed",
  timeLeftUnderMinute: "<1m left",
  timeLeftHoursMinutes: "{hours}h {minutes}m left",
  timeLeftMinutes: "{minutes}m left",
  spokenUnderMinute: "Less than a minute left",
  spokenLeft: "{time} left",
  spokenHours_one: "{count} hour",
  spokenHours_other: "{count} hours",
  spokenMinutes_one: "{count} minute",
  spokenMinutes_other: "{count} minutes",
  spokenSeconds_one: "{count} second",
  spokenSeconds_other: "{count} seconds",

  // Amounts in an exercise unit
  goalReps_one: "{count} rep",
  goalReps_other: "{count} reps",
  goalSeconds_one: "{count} s",
  goalSeconds_other: "{count} s",

  // Hero card
  heroLoadingTitle: "Checking your commitment…",
  heroGoalEyebrow: "Your goal",
  heroGoalFallback: "Today's goal",
  start: "Start",
  viewCommitment: "View commitment",
  atStake: "{amount} at stake",
  verifyingEyebrow: "Almost there",
  verifyingTitle: "Verifying your workout…",
  verifyingBody: "Fitr is re-checking your reps and live challenges. This usually takes a moment.",
  verifiedTitle: "Goal verified",
  seeProgress: "See progress",
  verifiedBodyWithGoal: "{goal}, done and onchain. Your stake is safe. Come back tomorrow.",
  verifiedBody: "Done and onchain. Your stake is safe. Come back tomorrow.",
  claimEyebrow: "Ready to claim",
  claimFallbackTitle: "Your stake is back",
  claim: "Claim",
  claimBody: "You kept your word. Claim your stake and your share.",
  missedEyebrow: "Goal missed",
  missedTitle: "Tomorrow is a new day",
  commitAgain: "Commit again",
  missedBody: "The deadline passed before a verified workout. Set a goal you can keep.",
  revokedEyebrow: "Under review",
  revokedTitle: "Verification withdrawn",
  viewDetails: "View details",
  revokedBody:
    "Fitr's review withdrew today's verification. Your stake is not forfeited: you can claim it back (no bonus) once the day closes.",
  trainFreeEyebrow: "Train free",
  pickWorkout: "Pick a workout",
  notSeekerTitle: "Commitments need a Seeker",
  notSeekerBody: "Staking is for Solana Seeker owners. Every workout and rep counter is still yours.",
  pausedTitle: "Commitments are paused",
  pausedBody: "Staking is offline right now. Your workouts still count.",
  commitTitle: "Put your word on the line",
  commit: "Commit",
  commitBodyNoWallet: "Connect your wallet, pick a goal and stake SKR on showing up today.",
  commitBody: "Pick a goal and stake SKR on showing up today. Hit it and your stake comes back.",

  // Commitment card
  commitmentCardTitle: "Daily $SKR Commitment",
  stepStakeTitle: "Stake.",
  stepStakeBody: "Pick your daily goal and how much SKR to lock. Both are fixed onchain when you commit.",
  stepShowUpTitle: "Show up.",
  stepShowUpBody:
    "Hit your goal, counted on-device by pose tracking and re-checked by Fitr's verifier. Your stake comes back plus a share of the pool.",
  stepPayUpTitle: "Or pay up.",
  stepPayUpBody: "Miss it and your stake goes to the people who showed up, minus a 5% fee.",
  currentStreak: "Current streak",
  poolMultiplier: "Pool multiplier",
  notAvailableYet: "Not available yet",
  commitToken: "Commit {token}",
  stakeNote: "You choose the goal and the stake. Nothing is staked until you sign in your wallet.",

  // Wallet row
  balanceUnavailable: "Balance unavailable",
  loadingBalance: "Loading balance…",
  connectWallet: "Connect wallet",
  seeBalance: "See your {token} balance",

  // Activity + quick start
  activityHeading: "Today's activity",
  nothingLoggedYet: "Nothing logged yet today.",
  defaultGoalHit: "Default goal hit",
  quickStartHeading: "Quick start",
  allWorkouts: "All workouts",
} as const;

export default today;
