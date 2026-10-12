import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";

export const display = loadInterTight("normal", { weights: ["600", "700", "800", "900"], subsets: ["latin"] }).fontFamily;
export const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
export const serif = loadSerif("italic", { weights: ["400"], subsets: ["latin"] }).fontFamily;

/** Fitr's palette, from the app's tokens (src/app/globals.css): ink blacks and the lime accent. */
export const C = {
  black: "#050607",
  ink: "#0A0B0D",
  surface: "#131518",
  raised: "#1A1D21",
  strong: "#24282D",
  border: "#2C3036",
  subtle: "#8D949F",
  muted: "#A3A9B2",
  text: "#F5F6F7",
  lime: "#C6F432",
  limeSoft: "#E4FB9A",
  limeDeep: "#3D4A10",
  limeDim: "rgba(198,244,50,0.12)",
  limeGlow: "rgba(198,244,50,0.32)",
  amber: "#FFB020",
  red: "#FF6B78",
  bone: "#F1F2EC",
};

export type Tone = "night" | "light" | "lime";
export const TONE: Record<Tone, { bg: string; ink: string; muted: string; line: string; accent: string }> = {
  night: { bg: C.ink, ink: C.text, muted: "rgba(245,246,247,0.55)", line: "rgba(245,246,247,0.12)", accent: C.lime },
  light: { bg: C.bone, ink: C.ink, muted: "rgba(10,11,13,0.55)", line: "rgba(10,11,13,0.12)", accent: "#5E7A00" },
  lime: { bg: C.lime, ink: C.ink, muted: "rgba(10,11,13,0.6)", line: "rgba(10,11,13,0.16)", accent: C.ink },
};

export const SCENE_TONE: Record<string, Tone> = {
  open: "night", problem: "light", turn: "night", install: "light", commit: "night", workout: "night",
  check: "night", reps: "night", goal: "night", verified: "light", claim: "night", crew: "lime", trust: "light", seeker: "night", next: "lime", close: "night",
};
