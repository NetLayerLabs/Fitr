/** Shared helpers for the rep-engine tests (not a test file itself). */
import { createRepEngine, type EngineConfigOverrides } from "@/lib/pose/engine";
import type {
  EngineEvent,
  EnginePhase,
  EngineState,
  EngineUpdate,
  ExerciseKind,
  FormIssue,
  PoseFrame,
  SessionSummary,
} from "@/lib/pose/types";

export interface RunResult {
  updates: EngineUpdate[];
  events: EngineEvent[];
  final: EngineState;
  summary: SessionSummary;
  /** Phase after each frame, with consecutive duplicates collapsed. */
  phases: EnginePhase[];
  /** Every issue that appeared in formIssues at least once. */
  issuesSeen: Set<FormIssue>;
}

export function runFrames<K extends ExerciseKind>(
  kind: K,
  frames: readonly PoseFrame[],
  overrides?: EngineConfigOverrides<K>,
): RunResult {
  const engine = createRepEngine(kind, overrides);
  const updates: EngineUpdate[] = [];
  const phases: EnginePhase[] = [engine.getState().phase];
  const issuesSeen = new Set<FormIssue>();
  for (const frame of frames) {
    const update = engine.update(frame);
    updates.push(update);
    if (phases[phases.length - 1] !== update.state.phase) phases.push(update.state.phase);
    for (const issue of update.state.formIssues) issuesSeen.add(issue);
  }
  return {
    updates,
    events: updates.flatMap((u) => u.events),
    final: engine.getState(),
    summary: engine.summary(),
    phases,
    issuesSeen,
  };
}

export type RepEvent = Extract<EngineEvent, { type: "rep" }>;

export function repEvents(result: RunResult): RepEvent[] {
  return result.events.filter((e): e is RepEvent => e.type === "rep");
}

export function rejectionReasons(result: RunResult): FormIssue[] {
  return result.events.flatMap((e) => (e.type === "rep_rejected" ? [e.reason] : []));
}

export function eventsOfType<T extends EngineEvent["type"]>(
  result: RunResult,
  type: T,
): Extract<EngineEvent, { type: T }>[] {
  return result.events.filter((e): e is Extract<EngineEvent, { type: T }> => e.type === type);
}
