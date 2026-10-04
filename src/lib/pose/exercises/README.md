# Exercise modules

Each exercise is a folder `src/lib/pose/exercises/<kind>/`, where `<kind>` is its
`ExerciseKind` id (`src/lib/pose/types.ts`). `registry.ts` maps every kind to its module.
`createRepEngine(kind)` (`src/lib/pose/engine/index.ts`) and the form-guide demo
(`src/components/workout/GuideDemo.tsx`) only go through the registry.

The order of `EXERCISE_KINDS` is the **on-chain exercise code** (0..15). Never reorder it.
New kinds are only ever appended.

## What you own (engine agent for `<kind>`)

Change only files inside your folder:

| File | Purpose |
| --- | --- |
| `config.ts` | `<Pascal>Config` + `<UPPER>_DEFAULTS`. Replace the stub `type X = CommonEngineConfig` with `interface X extends CommonEngineConfig { ... }`. `engine/config.ts` already imports both into `EngineConfigMap` / `ENGINE_DEFAULTS`, so `createRepEngine(kind, overrides)` and `resolveConfig(kind)` type-check your keys. Import common settings from `@/lib/pose/engine/commonConfig`, **not** from `engine/config` (that would be an import cycle). |
| `engine.ts` (new) | Your engine class. |
| `index.ts` | Must keep exporting `createEngine(overrides?: EngineConfigOverrides<"<kind>">): RepEngine` and `demo: ExerciseDemo`. Build the engine from `resolveConfig("<kind>", overrides)`. |
| `synthetic.ts` (new, optional) | Skeletons and sequences for your movement (see below). |
| `__tests__/*.test.ts` | Your tests. vitest picks up `src/**/*.test.{ts,tsx}`. |

Everything shared is already in place. Do not edit these files: `types.ts`,
`engine/common.ts`, `engine/config.ts`, `testing/synthetic.ts`, `registry.ts`,
`formIssueCopy.ts`, `exercises.ts`, `formGuide.ts`. If you need a change there, say so in
your report.

## The engine contract (`RepEngine`, src/lib/pose/types.ts)

- **Pure and deterministic.** Time comes only from `frame.timestampMs`. Don't use
  `Date.now`, `Math.random` or browser APIs. The same frames must always give deep-equal
  outputs, and `reset()` must restore the exact initial state. The server attestor
  (`src/lib/attest/verify.ts`) re-runs your engine on the uploaded trace, so its count is the
  count that pays out.
- **Never throws on a frame.** Garbage frames (null, NaN, missing landmarks, 0×0 image) count
  as "no pose". The shared `engine/__tests__` suite runs malformed and messy sessions through
  **every** kind.
- **Initial state** has `phase: "searching"`, 0 reps and 0 holdMs, `primaryAngleDeg` and
  `bodyLineDeg` set to null, `formIssues: []`, `trackingConfidence: 0` and `side: null`. The
  summary starts at all zeros. The generic tests check these exact values.
- **Rep exercises** use phases `ready → up/down`, raise `rep` and `rep_rejected` events, and
  record `repDurationsMs`. Alternating exercises (lunge, mountain climbers, high knees) count
  **each side as 1 rep**. Timed holds (`unit: "seconds"`: plank, wall sit) use
  `holding/paused` and `hold_start/hold_pause`, add to `holdMs` and always report 0 reps.
- **Form issues**: use the existing `FormIssue` codes. Generic codes for the new exercises are
  already there, with UI copy: `face_camera`, `turn_side_on`, `keep_back_on_wall`,
  `keep_hips_high`, `chin_over_bar`, `go_higher`, `arms_overhead` and `jump_higher`. Sort
  issues with `sortIssues()` from `engine/common.ts`. Anything not in `ISSUE_PRIORITY` is
  dropped.
- **Reuse `engine/common.ts`.** It provides `BaseEngine` and `CyclicRepEngine` (side selection,
  visibility gating, teleport freeze, frame gaps, debouncing, issue hold and summary
  bookkeeping), `Debouncer` and `SideSelector`. The push-up, squat and plank engines in
  `src/lib/pose/engine/` are the reference implementations, so copy their structure.
- **Anti-cheat**: document your checks at the top of `engine.ts`, in the style of the header
  in `engine/index.ts`. At minimum: full range of motion with debounced hysteresis, a posture
  gate that stops the obvious fake (for example a standing arm wave counting as a dip), and a
  minimum rep time. Keep your `minRepMs` below the server's lenient pace limits in
  `attest/challenges.ts` (`HONEST_MS_PER_UNIT`) and `attest/verify.ts`
  (`minMedianRepMs` / `maxRepsPerMinute`). If those limits are wrong for your movement, report
  it.
- **Camera view** comes from `EXERCISES[kind].camera`. Side-view engines read the more visible
  body side (`SideSelector`). Front-view engines (pull-ups, jumping jacks, high knees) read
  both sides at once and should report `side: "both"`.

## The demo contract (`ExerciseDemo`, ./types.ts)

```ts
demo = {
  frames: cachedFrames(() => mySequence({ fps: DEMO_FPS, width: DEMO_WIDTH, height: DEMO_HEIGHT, reps: 1, ... })),
  judged: { joints: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE], label: "knee", good: (d) => d < 95 } | null,
  layout: "floor" | "standing",
};
```

- One clean, perfect-form loop of about 2–4 s at 30 fps on a 640×480 frame. **It must be
  counted by your own engine** (test this: run `demo.frames()` through `createEngine()` and
  expect 1 rep, or the full hold time).
- `judged` is the angle GuideDemo labels. `good(deg)` is true at the target end of the range
  (for example the bottom of a dip or the top of a bridge). With reduced motion, GuideDemo
  shows the middle of the longest "good" run. Use `null` when no single angle explains the
  movement.
- The near (highlighted) side is the **left** body side, as in `renderLandmarks`' default.

## Building synthetic sequences

`src/lib/pose/testing/synthetic.ts` (read-only for you) provides:

- `SideSkeleton`: near-side joints in a side-view world (y up, units of body height, facing
  +x), plus `headDir`, `faceDir` and `handDir`. Build one from joint angles using
  `PROPORTIONS` (segment lengths). `standingSkeleton`, `pushupSkeleton` and `plankSkeleton`
  are worked examples.
- `renderLandmarks(skeleton, layout, options)`: projects a skeleton to 33 MediaPipe-style
  normalized landmarks. The near side gets visibility 0.98 and the far side 0.6, offset
  slightly. `CameraLayout` is `"floor"` (wide framing for lying or propped bodies, floor at
  world y=0) or `"standing"` (tall framing). Options: `width`, `height`, `nearSide`,
  `mirror` and per-landmark `visibility`.
- `repTimeline({ reps, topAngle, bottomAngle, repMs, holdMs, leadInMs, leadOutMs })` and
  `keyframes([[t, angle], ...])`: angle-over-time profiles.
- Modifiers: `withJitter`, `withDropout`, `withGap`, `withTeleport`. Use `mulberry32(seed)`
  for any randomness.

`renderSequence` is private, so write your own small loop in your folder's `synthetic.ts`.
Map timestamps at `fps`, rounded to whole ms, to `{ timestampMs, landmarks:
renderLandmarks(...), imageWidth, imageHeight }`.

**Front-view exercises** (pull-ups, jumping jacks, high knees) cannot use `renderLandmarks`,
which is side-view only. The cardio agent adds a front renderer in its own folder (for example
`exercises/jumping_jack/frontView.ts`, exporting `renderFrontLandmarks(pose, options)` with
left and right joints mirrored about the body's midline, both sides fully visible). The
pull-up agent imports it from there once it exists, or builds its own in the meantime.
Anatomical left (`LM.LEFT_*`) appears on the **right** of an unmirrored front-facing image.

## Test expectations (per exercise)

1. Clean reps are counted exactly, at 15 and 30 fps, with and without jitter
   (`jitterDeg` about 4 and `withJitter` amplitude about 0.003). Holds credit time within
   about 0.5 s.
2. Partial range is rejected with the right `FormIssue`. A too-fast rep gives `too_fast`.
3. At least two cheat or near-miss movements count **0** (for example a squat-depth dip
   without a jump for `jump_squat`, a half pull-up, or knees not driven for mountain
   climbers).
4. Tracking loss mid-rep abandons the rep. A teleport freezes counting.
5. The demo loop is counted by the engine.
6. Determinism: the same frames give the same output, and `reset()` replays identically.
   (The generic suite already checks this for every kind using a plank-based messy session.
   Add your own with your movement.)

Run `npx vitest run src/lib/pose`, `npm run typecheck` and `npm run lint` before you report.
