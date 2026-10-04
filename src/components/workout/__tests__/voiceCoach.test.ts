import { describe, expect, it } from "vitest";
import type { EngineEvent, EngineState, FormIssue, Landmark, PoseFrame } from "@/lib/pose/types";
import { LM } from "@/lib/pose/landmarks";
import {
  ChallengeWatcher,
  SPOKEN_ISSUE,
  VoiceCoach,
  spokenChallenge,
  spokenGoal,
  spokenSeconds,
  type CoachFrame,
  type CoachLine,
  type VoiceCoachOptions,
} from "../voiceCoach";

function state(patch: Partial<EngineState> = {}): EngineState {
  return {
    exercise: "pushup",
    phase: "up",
    reps: 0,
    rejectedReps: 0,
    holdMs: 0,
    primaryAngleDeg: 160,
    bodyLineDeg: 178,
    formIssues: [],
    trackingConfidence: 0.9,
    side: "left",
    ...patch,
  };
}

function rep(n: number, t = 0): EngineEvent {
  return { type: "rep", repIndex: n, durationMs: 1500, minAngleDeg: 80, maxAngleDeg: 165, tMs: t };
}

function frame(patch: Partial<EngineState> = {}, events: EngineEvent[] = [], tilted = false): CoachFrame {
  return { state: state(patch), events, tilted };
}

const texts = (lines: CoachLine[]) => lines.map((l) => l.text);

function pushups(goal = 20, extra: Partial<VoiceCoachOptions> = {}) {
  return new VoiceCoach({ exerciseName: "Push-ups", unit: "reps", goal, ...extra });
}

/**
 * Drives a coach with frames every `stepMs` from `from` to `to`, with reps at the given times.
 * Returns everything said, with the time it was said.
 */
function run(
  coach: VoiceCoach,
  opts: { from: number; to: number; stepMs?: number; reps?: number[]; issue?: (t: number) => FormIssue | null },
) {
  const { from, to, stepMs = 50, reps = [], issue = () => null } = opts;
  const said: { t: number; text: string; interrupt: boolean }[] = [];
  let count = 0;
  for (let t = from; t <= to; t += stepMs) {
    const events: EngineEvent[] = [];
    while (count < reps.length && reps[count] <= t) {
      count++;
      events.push(rep(count, t));
    }
    const i = issue(t);
    for (const l of coach.update(frame({ reps: count, formIssues: i ? [i] : [] }, events), t)) said.push({ t, ...l });
  }
  return said;
}

describe("phrases", () => {
  it("speaks goals and durations naturally", () => {
    expect(spokenGoal("reps", 20, "Push-ups")).toBe("20 push-ups");
    expect(spokenGoal("reps", 1, "Push-ups")).toBe("1 rep");
    expect(spokenGoal("seconds", 60, "Plank")).toBe("1 minute plank");
    expect(spokenGoal("seconds", 120, "Plank")).toBe("2 minute plank");
    expect(spokenGoal("seconds", 45, "Wall sit")).toBe("45 second wall sit");
    expect(spokenSeconds(10)).toBe("10 seconds");
    expect(spokenSeconds(60)).toBe("1 minute");
    expect(spokenSeconds(70)).toBe("1 minute 10");
    expect(spokenSeconds(120)).toBe("2 minutes");
  });

  it("has a short cue for every form issue", () => {
    for (const cue of Object.values(SPOKEN_ISSUE)) {
      expect(cue.split(" ").length).toBeLessThanOrEqual(7);
      expect(cue).toMatch(/[.!]$/);
    }
    expect(SPOKEN_ISSUE.go_lower).toBe("Go lower.");
    expect(SPOKEN_ISSUE.extend_fully).toBe("Lock out.");
    expect(SPOKEN_ISSUE.hips_sagging).toBe("Hips up.");
    expect(SPOKEN_ISSUE.body_not_visible).toBe("Step back so I can see you.");
  });

  it("shortens challenge prompts", () => {
    expect(spokenChallenge({ id: "a", type: "raise_right_hand", prompt: "x" })).toBe("Raise your right hand!");
    expect(spokenChallenge({ id: "a", type: "hold_still_top", prompt: "x" })).toBe("Stand tall and hold still!");
    expect(spokenChallenge({ id: "a", prompt: "Touch your NOSE." })).toBe("Touch your nose!");
    expect(spokenChallenge({ id: "a", prompt: "  " })).toBe("Live check!");
  });
});

describe("VoiceCoach start and countdown", () => {
  it("says nothing until started, then the goal", () => {
    const coach = pushups();
    expect(coach.update(frame(), 0)).toEqual([]);
    expect(coach.start(0)).toEqual([{ text: "Let's go. 20 push-ups.", interrupt: false }]);
  });

  it("introduces timed holds by duration", () => {
    const coach = new VoiceCoach({ exerciseName: "Plank", unit: "seconds", goal: 60 });
    expect(texts(coach.start(0))).toEqual(["Let's go. 1 minute plank."]);
  });

  it("counts down 3, 2, 1, go in sync with the ready countdown", () => {
    const coach = pushups();
    coach.start(0);
    expect(texts(coach.countdown(3, 5000))).toEqual(["3"]);
    expect(texts(coach.countdown(3, 5100))).toEqual([]);
    expect(texts(coach.countdown(2, 6000))).toEqual(["2"]);
    expect(texts(coach.countdown(1, 7000))).toEqual(["1"]);
    expect(texts(coach.countdown(null, 8000))).toEqual(["Go."]);
  });

  it("says go when the countdown is skipped, and nothing for a countdown that never ran", () => {
    const coach = pushups();
    expect(coach.countdown(null, 0)).toEqual([]);
    coach.countdown(3, 5000);
    expect(texts(coach.countdown(null, 5400))).toEqual([]); // "3" still being said
    expect(texts(coach.tick(5700))).toEqual(["Go."]);
  });

  it("drops a digit that is still waiting when its second has passed", () => {
    const coach = pushups();
    coach.start(0); // ~1.9 s intro
    expect(coach.countdown(3, 100)).toEqual([]);
    expect(coach.countdown(2, 1100)).toEqual([]);
    expect(texts(coach.countdown(1, 2100))).toEqual(["1"]);
  });
});

describe("VoiceCoach rep counting", () => {
  it("counts every rep with halfway, 5 left, last one and the goal, then keeps counting", () => {
    const coach = pushups(20);
    const reps = Array.from({ length: 22 }, (_, i) => 1000 + i * 1500);
    const said = texts(run(coach, { from: 0, to: 1000 + 23 * 1500, reps }).map((s) => ({ text: s.text, interrupt: s.interrupt })));
    expect(said).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9",
      "10. Halfway.",
      "11", "12", "13", "14",
      "15. 5 left.",
      "16", "17", "18",
      "19. Last one.",
      "Goal! 20 push-ups.",
      "21", "22",
    ]);
  });

  it("merges milestones sensibly on small goals", () => {
    const coach = pushups(10);
    const reps = Array.from({ length: 10 }, (_, i) => i * 1500);
    const said = run(coach, { from: 0, to: 16_000, reps }).map((s) => s.text);
    expect(said).toContain("5. Halfway.");
    expect(said).not.toContain("5. 5 left.");
    expect(said).toContain("9. Last one.");
    expect(said.at(-1)).toBe("Goal! 10 push-ups.");
  });

  it("never lags: a newer count replaces an unsaid one, keeping the stronger milestone", () => {
    const coach = pushups(20, { timing: { msPerWord: 2000 } });
    coach.update(frame({}, [rep(9)]), 0);
    expect(texts(coach.update(frame({}, [rep(10)]), 100))).toEqual([]);
    expect(texts(coach.update(frame({}, [rep(11)]), 200))).toEqual([]);
    // 9 takes 2.15 s; then the latest count with the halfway it carried.
    expect(texts(coach.tick(2200))).toEqual(["11. Halfway."]);
  });

  it("counts faster on big goals: the next count is queued just before the last one ends", () => {
    const slow = pushups(20);
    slow.update(frame({}, [rep(1)]), 0); // "1" ~450 ms
    expect(slow.update(frame({}, [rep(2)]), 300)).toEqual([]);

    const fast = pushups(40);
    fast.update(frame({}, [rep(1)]), 0);
    expect(texts(fast.update(frame({}, [rep(2)]), 300))).toEqual(["2"]);
  });
});

describe("VoiceCoach timed holds", () => {
  function hold(goal: number, toSec: number) {
    const coach = new VoiceCoach({ exerciseName: "Plank", unit: "seconds", goal });
    const said: string[] = [];
    for (let t = 0; t <= toSec * 1000; t += 100) {
      said.push(...texts(coach.update(frame({ phase: "holding", holdMs: t }), 10_000 + t)));
    }
    return said;
  }

  it("announces every 10 s, halfway, the last 5 s and the goal, then continues", () => {
    expect(hold(60, 80)).toEqual([
      "10 seconds",
      "20 seconds",
      "Halfway.",
      "40 seconds",
      "50 seconds",
      "5", "4", "3", "2", "1",
      "Goal! 1 minute plank.",
      "1 minute 10",
      "1 minute 20",
    ]);
  });

  it("keeps short holds simple", () => {
    expect(hold(8, 10)).toEqual(["Goal! 8 second plank.", "10 seconds"]);
  });

  it("does not count while the hold is paused", () => {
    const coach = new VoiceCoach({ exerciseName: "Plank", unit: "seconds", goal: 60 });
    const said: string[] = [];
    for (let t = 0; t < 30_000; t += 100) {
      said.push(...texts(coach.update(frame({ phase: "paused", holdMs: 9_500 }), t)));
    }
    expect(said).toEqual([]);
  });
});

describe("VoiceCoach form feedback", () => {
  it("speaks a stable issue once it has lasted a moment", () => {
    const coach = pushups();
    const said = run(coach, { from: 0, to: 1000, issue: () => "go_lower" });
    expect(said).toEqual([{ t: 600, text: "Go lower.", interrupt: false }]);
  });

  it("ignores flickering issues", () => {
    const coach = pushups();
    const said = run(coach, { from: 0, to: 5000, issue: (t) => (Math.floor(t / 300) % 2 === 0 ? "go_lower" : null) });
    expect(said).toEqual([]);
  });

  it("repeats the same issue at most every 6 s and any issue at most every 3 s", () => {
    const coach = pushups();
    const same = run(coach, { from: 0, to: 14_000, issue: () => "hips_sagging" });
    expect(same.map((s) => s.t)).toEqual([600, 6600, 12_600]);

    const other = pushups();
    // Switches issue every 1 s: still at most one cue per 3 s.
    const said = run(other, {
      from: 0,
      to: 12_000,
      issue: (t) => (["go_lower", "hips_sagging", "extend_fully", "chest_up"] as FormIssue[])[Math.floor(t / 1000) % 4],
    });
    for (let i = 1; i < said.length; i++) expect(said[i].t - said[i - 1].t).toBeGreaterThanOrEqual(3000);
    expect(said.length).toBeGreaterThan(1);
  });

  it("never cuts into a rep count, and drops a cue that went stale waiting", () => {
    const coach = pushups(20, { timing: { msPerWord: 3000 } });
    coach.update(frame({}, [rep(1)]), 0); // speaking until ~3150
    const said = run(coach, { from: 0, to: 2000, issue: (t) => (t < 1200 ? "go_lower" : null) });
    expect(said).toEqual([]);
    expect(coach.tick(3200)).toEqual([]);
  });

  it("says a rejected rep with its reason, throttled", () => {
    const coach = pushups();
    const reject = (t: number): EngineEvent => ({ type: "rep_rejected", reason: "go_lower", tMs: t });
    expect(texts(coach.update(frame({}, [reject(0)]), 0))).toEqual(["Didn't count. Go lower."]);
    expect(texts(coach.update(frame({}, [reject(2000)]), 2000))).toEqual([]);
    expect(texts(coach.update(frame({}, [reject(4500)]), 4500))).toEqual(["Didn't count. Go lower."]);
    // The rejection also counts as the "go lower" cue for the issue throttle.
    expect(run(coach, { from: 4600, to: 9000, issue: () => "go_lower" })).toEqual([]);
  });

  it("asks to stand the phone upright when it is tilted", () => {
    const coach = pushups();
    expect(texts(coach.update(frame({ formIssues: ["body_not_visible"] }, [], true), 0))).toEqual([
      "Stand your phone upright.",
    ]);
  });
});

describe("VoiceCoach live challenges", () => {
  const ch = { id: "c1", type: "raise_right_hand" as const, prompt: "Raise your RIGHT hand above your head" };

  it("interrupts with the instruction, then says good when passed", () => {
    const coach = pushups();
    coach.update(frame({}, [rep(3)]), 0);
    expect(coach.challenge({ ...ch, deadline: 6000 }, 100)).toEqual([{ text: "Raise your right hand!", interrupt: true }]);
    // Same challenge again (every chunk response): nothing new.
    expect(coach.challenge({ ...ch, deadline: 6000 }, 200)).toEqual([]);
    // Waits for the instruction to finish, never interrupts it.
    expect(coach.challengePassed("c1", 1000)).toEqual([]);
    expect(texts(coach.tick(100 + coach.estimateMs("Raise your right hand!")))).toEqual(["Good."]);
    expect(coach.challengePassed("c1", 20_000)).toEqual([]);
  });

  it("repeats an unanswered instruction once, while there is time", () => {
    const coach = pushups();
    coach.challenge({ ...ch, deadline: 6000 }, 0);
    expect(texts(coach.tick(3500))).toEqual(["Raise your right hand!"]);
    expect(coach.tick(5000)).toEqual([]);

    const late = pushups();
    late.challenge({ ...ch, deadline: 4000 }, 0);
    expect(late.tick(3500)).toEqual([]);
  });

  it("holds back form chatter during the check, and ignores passes for other checks", () => {
    const coach = pushups();
    coach.challenge(ch, 0);
    const said = run(coach, { from: 1500, to: 3400, issue: () => "go_lower" });
    expect(said).toEqual([]);
    expect(coach.challengePassed("other", 3400)).toEqual([]);
    expect(texts(coach.update(frame({}, [{ type: "rep_rejected", reason: "go_lower", tMs: 0 }]), 3450))).toEqual([]);
  });

  it("forgets a check that closed", () => {
    const coach = pushups();
    coach.challenge(ch, 0);
    coach.challenge(null, 2000);
    expect(coach.tick(4000)).toEqual([]);
    expect(coach.challengePassed("c1", 4000)).toEqual([]);
  });
});

describe("VoiceCoach stop and silence", () => {
  it("never speaks after stop", () => {
    const coach = pushups();
    coach.start(0);
    coach.stop();
    expect(coach.isStopped).toBe(true);
    expect(coach.start(5000)).toEqual([]);
    expect(coach.update(frame({}, [rep(1)]), 5000)).toEqual([]);
    expect(coach.countdown(3, 5000)).toEqual([]);
    expect(coach.challenge({ id: "x", prompt: "Wave" }, 5000)).toEqual([]);
    expect(coach.challengePassed("x", 5000)).toEqual([]);
    expect(coach.tick(5000)).toEqual([]);
  });

  it("silence drops what is waiting and frees the voice", () => {
    const coach = pushups(20, { timing: { msPerWord: 3000 } });
    coach.update(frame({}, [rep(1)]), 0);
    coach.update(frame({}, [rep(2)]), 100);
    coach.silence();
    expect(texts(coach.update(frame({}, [rep(3)]), 200))).toEqual(["3"]);
  });
});

describe("ChallengeWatcher", () => {
  function body(rightHandUp: boolean, t: number): PoseFrame {
    const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
    const set = (i: number, x: number, y: number) => (lms[i] = { x, y, z: 0, visibility: 0.99 });
    set(LM.NOSE, 0.5, 0.2);
    set(LM.LEFT_SHOULDER, 0.6, 0.3);
    set(LM.RIGHT_SHOULDER, 0.4, 0.3);
    set(LM.LEFT_HIP, 0.58, 0.6);
    set(LM.RIGHT_HIP, 0.42, 0.6);
    set(LM.LEFT_WRIST, 0.65, 0.55);
    set(LM.RIGHT_WRIST, 0.38, rightHandUp ? 0.05 : 0.55);
    return { timestampMs: t, landmarks: lms, imageWidth: 640, imageHeight: 480 };
  }

  it("reports a passed check once", () => {
    const w = new ChallengeWatcher();
    expect(w.push(body(true, 0))).toBeNull(); // nothing watched
    w.watch({ id: "c1", type: "raise_right_hand" });
    const hits: string[] = [];
    for (let t = 0; t < 600; t += 33) if (w.push(body(t > 100, t))) hits.push("c1");
    for (let t = 600; t < 1500; t += 33) if (w.push(body(true, t))) hits.push("again");
    expect(hits).toEqual(["c1"]);
  });

  it("does not pass the wrong hand, and resets for a new check", () => {
    const w = new ChallengeWatcher();
    w.watch({ id: "c1", type: "raise_left_hand" });
    for (let t = 0; t < 1500; t += 33) expect(w.push(body(true, t))).toBeNull();
    w.watch({ id: "c2", type: "raise_right_hand" });
    let hit: string | null = null;
    for (let t = 1500; t < 2500 && !hit; t += 33) hit = w.push(body(true, t));
    expect(hit).toBe("c2");
    w.watch(null);
    expect(w.push(body(true, 3000))).toBeNull();
  });
});
