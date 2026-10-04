import type { ExerciseKind } from "@/lib/pose/types";
import { EXERCISES } from "@/lib/exercises";

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

export interface FormGuideContent {
  title: string;
  /** Three short cues, in the order you do them. */
  cues: [string, string, string];
  placement: {
    /** Where the phone goes; drives the diagrams and the setup steps. */
    layout: "floor" | "standing";
    /** e.g. "about 2 m". */
    distance: string;
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

export const FORM_GUIDES: Record<ExerciseKind, FormGuideContent> = {
  pushup: {
    title: "How to do a push-up that counts",
    cues: [
      "Hands under your shoulders, body in one straight line from head to heels.",
      "Lower your chest until your elbows bend past 90°.",
      "Push all the way up until your arms are straight.",
    ],
    placement: {
      layout: "floor",
      distance: "about 2 m",
    },
    clips: {},
  },
  squat: {
    title: "How to do a squat that counts",
    cues: [
      "Feet about shoulder-width apart, heels flat on the floor.",
      "Sit back until your hips reach knee height, knees past 90°.",
      "Keep your chest up, then stand all the way tall.",
    ],
    placement: {
      layout: "standing",
      distance: "about 2.5 m",
      height: "hip",
    },
    clips: {},
  },
  plank: {
    title: "How to hold a plank that counts",
    cues: [
      "Forearms or hands directly under your shoulders.",
      "One straight line from shoulders to heels: no sagging, no piking.",
      "Hold still. The timer only runs while your form holds.",
    ],
    placement: {
      layout: "floor",
      distance: "about 2 m",
    },
    clips: {},
  },
  lunge: {
    title: "How to do a lunge that counts",
    cues: [
      "Stand tall, then take a long step so both knees can bend to 90°.",
      "Drop straight down until your back knee almost touches the floor, front shin vertical.",
      "Push through your front heel back to standing, then switch legs.",
    ],
    placement: {
      layout: "standing",
      distance: "about 2.5 m",
      height: "hip",
      tip: "Leave room for your stride in front and behind.",
    },
    clips: {},
  },
  situp: {
    title: "How to do a sit-up that counts",
    cues: [
      "Lie on your back, knees bent, feet flat. Hands across your chest or by your ears.",
      "Curl up until your chest is over your hips, torso upright.",
      "Lower under control until your shoulder blades touch the floor.",
    ],
    placement: {
      layout: "floor",
      distance: "about 2 m",
    },
    clips: {},
  },
  leg_raise: {
    title: "How to do a leg raise that counts",
    cues: [
      "Lie flat, legs straight, hands under your hips or by your sides.",
      "Keep your knees straight and lift your legs until they point at the ceiling.",
      "Lower slowly until your heels hover just above the floor. Don't let your lower back arch.",
    ],
    placement: {
      layout: "floor",
      distance: "about 2 m",
      tip: "Tilt the phone back slightly so your raised feet stay in frame.",
    },
    clips: {},
  },
  glute_bridge: {
    title: "How to do a glute bridge that counts",
    cues: [
      "Lie on your back, knees bent, feet flat and hip-width apart near your glutes.",
      "Squeeze your glutes and drive your hips up until knees, hips and shoulders form one line.",
      "Pause at the top, then lower your hips back to the floor.",
    ],
    placement: {
      layout: "floor",
      distance: "1.5–2 m",
    },
    clips: {},
  },
  wall_sit: {
    title: "How to hold a wall sit that counts",
    cues: [
      "Back flat against the wall, feet about two shoe-lengths out in front.",
      "Slide down until your thighs are level and your knees bend to 90°, knees over ankles.",
      "Hold still, back on the wall. The timer only runs while your form holds.",
    ],
    placement: {
      layout: "standing",
      distance: "about 2 m",
      height: "knee",
      tip: "The wall stays behind you and runs down the side of the frame.",
    },
    clips: {},
  },
  pike_pushup: {
    title: "How to do a pike push-up that counts",
    cues: [
      "From a push-up, walk your feet in and lift your hips high into an upside-down V.",
      "Bend your elbows to lower the top of your head toward the floor between your hands.",
      "Press back up until your arms are straight, hips staying high.",
    ],
    placement: {
      layout: "floor",
      distance: "about 2 m",
      tip: "Your raised hips must fit inside the top of the frame.",
    },
    clips: {},
  },
  jump_squat: {
    title: "How to do a jump squat that counts",
    cues: [
      "Feet shoulder-width apart, sit back until your knees bend past 90°.",
      "Explode up so both feet leave the floor.",
      "Land softly on the balls of your feet and sink straight into the next squat.",
    ],
    placement: {
      layout: "standing",
      distance: "about 3 m",
      height: "hip",
      tip: "Leave headroom: your hands must stay in frame at the top of the jump.",
    },
    clips: {},
  },
  pullup: {
    title: "How to do a pull-up that counts",
    cues: [
      "Grip the bar a little wider than your shoulders and hang with your arms fully straight.",
      "Pull your elbows down and back until your chin clears the bar.",
      "Lower under control all the way to a dead hang. No kipping.",
    ],
    placement: {
      layout: "standing",
      distance: "2.5–3 m",
      height: "hip",
      tip: "Tilt the phone up so the bar and your feet are both in frame.",
    },
    clips: {},
  },
  dip: {
    title: "How to do a dip that counts",
    cues: [
      "Hands on a sturdy chair, bench or bars behind you, arms straight, shoulders down.",
      "Bend your elbows to lower your body until they pass 90°.",
      "Press back up until your arms lock out at the top.",
    ],
    placement: {
      layout: "standing",
      distance: "about 2 m",
      height: "seat",
    },
    clips: {},
  },
  burpee: {
    title: "How to do a burpee that counts",
    cues: [
      "From standing, squat down and put your hands on the floor.",
      "Kick your feet back to a plank and do one full push-up.",
      "Jump your feet in, then jump up with your hands overhead.",
    ],
    placement: {
      layout: "standing",
      distance: "about 3 m",
      height: "hip",
      tip: "You must fit in frame both standing and down on the floor.",
    },
    clips: {},
  },
  mountain_climber: {
    title: "How to do mountain climbers that count",
    cues: [
      "Start in a straight-arm plank, hands under your shoulders.",
      "Drive one knee toward your chest, then switch legs. Each knee counts.",
      "Keep your hips level with your shoulders; don't let them bounce up.",
    ],
    placement: {
      layout: "floor",
      distance: "about 2 m",
    },
    clips: {},
  },
  jumping_jack: {
    title: "How to do a jumping jack that counts",
    cues: [
      "Stand facing the camera, feet together, arms by your sides.",
      "Jump your feet out wide as your hands swing up to meet overhead.",
      "Jump back to feet together, arms down. That's one.",
    ],
    placement: {
      layout: "standing",
      distance: "2.5–3 m",
      height: "chest",
      tip: "Your hands must stay in frame at the top of each jump.",
    },
    clips: {},
  },
  high_knees: {
    title: "How to do high knees that count",
    cues: [
      "Stand facing the camera, feet hip-width apart.",
      "Run in place, driving each knee up to hip height.",
      "Pump your arms and stay on the balls of your feet. Each knee counts.",
    ],
    placement: {
      layout: "standing",
      distance: "2.5–3 m",
      height: "hip",
    },
    clips: {},
  },
};
const HEIGHT_LABEL: Record<NonNullable<FormGuideContent["placement"]["height"]>, string> = {
  knee: "at knee height",
  seat: "at seat height",
  hip: "at hip height",
  chest: "at chest height",
};

/** The phone set-up as short numbered steps, in the order you do them. */
export function placementSteps(kind: ExerciseKind): string[] {
  const { layout, distance, height, tip } = FORM_GUIDES[kind].placement;
  const front = EXERCISES[kind].camera === "front";
  const steps = [
    layout === "floor"
      ? "Stand your phone upright (portrait) on the floor, leaning on something."
      : `Stand your phone upright (portrait) ${HEIGHT_LABEL[height ?? "hip"]}, on a chair, shelf or stand.`,
    `Step back ${distance} from the phone.`,
    front
      ? "Face the phone straight on."
      : layout === "floor"
        ? "Get down side-on to the phone, so your body runs across the screen from side to side."
        : "Turn side-on, so one shoulder points at the phone.",
    "Check the preview: your whole body, head to feet, is in the frame.",
  ];
  return tip ? [...steps, tip] : steps;
}
