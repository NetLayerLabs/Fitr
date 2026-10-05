/**
 * AI voice coach: decides WHAT to say during a workout and WHEN, as a calm, direct trainer
 * (short phrases, never chatty). Pure and deterministic: fed engine output, the ready countdown,
 * live challenges and a clock; returns lines for the caller to hand to speak() (lib/native/bridge).
 * WorkoutScreen only wires it.
 *
 * Text-to-speech gives no "finished" callback through the bridge, so the coach keeps its own
 * estimate of when the current line ends (`busyUntil`). Ordinary lines wait for that (one line
 * at a time, so speech never lags behind the workout); only a live challenge interrupts. Waiting
 * lines sit in one slot per kind: a newer rep count replaces an older unsaid one, and cues that
 * went stale (a form issue that is gone, a countdown digit that passed) are dropped unsaid.
 *
 * What it says:
 *   start            "Let's go. 20 push-ups."
 *   ready countdown  "3", "2", "1", "Go."
 *   reps             every rep number; milestones "Halfway.", "5 left.", "Last one.",
 *                    then "Goal! 20 push-ups." and it keeps counting after.
 *   timed holds      every 10 s ("20 seconds"), "Halfway.", the last 5 s ("5" ... "1"), the goal.
 *   form             short cues ("Go lower.") - same issue at most every 6 s, any at most every 3 s.
 *   rejected rep     "Didn't count. Go lower." (throttled).
 *   live challenge   interrupts: "Raise your right hand!", repeated once if still open, "Good." on pass.
 */
import { detectChallenge, type ChallengeType } from "@/lib/attest/challenges";
import type { GoalUnit } from "@/lib/exercises";
import type { EngineEvent, EngineState, FormIssue, PoseFrame } from "@/lib/pose/types";

export interface CoachLine {
  text: string;
  /** Cut off whatever is being said (live challenges only). */
  interrupt: boolean;
}

/** Spoken short form of every FormIssue: a trainer's cue, not the on-screen sentence. */
export const SPOKEN_ISSUE: Record<FormIssue, string> = {
  body_not_visible: "Step back so I can see you.",
  unstable_tracking: "Steady the phone.",
  go_lower: "Go lower.",
  extend_fully: "Lock out.",
  hips_sagging: "Hips up.",
  hips_piked: "Straighten your body.",
  body_not_horizontal: "Get into position.",
  body_on_floor: "Up on your toes.",
  chest_up: "Chest up.",
  too_fast: "Slow down.",
  face_camera: "Face the camera.",
  turn_side_on: "Turn side-on.",
  keep_back_on_wall: "Back flat on the wall.",
  keep_hips_high: "Hips high.",
  chin_over_bar: "Chin over the bar.",
  go_higher: "Go higher.",
  arms_overhead: "Hands overhead.",
  jump_higher: "Jump higher.",
};

export const SPOKEN_CHALLENGE: Record<ChallengeType, string> = {
  raise_right_hand: "Raise your right hand!",
  raise_left_hand: "Raise your left hand!",
  raise_hand: "Raise a hand!",
  hold_still_top: "Stand tall and hold still!",
};

export const TILTED_CUE = "Stand your phone upright.";

export interface CoachTiming {
  /** A form issue must stay on top this long before it is spoken. */
  issueStableMs: number;
  /** The same issue is spoken at most this often. */
  sameIssueGapMs: number;
  /** Any form cue (issue or rejection) at most this often. */
  anyIssueGapMs: number;
  /** "Didn't count" at most this often. */
  rejectionGapMs: number;
  /** An unsaid form cue is dropped after this long. */
  issueStaleMs: number;
  /** An unsaid countdown digit / hold second is dropped after this long. */
  tickStaleMs: number;
  /** Repeat an open live challenge once after this long, if it has not been passed. */
  challengeRepeatMs: number;
  /** Speech-duration estimate: per word, per sentence break, fixed overhead. */
  msPerWord: number;
  msPerBreak: number;
  msBase: number;
  /** Goals above this count reps at a faster pace (see fastLeadMs). */
  fastGoal: number;
  /** In fast mode a rep count may be queued this long before the previous line ends. */
  fastLeadMs: number;
}

export const DEFAULT_COACH_TIMING: Readonly<CoachTiming> = Object.freeze({
  issueStableMs: 600,
  sameIssueGapMs: 6000,
  anyIssueGapMs: 3000,
  rejectionGapMs: 4000,
  issueStaleMs: 1500,
  tickStaleMs: 700,
  challengeRepeatMs: 3500,
  msPerWord: 300,
  msPerBreak: 200,
  msBase: 150,
  fastGoal: 30,
  fastLeadMs: 200,
});

export interface VoiceCoachOptions {
  /** Display name, e.g. "Push-ups" or "Plank". */
  exerciseName: string;
  unit: GoalUnit;
  /** Goal in `unit` (reps or seconds). 0 disables milestones. */
  goal: number;
  timing?: Partial<CoachTiming>;
}

export interface CoachFrame {
  state: EngineState;
  events: readonly EngineEvent[];
  /** The phone is on its side / upside down (nothing counts until it is upright). */
  tilted?: boolean;
}

export interface CoachChallenge {
  id: string;
  type?: ChallengeType;
  /** On-screen copy; used when the type has no spoken form. */
  prompt: string;
  /** Epoch ms when the window closes (same clock as nowMs); skips a late repeat. */
  deadline?: number;
}

/** "20 push-ups", "1 rep", "1 minute plank", "45 second wall sit". */
export function spokenGoal(unit: GoalUnit, goal: number, exerciseName: string): string {
  const name = exerciseName.toLowerCase();
  if (unit === "seconds") {
    const s = Math.round(goal);
    if (s >= 60 && s % 60 === 0) return `${s / 60} minute ${name}`;
    return `${s} second ${name}`;
  }
  return goal === 1 ? "1 rep" : `${goal} ${name}`;
}

/** "10 seconds", "1 minute", "1 minute 10". */
export function spokenSeconds(s: number): string {
  if (s < 60) return `${s} seconds`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  const minutes = m === 1 ? "1 minute" : `${m} minutes`;
  return rest === 0 ? minutes : `${minutes} ${rest}`;
}

/** Spoken form of an on-screen challenge prompt ("Raise your RIGHT hand above your head"). */
export function spokenChallenge(challenge: CoachChallenge): string {
  if (challenge.type) return SPOKEN_CHALLENGE[challenge.type];
  const text = challenge.prompt.trim().toLowerCase();
  if (!text) return "Live check!";
  return `${text[0].toUpperCase()}${text.slice(1).replace(/[.!]+$/, "")}!`;
}

type Slot = "challenge" | "countdown" | "good" | "count" | "hold" | "rejection" | "issue";

const PRIORITY: Record<Slot, number> = {
  challenge: 7,
  countdown: 6,
  good: 5,
  count: 4,
  hold: 3,
  rejection: 2,
  issue: 1,
};

/** Rep milestones, strongest first; a stronger one is never replaced by a weaker one. */
type Milestone = "goal" | "last" | "five_left" | "halfway";
const MILESTONE_RANK: Record<Milestone, number> = { goal: 4, last: 3, five_left: 2, halfway: 1 };
const MILESTONE_TEXT: Record<Exclude<Milestone, "goal">, string> = {
  last: "Last one.",
  five_left: "5 left.",
  halfway: "Halfway.",
};

interface Pending {
  text: string;
  atMs: number;
  /** Form issue key, for "still current?" checks at speak time. */
  issue?: FormIssue | "tilted";
}

export class VoiceCoach {
  private readonly t: CoachTiming;
  private readonly unit: GoalUnit;
  private readonly goal: number;
  private readonly name: string;
  private readonly fast: boolean;

  private stopped = false;
  private busyUntil = Number.NEGATIVE_INFINITY;
  /** Kind of the line being spoken (for the fast-mode count lead). */
  private speaking: Slot | null = null;
  private readonly pending = new Map<Slot, Pending>();

  // Countdown.
  private lastCountdown: number | null = null;

  // Reps.
  private countN = 0;
  private milestone: Milestone | null = null;
  private goalAnnounced = false;

  // Holds.
  private lastHoldSecond = 0;

  // Form cues.
  private issueCandidate: FormIssue | "tilted" | null = null;
  private issueCandidateSince = 0;
  private stableIssue: FormIssue | "tilted" | null = null;
  private lastIssueSaid = new Map<FormIssue | "tilted", number>();
  private lastAnyIssueMs = Number.NEGATIVE_INFINITY;
  private lastRejectionMs = Number.NEGATIVE_INFINITY;

  // Live challenge.
  private challengeId: string | null = null;
  private challengeText = "";
  private challengeShownMs = 0;
  private challengeDeadline: number | null = null;
  private challengeRepeated = false;
  private challengePassedFlag = false;

  constructor(options: VoiceCoachOptions) {
    this.t = { ...DEFAULT_COACH_TIMING, ...options.timing };
    this.unit = options.unit;
    this.goal = Math.max(0, options.goal);
    this.name = options.exerciseName;
    this.fast = this.unit === "reps" && this.goal > this.t.fastGoal;
  }

  get isStopped(): boolean {
    return this.stopped;
  }

  /** Estimated speaking time of a line (ms). */
  estimateMs(text: string): number {
    const words = text.split(/\s+/).filter(Boolean).length;
    const breaks = Math.max(0, (text.match(/[.!?,](\s|$)/g) ?? []).length - 1);
    return this.t.msBase + words * this.t.msPerWord + breaks * this.t.msPerBreak;
  }

  /** The user tapped Start. */
  start(nowMs: number): CoachLine[] {
    if (this.stopped) return [];
    const goal = this.goal > 0 ? ` ${spokenGoal(this.unit, this.goal, this.name)}.` : "";
    return this.emit(`Let's go.${goal}`, "countdown", nowMs, false);
  }

  /** The ready countdown shows `value` (3, 2, 1), or ended / was skipped (null). */
  countdown(value: number | null, nowMs: number): CoachLine[] {
    if (this.stopped) return [];
    if (value === this.lastCountdown) return this.flush(nowMs);
    const was = this.lastCountdown;
    this.lastCountdown = value;
    if (value !== null) this.put("countdown", { text: String(value), atMs: nowMs });
    else if (was !== null) this.put("countdown", { text: "Go.", atMs: nowMs });
    return this.flush(nowMs);
  }

  /** One processed camera frame. */
  update(frame: CoachFrame, nowMs: number): CoachLine[] {
    if (this.stopped) return [];
    const inChallenge = this.challengeId !== null && !this.challengePassedFlag;

    for (const event of frame.events) {
      if (event.type === "rep") this.onRep(event.repIndex, nowMs);
      else if (event.type === "rep_rejected" && !inChallenge) this.onRejected(event.reason, nowMs);
    }

    if (this.unit === "seconds") this.onHold(frame.state.holdMs, nowMs);

    // Form cues: debounce the top issue (or the tilted phone), then throttle.
    const raw: FormIssue | "tilted" | null = frame.tilted ? "tilted" : (frame.state.formIssues[0] ?? null);
    if (raw !== this.issueCandidate) {
      this.issueCandidate = raw;
      this.issueCandidateSince = nowMs;
    }
    if (nowMs - this.issueCandidateSince >= (raw === "tilted" ? 0 : this.t.issueStableMs)) {
      this.stableIssue = this.issueCandidate;
    }
    const issue = this.stableIssue;
    if (issue !== null && !inChallenge && !this.pending.has("issue") && this.issueAllowed(issue, nowMs)) {
      this.put("issue", { text: issue === "tilted" ? TILTED_CUE : SPOKEN_ISSUE[issue], atMs: nowMs, issue });
    }

    return this.flush(nowMs);
  }

  /** The live check currently on screen (or none). A new one interrupts whatever is being said. */
  challenge(challenge: CoachChallenge | null, nowMs: number): CoachLine[] {
    if (this.stopped) return [];
    if (challenge === null) {
      this.challengeId = null;
      this.pending.delete("challenge");
      return this.flush(nowMs);
    }
    if (challenge.id === this.challengeId) {
      this.challengeDeadline = challenge.deadline ?? null;
      return this.flush(nowMs);
    }
    this.challengeId = challenge.id;
    this.challengeText = spokenChallenge(challenge);
    this.challengeShownMs = nowMs;
    this.challengeDeadline = challenge.deadline ?? null;
    this.challengeRepeated = false;
    this.challengePassedFlag = false;
    // Form chatter would only confuse the instruction.
    this.pending.delete("issue");
    this.pending.delete("rejection");
    this.pending.delete("challenge");
    return this.emit(this.challengeText, "challenge", nowMs, true);
  }

  /** The open live check was answered (detected on device). */
  challengePassed(id: string, nowMs: number): CoachLine[] {
    if (this.stopped) return [];
    if (id !== this.challengeId || this.challengePassedFlag) return this.flush(nowMs);
    this.challengePassedFlag = true;
    this.pending.delete("challenge");
    this.put("good", { text: "Good.", atMs: nowMs });
    return this.flush(nowMs);
  }

  /** Speak whatever is due (call on a timer when no frames arrive). */
  tick(nowMs: number): CoachLine[] {
    if (this.stopped) return [];
    return this.flush(nowMs);
  }

  /** Drop everything waiting (e.g. the app went to the background); the caller stops the TTS. */
  silence(): void {
    this.pending.clear();
    this.busyUntil = Number.NEGATIVE_INFINITY;
    this.speaking = null;
  }

  /** The workout ended: never speak again. */
  stop(): void {
    this.stopped = true;
    this.silence();
  }

  // -------------------------------------------------------------------------------------

  private onRep(n: number, nowMs: number): void {
    this.countN = Math.max(this.countN, n);
    const g = this.goal;
    let m: Milestone | null = null;
    if (g > 0 && n === g && !this.goalAnnounced) {
      m = "goal";
      this.goalAnnounced = true;
    } else if (g >= 2 && n === g - 1) m = "last";
    else if (g >= 6 && n === Math.floor(g / 2)) m = "halfway";
    else if (g >= 10 && n === g - 5) m = "five_left";
    // A newer count replaces an unsaid one; keep the stronger milestone of the two.
    const keep = this.pending.has("count") ? this.milestone : null;
    this.milestone = keep && (!m || MILESTONE_RANK[keep] > MILESTONE_RANK[m]) ? keep : m;
    this.put("count", { text: this.countText(), atMs: nowMs });
  }

  private countText(): string {
    if (this.milestone === "goal") return `Goal! ${spokenGoal(this.unit, this.goal, this.name)}.`;
    const n = String(this.countN);
    return this.milestone ? `${n}. ${MILESTONE_TEXT[this.milestone]}` : n;
  }

  private onRejected(reason: FormIssue, nowMs: number): void {
    if (nowMs - this.lastRejectionMs < this.t.rejectionGapMs) return;
    if (nowMs - this.lastAnyIssueMs < this.t.anyIssueGapMs) return;
    this.lastRejectionMs = nowMs;
    this.lastAnyIssueMs = nowMs;
    this.lastIssueSaid.set(reason, nowMs);
    this.pending.delete("issue");
    this.put("rejection", { text: `Didn't count. ${SPOKEN_ISSUE[reason]}`, atMs: nowMs });
  }

  private onHold(holdMs: number, nowMs: number): void {
    const s = Math.floor(Math.max(0, holdMs) / 1000);
    if (s <= this.lastHoldSecond) return;
    this.lastHoldSecond = s;
    const g = Math.round(this.goal);
    let text: string | null = null;
    if (g > 0 && s === g && !this.goalAnnounced) {
      this.goalAnnounced = true;
      text = `Goal! ${spokenGoal(this.unit, g, this.name)}.`;
    } else if (g >= 10 && s >= g - 5 && s < g) text = String(g - s);
    else if (g >= 20 && s === Math.floor(g / 2)) text = "Halfway.";
    else if (s % 10 === 0) text = spokenSeconds(s);
    if (text) this.put("hold", { text, atMs: nowMs });
  }

  private issueAllowed(issue: FormIssue | "tilted", nowMs: number): boolean {
    if (nowMs - this.lastAnyIssueMs < this.t.anyIssueGapMs) return false;
    const last = this.lastIssueSaid.get(issue);
    return last === undefined || nowMs - last >= this.t.sameIssueGapMs;
  }

  private put(slot: Slot, p: Pending): void {
    this.pending.set(slot, p);
  }

  private stale(slot: Slot, p: Pending, nowMs: number): boolean {
    const age = nowMs - p.atMs;
    switch (slot) {
      case "issue":
        return age > this.t.issueStaleMs || p.issue !== this.stableIssue;
      case "rejection":
        return age > this.t.issueStaleMs;
      case "countdown":
      case "hold":
        // The goal line of a hold is worth saying late; a passing second is not.
        return age > this.t.tickStaleMs && !p.text.startsWith("Goal");
      case "good":
        return age > 4000;
      case "challenge":
        return this.challengeId === null || this.challengePassedFlag;
      default:
        return false;
    }
  }

  private flush(nowMs: number): CoachLine[] {
    // Repeat an unanswered live check once, if there is still time to act on it.
    if (
      this.challengeId !== null &&
      !this.challengePassedFlag &&
      !this.challengeRepeated &&
      nowMs - this.challengeShownMs >= this.t.challengeRepeatMs &&
      (this.challengeDeadline === null || this.challengeDeadline - nowMs >= 1500)
    ) {
      this.challengeRepeated = true;
      this.put("challenge", { text: this.challengeText, atMs: nowMs });
    }

    let best: Slot | null = null;
    for (const [slot, p] of this.pending) {
      if (this.stale(slot, p, nowMs)) {
        this.pending.delete(slot);
        if (slot === "count") this.milestone = null;
        continue;
      }
      if (best === null || PRIORITY[slot] > PRIORITY[best]) best = slot;
    }
    if (best === null) return [];

    const lead = this.fast && best === "count" && this.speaking === "count" ? this.t.fastLeadMs : 0;
    if (nowMs < this.busyUntil - lead) return [];

    const p = this.pending.get(best)!;
    this.pending.delete(best);
    if (best === "count") this.milestone = null;
    if (best === "issue" && p.issue) {
      this.lastIssueSaid.set(p.issue, nowMs);
      this.lastAnyIssueMs = nowMs;
    }
    return this.emit(p.text, best, nowMs, false);
  }

  private emit(text: string, slot: Slot, nowMs: number, interrupt: boolean): CoachLine[] {
    // Fast mode: a queued count starts when the previous one ends, not now.
    const startAt = interrupt ? nowMs : Math.max(nowMs, this.busyUntil);
    this.busyUntil = startAt + this.estimateMs(text);
    this.speaking = slot;
    return [{ text, interrupt }];
  }
}

/**
 * Watches the camera frames while a live check is open and reports, once, when the user has
 * done it (same detectors the verifier runs). Used only for the coach's "Good."; the server's
 * verdict is what counts.
 */
export class ChallengeWatcher {
  private id: string | null = null;
  private type: ChallengeType | null = null;
  private frames: PoseFrame[] = [];
  private fromMs: number | null = null;
  private lastCheckMs = Number.NEGATIVE_INFINITY;
  private done = false;

  constructor(
    private readonly checkEveryMs = 150,
    private readonly maxBufferMs = 12_000,
  ) {}

  /** The challenge on screen (or none). Resets the buffer when it changes. */
  watch(challenge: { id: string; type: ChallengeType } | null): void {
    if ((challenge?.id ?? null) === this.id) return;
    this.id = challenge?.id ?? null;
    this.type = challenge?.type ?? null;
    this.frames = [];
    this.fromMs = null;
    this.lastCheckMs = Number.NEGATIVE_INFINITY;
    this.done = false;
  }

  /** Feed one frame; returns the challenge id the first time it is detected as done. */
  push(frame: PoseFrame): string | null {
    if (this.id === null || this.type === null || this.done) return null;
    const t = frame.timestampMs;
    if (this.fromMs === null) this.fromMs = t;
    this.frames.push(frame);
    while (this.frames.length > 0 && t - this.frames[0].timestampMs > this.maxBufferMs) this.frames.shift();
    if (t - this.lastCheckMs < this.checkEveryMs) return null;
    this.lastCheckMs = t;
    if (detectChallenge(this.type, this.frames, this.fromMs, t).passed) {
      this.done = true;
      return this.id;
    }
    return null;
  }
}
