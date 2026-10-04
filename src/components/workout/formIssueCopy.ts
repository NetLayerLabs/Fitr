import type { FormIssue } from "@/lib/pose/types";

/**
 * User-facing copy for every engine FormIssue. Typed as an exhaustive Record so adding a new
 * FormIssue to the shared contract fails type-checking until it has copy here.
 * Kept free of React/CSS imports so pure modules (hudTracker) and tests can use it.
 */
export const FORM_ISSUE_COPY: Record<FormIssue, string> = {
  body_not_visible: "Step back so your whole body is in frame",
  unstable_tracking: "Tracking is shaky. Steady the phone and add light",
  go_lower: "Go lower, bend past 90°",
  extend_fully: "Extend fully at the top",
  hips_sagging: "Lift your hips, keep a straight line",
  hips_piked: "Lower your hips, keep a straight line",
  body_not_horizontal: "Get down into position",
  body_on_floor: "Lift off the floor: legs straight, up on your toes",
  chest_up: "Keep your chest up",
  too_fast: "Slow down, control each rep",
  face_camera: "Face the camera square-on",
  turn_side_on: "Turn side-on to the camera",
  keep_back_on_wall: "Keep your back flat against the wall",
  keep_hips_high: "Keep your hips high, like an upside-down V",
  chin_over_bar: "Pull until your chin clears the bar",
  go_higher: "Go higher, use the full range",
  arms_overhead: "Bring your hands together overhead",
  jump_higher: "Jump, both feet off the floor",
};

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
