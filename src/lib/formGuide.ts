import { EXERCISES } from "@/lib/exercises";
import { makeTranslator, type Translator } from "@/lib/i18n";
import { en as messages } from "@/lib/i18n/messages";
import EN from "@/lib/i18n/messages/en/guide";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";

export type Demonstrator = "man" | "woman";

/** A licensed stock clip shown in the form guide. */
export interface GuideClip {
  /** Path under /public, e.g. "/guides/pushup-man.mp4". */
  src: string;
  poster: string;
  credit: {
    author: string;
    provider: "Pexels" | "Pixabay" | "Mixkit";
    /** Page of the original clip, linked from the credit line. */
    url: string;
  };
}

/** The phone distances used by the guides; each has `distance_<id>` / `distanceShort_<id>` messages. */
export type GuideDistance = "about2" | "about2_5" | "about3" | "1_5to2" | "2_5to3";

export interface FormGuideContent {
  title: string;
  /** Three short cues, in the order you do them. */
  cues: [string, string, string];
  placement: {
    /** Where the phone goes; drives the diagrams and the setup steps. */
    layout: "floor" | "standing";
    /** e.g. "about 2 m" (English; screens use placementDistance()). */
    distance: string;
    /** Which `distance_<id>` message the distance is. */
    distanceId: GuideDistance;
    /** For a raised phone: the height of the lens. */
    height?: "knee" | "seat" | "hip" | "chest";
    /** One extra, exercise-specific check. */
    tip?: string;
  };
  /**
   * Verified demo clips (same camera view as the exercise, whole body, must pass Fitr's own engine before they are
   * listed here). Until a clip exists the guide shows an animated skeleton of the same movement.
   */
  clips: Partial<Record<Demonstrator, GuideClip>>;
}

/** A guide without its text (title, cues, distance, tip come from the "guide" messages). */
interface GuideSpec {
  placement: Omit<FormGuideContent["placement"], "distance" | "tip">;
  clips: FormGuideContent["clips"];
}

const SPECS: Record<ExerciseKind, GuideSpec> = {
  pushup: {
    placement: {
      layout: "floor",
      distanceId: "about2",
    },
    clips: {},
  },
  squat: {
    placement: {
      layout: "standing",
      distanceId: "about2_5",
      height: "hip",
    },
    clips: {},
  },
  plank: {
    placement: {
      layout: "floor",
      distanceId: "about2",
    },
    clips: {},
  },
  lunge: {
    placement: {
      layout: "standing",
      distanceId: "about2_5",
      height: "hip",
    },
    clips: {},
  },
  situp: {
    placement: {
      layout: "floor",
      distanceId: "about2",
    },
    clips: {},
  },
  leg_raise: {
    placement: {
      layout: "floor",
      distanceId: "about2",
    },
    clips: {},
  },
  glute_bridge: {
    placement: {
      layout: "floor",
      distanceId: "1_5to2",
    },
    clips: {},
  },
  wall_sit: {
    placement: {
      layout: "standing",
      distanceId: "about2",
      height: "knee",
    },
    clips: {},
  },
  pike_pushup: {
    placement: {
      layout: "floor",
      distanceId: "about2",
    },
    clips: {},
  },
  jump_squat: {
    placement: {
      layout: "standing",
      distanceId: "about3",
      height: "hip",
    },
    clips: {},
  },
  pullup: {
    placement: {
      layout: "standing",
      distanceId: "2_5to3",
      height: "hip",
    },
    clips: {},
  },
  dip: {
    placement: {
      layout: "standing",
      distanceId: "about2",
      height: "seat",
    },
    clips: {},
  },
  burpee: {
    placement: {
      layout: "standing",
      distanceId: "about3",
      height: "hip",
    },
    clips: {},
  },
  mountain_climber: {
    placement: {
      layout: "floor",
      distanceId: "about2",
    },
    clips: {},
  },
  jumping_jack: {
    placement: {
      layout: "standing",
      distanceId: "2_5to3",
      height: "chest",
    },
    clips: {},
  },
  high_knees: {
    placement: {
      layout: "standing",
      distanceId: "2_5to3",
      height: "hip",
    },
    clips: {},
  },
};
/** Whether the exercise has an extra placement tip (`<kind>_placementTip`). */
function hasPlacementTip(kind: ExerciseKind): boolean {
  return `${kind}_placementTip` in EN;
}

const en = (key: string): string => EN[key as keyof typeof EN];

/**
 * The guides with their English text (title, cues, distance, tip) from the "guide" messages.
 * Screens show the text translated with guideTitle / guideCues / placementSteps below.
 */
export const FORM_GUIDES: Record<ExerciseKind, FormGuideContent> = Object.fromEntries(
  EXERCISE_KINDS.map((kind) => {
    const { placement, clips } = SPECS[kind];
    const content: FormGuideContent = {
      title: en(`${kind}_title`),
      cues: [en(`${kind}_cue1`), en(`${kind}_cue2`), en(`${kind}_cue3`)],
      placement: {
        ...placement,
        distance: en(`distance_${placement.distanceId}`),
        ...(hasPlacementTip(kind) ? { tip: en(`${kind}_placementTip`) } : {}),
      },
      clips,
    };
    return [kind, content];
  }),
) as Record<ExerciseKind, FormGuideContent>;

/** English, for callers that do not pass the app's translator. */
const EN_GUIDE = makeTranslator("en", messages, "guide");

type GuideKey = Parameters<Translator<"guide">>[0];

/** "How to do a push-up that counts", in the app's language. */
export function guideTitle(t: Translator<"guide">, kind: ExerciseKind): string {
  return t(`${kind}_title` as GuideKey);
}

/** The three cues, in the order you do them. */
export function guideCues(t: Translator<"guide">, kind: ExerciseKind): [string, string, string] {
  return [1, 2, 3].map((n) => t(`${kind}_cue${n}` as GuideKey)) as [string, string, string];
}

/** How far to stand from the phone: "about 2 m", or the short map label ("~2 m") when `short`. */
export function placementDistance(t: Translator<"guide">, kind: ExerciseKind, short = false): string {
  const id = SPECS[kind].placement.distanceId;
  return t(`${short ? "distanceShort" : "distance"}_${id}` as GuideKey);
}

/** The phone set-up as short numbered steps, in the order you do them. */
export function placementSteps(kind: ExerciseKind, t: Translator<"guide"> = EN_GUIDE): string[] {
  const { layout, height } = SPECS[kind].placement;
  const front = EXERCISES[kind].camera === "front";
  const steps = [
    layout === "floor"
      ? t("stepStandOnFloor")
      : t("stepStandRaised", { height: t(`height_${height ?? "hip"}` as GuideKey) }),
    t("stepBack", { distance: placementDistance(t, kind) }),
    front ? t("stepFaceFront") : layout === "floor" ? t("stepSideOnFloor") : t("stepSideOnStanding"),
    t("stepCheckPreview"),
  ];
  return hasPlacementTip(kind) ? [...steps, t(`${kind}_placementTip` as GuideKey)] : steps;
}
