import type { ExerciseKind } from "@/lib/pose/types";

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
    /** Where the phone goes; drives the diagram. */
    layout: "floor" | "standing";
    distance: string;
    caption: string;
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
      distance: "~2 m",
      caption: "Phone on the floor about 2 m away, side-on, upright in portrait.",
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
      distance: "~2.5 m",
      caption: "Phone standing upright about 2.5 m away, side-on, around hip height.",
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
      distance: "~2 m",
      caption: "Phone on the floor about 2 m away, side-on, upright in portrait.",
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
      distance: "~2.5 m",
      caption: "Phone standing upright about 2.5 m away at hip height, side-on, room for your stride.",
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
      distance: "~2 m",
      caption: "Phone on the floor about 2 m away, side-on, upright in portrait.",
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
      distance: "~2 m",
      caption: "Phone on the floor about 2 m away, side-on, tilted up so your raised feet stay in frame.",
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
      distance: "~1.5–2 m",
      caption: "Phone on the floor about 1.5–2 m away, side-on to your hips, upright in portrait.",
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
      distance: "~2 m",
      caption: "Phone standing upright about 2 m away at knee-to-hip height, side-on to the wall.",
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
      distance: "~2 m",
      caption: "Phone on the floor about 2 m away, side-on, upright in portrait so your raised hips fit.",
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
      distance: "~3 m",
      caption: "Phone standing upright about 3 m away at hip height, side-on, headroom for the jump.",
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
      distance: "~2.5–3 m",
      caption: "Phone standing upright 2.5–3 m in front of the bar, front-facing, tilted up to fit bar and feet.",
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
      distance: "~2 m",
      caption: "Phone standing upright about 2 m away at seat height, side-on to you.",
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
      distance: "~3 m",
      caption: "Phone standing upright about 3 m away at hip height, side-on, whole body in frame standing and lying.",
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
      distance: "~2 m",
      caption: "Phone on the floor about 2 m away, side-on, upright in portrait.",
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
      distance: "~2.5–3 m",
      caption: "Phone standing upright 2.5–3 m in front of you at chest height, front-facing.",
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
      distance: "~2.5–3 m",
      caption: "Phone standing upright 2.5–3 m in front of you at hip height, front-facing.",
    },
    clips: {},
  },
};