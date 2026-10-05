import type { FormIssue } from "@/lib/pose/types";
import { en, type Messages } from "@/lib/i18n/messages";

type WorkoutKey = keyof Messages["workout"] & string;

/**
 * Message key of the user-facing copy for every engine FormIssue. Typed as an exhaustive Record so
 * adding a new FormIssue to the shared contract fails type-checking until it has copy.
 * Kept free of React/CSS imports so pure modules (hudTracker) and tests can use it.
 */
export const FORM_ISSUE_KEY: Record<FormIssue, WorkoutKey> = {
  body_not_visible: "issueBodyNotVisible",
  unstable_tracking: "issueUnstableTracking",
  go_lower: "issueGoLower",
  extend_fully: "issueExtendFully",
  hips_sagging: "issueHipsSagging",
  hips_piked: "issueHipsPiked",
  body_not_horizontal: "issueBodyNotHorizontal",
  body_on_floor: "issueBodyOnFloor",
  chest_up: "issueChestUp",
  too_fast: "issueTooFast",
  face_camera: "issueFaceCamera",
  turn_side_on: "issueTurnSideOn",
  keep_back_on_wall: "issueKeepBackOnWall",
  keep_hips_high: "issueKeepHipsHigh",
  chin_over_bar: "issueChinOverBar",
  go_higher: "issueGoHigher",
  arms_overhead: "issueArmsOverhead",
  jump_higher: "issueJumpHigher",
};

/** A form issue's copy in `t`'s language (render) or, by default, in English. */
export function formIssueCopy(issue: FormIssue, t: (key: WorkoutKey) => string = (k) => en.workout[k]): string {
  return t(FORM_ISSUE_KEY[issue]);
}

/** English copy of every FormIssue (reference and tests; screens use formIssueCopy with a translator). */
export const FORM_ISSUE_COPY: Record<FormIssue, string> = Object.fromEntries(
  (Object.keys(FORM_ISSUE_KEY) as FormIssue[]).map((k) => [k, formIssueCopy(k)]),
) as Record<FormIssue, string>;

/** Whether an issue is about tracking (camera/framing) rather than the user's form. */
export const FORM_ISSUE_KIND: Record<FormIssue, "tracking" | "form"> = {
  body_not_visible: "tracking",
  unstable_tracking: "tracking",
  go_lower: "form",
  extend_fully: "form",
  hips_sagging: "form",
  hips_piked: "form",
  body_not_horizontal: "form",
  body_on_floor: "form",
  chest_up: "form",
  too_fast: "form",
  face_camera: "tracking",
  turn_side_on: "tracking",
  keep_back_on_wall: "form",
  keep_hips_high: "form",
  chin_over_bar: "form",
  go_higher: "form",
  arms_overhead: "form",
  jump_higher: "form",
};
