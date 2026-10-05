/** English source for the "voice" namespace. Keys are stable ids; values may use {placeholders}. */
const voice = {
  // Workout start and the ready countdown.
  letsGo: "Let's go.",
  letsGoGoal: "Let's go. {goal}.",
  go: "Go.",
  // Goal phrases ({name} is the exercise name in lower case).
  goalReps_one: "1 rep",
  goalReps_other: "{count} {name}",
  goalMinutes: "{count} minute {name}",
  goalSeconds: "{count} second {name}",
  goalReached: "Goal! {goal}.",
  // Durations while holding.
  seconds: "{count} seconds",
  minutes_one: "1 minute",
  minutes_other: "{count} minutes",
  minutesAndSeconds: "{minutes} {seconds}",
  // Rep milestones.
  repWithMilestone: "{count}. {milestone}",
  halfway: "Halfway.",
  fiveLeft: "5 left.",
  lastOne: "Last one.",
  // Form cues.
  rejected: "Didn't count. {cue}",
  issueBodyNotVisible: "Step back so I can see you.",
  issueUnstableTracking: "Steady the phone.",
  issueGoLower: "Go lower.",
  issueExtendFully: "Lock out.",
  issueHipsSagging: "Hips up.",
  issueHipsPiked: "Straighten your body.",
  issueBodyNotHorizontal: "Get into position.",
  issueBodyOnFloor: "Up on your toes.",
  issueChestUp: "Chest up.",
  issueTooFast: "Slow down.",
  issueFaceCamera: "Face the camera.",
  issueTurnSideOn: "Turn side-on.",
  issueKeepBackOnWall: "Back flat on the wall.",
  issueKeepHipsHigh: "Hips high.",
  issueChinOverBar: "Chin over the bar.",
  issueGoHigher: "Go higher.",
  issueArmsOverhead: "Hands overhead.",
  issueJumpHigher: "Jump higher.",
  phoneTilted: "Stand your phone upright.",
  // Live checks.
  challengeRaiseRightHand: "Raise your right hand!",
  challengeRaiseLeftHand: "Raise your left hand!",
  challengeRaiseHand: "Raise a hand!",
  challengeHoldStillTop: "Stand tall and hold still!",
  challengeGeneric: "Live check!",
  challengePassed: "Good.",
  // Toggling the coach.
  voiceCoachOn: "Voice coach on",
} as const;

export default voice;
