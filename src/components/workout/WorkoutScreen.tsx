"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CameraIcon, ShieldIcon } from "@/components/icons/Icons";
import { useSelectedWallet } from "@/components/wallet/hooks";
import { getPreferences, setPreference, usePreferences } from "@/components/you/preferences";
import { useCamera } from "@/hooks/useCamera";
import { useGuidePrefs } from "@/hooks/useGuidePrefs";
import { useHydrated } from "@/hooks/useSessions";
import { requestDeviceOrientationAccess, useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { usePoseStream } from "@/hooks/usePoseStream";
import { useStandaloneDisplay } from "@/hooks/useStandaloneDisplay";
import { useVerifiedSession, type UseVerifiedSessionOptions, type VerifiedStatus } from "@/hooks/useVerifiedSession";
import { EXERCISES } from "@/lib/exercises";
import { createRepEngine } from "@/lib/pose/engine";
import { gateFrameByOrientation } from "@/lib/pose/runtime/orientation";
import type { ExerciseKind, PoseFrame, RepEngine, SessionSummary } from "@/lib/pose/types";
import { exerciseName, exerciseNameInSentence } from "@/lib/i18n/exercise";
import { useT } from "@/lib/i18n/I18nProvider";
import { speak, speechLocale, stopSpeaking } from "@/lib/native/bridge";
import { createSessionId, saveSession } from "@/lib/storage/history";
import ChallengePrompt from "./ChallengePrompt";
import FormGuide from "./FormGuide";
import FinishedView, { hasWork, type FinishedResult, type SaveState } from "./FinishedView";
import { formatGoal } from "./format";
import Hud, { type HudVerification } from "./Hud";
import { createHudTracker, INITIAL_HUD, type HudSnapshot, type HudTracker } from "./hudTracker";
import { computeMapping, drawSkeleton, type FitMode } from "./overlay";
import ReadyCountdown from "./ReadyCountdown";
import SetupView, { type CameraFacing } from "./SetupView";
import StakeBanner from "./StakeBanner";
import StatusPanel from "./StatusPanel";
import VerificationCard from "./VerificationCard";
import { useWakeLock } from "./useWakeLock";
import { rich } from "./rich";
import { ChallengeWatcher, speechTranslator, VoiceCoach, type CoachLine } from "./voiceCoach";
import { markVerificationFailed } from "@/lib/storage/verifyFailures";
import styles from "./WorkoutScreen.module.css";

type Stage = "setup" | "live" | "finished";

/** Canvas backing-store cap: 3x is already sharper than the overlay needs and saves fill-rate. */
const MAX_DPR = 3;

/** "Ready to go" countdown once tracking first sees a frame. */
const COUNTDOWN_SECS = 3;

/** Verified-session states in which this visit ran (or is running) a staked session. */
const VERIFIED_RUN: ReadonlySet<VerifiedStatus> = new Set(["starting", "recording", "finishing", "verified", "failed", "error"]);

/**
 * Marks the extra same-URL history entry pushed while a workout is live or finished but
 * unsaved, so the browser / Android back button pops that entry (handled here) instead of
 * leaving the page and silently losing the session.
 */
const GUARD_KEY = "fitrWorkoutGuard";

function onGuardEntry(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[GUARD_KEY] === true;
}

interface OverlayView {
  /** CSS px size of the video box (the shared, possibly mirrored wrapper). */
  width: number;
  height: number;
  dpr: number;
  fontFamily: string;
}

function emptySummary(exercise: ExerciseKind): SessionSummary {
  return {
    exercise,
    reps: 0,
    rejectedReps: 0,
    holdMs: 0,
    repDurationsMs: [],
    activeMs: 0,
    framesProcessed: 0,
    framesWithPose: 0,
    avgTrackingConfidence: 0,
  };
}

function vibrate(pattern: number | number[]): void {
  // Haptics can be turned off on the You tab (read live, so a change applies mid-workout).
  if (!getPreferences().haptics) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // Some browsers throw without a recent user gesture; haptics are optional.
  }
}

/** Hands lines from the voice coach to TTS, unless the coach is turned off on the You tab (read live). */
function say(lines: readonly CoachLine[]): void {
  if (lines.length === 0 || !getPreferences().voiceCoach) return;
  for (const line of lines) speak(line.text, line.interrupt);
}

export interface WorkoutScreenProps {
  exercise: ExerciseKind;
  /** Injection point for tests (commitment loader, fetch, clocks). The app passes nothing. */
  verification?: Pick<UseVerifiedSessionOptions, "loadCommitment" | "deps">;
}

/**
 * The workout flow: SETUP -> (camera permission / model loading) -> LIVE -> FINISHED.
 *
 * Per-frame work (engine update, overlay drawing, HUD diffing) happens imperatively in the pose
 * stream callback. React state only changes when a displayed HUD value changes (see hudTracker).
 *
 * Leaving by accident: while LIVE, and while FINISHED with an unsaved workout, an extra history
 * entry (GUARD_KEY) sits on top of this page. Back pops it: LIVE ends the session and shows the
 * summary (or returns to setup when nothing was counted yet); an unsaved summary asks "Discard
 * this workout?" (a second back closes the question again). Reloading or closing the tab while
 * LIVE asks the browser's leave-page confirmation. In-app exits (Save, Discard, Done) replace
 * the guard entry instead of stacking a new one.
 *
 * Orientation: while the phone is known to be on its side or upside down, frames reach the
 * engine without a pose (nothing counts) and the HUD asks to stand the phone upright; the
 * engine's posture checks assume image-down is gravity.
 */
export default function WorkoutScreen({ exercise, verification }: WorkoutScreenProps) {
  const info = EXERCISES[exercise];
  const t = useT("workout");
  const name = exerciseName(useT("exercises"), exercise);
  const router = useRouter();

  // Staked workouts: today's commitment for this exercise turns on server verification.
  const { owner } = useSelectedWallet();
  const verified = useVerifiedSession({ exercise, owner, ...verification });
  const goal = verified.commitment?.goalTarget ?? info.defaultGoal;
  const stakedRun = VERIFIED_RUN.has(verified.status);

  const [stage, setStage] = useState<Stage>("setup");
  // Starts on the camera chosen on the You tab (defaults during SSR/hydration); a choice made
  // on setup overrides it for this visit.
  const prefs = usePreferences();
  const [facingChoice, setFacing] = useState<CameraFacing | null>(null);
  const facing: CameraFacing = facingChoice ?? prefs.camera;
  // "contain" shows exactly the frame the model sees (nothing cropped), which is what matters
  // for getting your whole body in view; the HUD toggle switches to a full-bleed "cover".
  const [fit, setFit] = useState<FitMode>("contain");
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [announcement, setAnnouncement] = useState("");
  const [result, setResult] = useState<FinishedResult | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("unsaved");
  // Form guide before setup: "auto" follows the saved "don't show again" choice for this
  // exercise; "open" / "closed" are explicit choices made on this visit.
  const [guideChoice, setGuideChoice] = useState<"auto" | "open" | "closed">("auto");
  const guideHidden = useGuidePrefs()[exercise];
  const hydrated = useHydrated();
  // "Ready to go" countdown, started by the first tracked frame of each session.
  const [countdown, setCountdown] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const trackingRef = useRef(false);

  const live = stage === "live";
  const orientation = useDeviceOrientation(live);
  const tilted = orientation === "tilted";
  const standalone = useStandaloneDisplay();
  // Destructured on purpose: the React Compiler treats an object that carries a ref as a ref.
  const {
    videoRef,
    status: cameraStatus,
    error: cameraError,
    facingMode: activeFacing,
    retry: retryCamera,
  } = useCamera({ enabled: live, facingMode: facing });
  const mirrored = activeFacing === "user";

  // One engine + HUD tracker per session, created in the Start handler.
  const engineRef = useRef<RepEngine | null>(null);
  const trackerRef = useRef<HudTracker | null>(null);
  const startClickedAtRef = useRef(0);
  const firstPoseAtRef = useRef(0);
  // Voice coach for the running session (created on Start, so nothing is said before that).
  const coachRef = useRef<VoiceCoach | null>(null);
  const watcherRef = useRef<ChallengeWatcher | null>(null);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<OverlayView | null>(null);

  useWakeLock(live);

  // Keep the overlay canvas backing store matched to the video box (CSS px * devicePixelRatio).
  useEffect(() => {
    if (!live) return;
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;

    const fontFamily = getComputedStyle(box).fontFamily || "system-ui, sans-serif";
    const resize = () => {
      // clientWidth/Height are layout sizes: unaffected by the mirror transform.
      const width = box.clientWidth;
      const height = box.clientHeight;
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_DPR);
      const backingWidth = Math.max(1, Math.round(width * dpr));
      const backingHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;
      viewRef.current = { width, height, dpr, fontFamily };
    };

    resize();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    observer?.observe(box);
    // devicePixelRatio changes (browser zoom, moving between screens) do not resize the box.
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      viewRef.current = null;
    };
  }, [live]);

  const poseEnabled = live && cameraStatus === "ready";

  // Don't leave a frozen skeleton on screen while tracking is paused (camera restarting, etc.).
  useEffect(() => {
    if (poseEnabled) return;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [poseEnabled]);

  const pose = usePoseStream({
    videoRef,
    enabled: poseEnabled,
    onFrame: (frame: PoseFrame) => {
      const engine = engineRef.current;
      const tracker = trackerRef.current;
      if (!engine || !tracker) return;

      // A phone on its side / upside down: the engine gets no pose, so nothing is counted.
      const input = gateFrameByOrientation(frame, orientation);
      const { state, events } = engine.update(input);
      // Staked run: the verifier gets exactly what the engine saw (no-op otherwise).
      verified.record(input, { state, events });
      if (!trackingRef.current) {
        trackingRef.current = true;
        setTracking(true);
        setCountdown(COUNTDOWN_SECS);
      }
      const hasPose = input.landmarks.length > 0;
      if (hasPose && firstPoseAtRef.current === 0) firstPoseAtRef.current = Date.now();

      const canvas = canvasRef.current;
      const view = viewRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && view) {
        // Overlay alignment. The <video> is drawn by the browser with object-fit (cover or
        // contain, centered) inside a view of view.width x view.height CSS px; the canvas covers
        // the same box. Landmarks are normalized to the frame the model saw, whose size is the
        // video's intrinsic size (frame.imageWidth x frame.imageHeight, i.e. useCamera().dimensions).
        // computeMapping reproduces the browser's math:
        //   s  = cover ? max(vw/iw, vh/ih) : min(vw/iw, vh/ih)
        //   ox = (vw - iw*s) / 2,  oy = (vh - ih*s) / 2
        //   x  = ox + nx*iw*s,     y  = oy + ny*ih*s
        // Front camera: video and canvas share one wrapper flipped with scaleX(-1), so both are
        // mirrored together and the drawing itself stays in unmirrored source coordinates.
        const mapping = computeMapping(frame.imageWidth, frame.imageHeight, view.width, view.height, fit);
        drawSkeleton(ctx, input, state, mapping, { dpr: view.dpr, mirrored, fontFamily: view.fontFamily });
      }

      const out = tracker.update(state, events, frame.timestampMs, hasPose);
      if (out.vibrate !== null) vibrate(out.vibrate);
      if (out.hud) setHud(out.hud);
      if (out.announce) setAnnouncement(out.announce);

      const coach = coachRef.current;
      if (coach) {
        const now = Date.now();
        say(coach.update({ state, events, tilted }, now));
        const passed = watcherRef.current?.push(input) ?? null;
        if (passed) say(coach.challengePassed(passed, now));
      }
    },
  });

  // Open the attestor session once tracking runs (also when the stake lookup finishes late).
  const canBegin = live && tracking && verified.status === "ready";
  const beginVerified = verified.begin;
  useEffect(() => {
    if (canBegin) beginVerified();
  }, [canBegin, beginVerified]);

  // Voice coach: the ready countdown ("3, 2, 1, go") and live checks.
  useEffect(() => {
    if (live) say(coachRef.current?.countdown(countdown, Date.now()) ?? []);
  }, [live, countdown]);

  const challenge = live ? verified.challenge : null;
  useEffect(() => {
    watcherRef.current?.watch(challenge ? { id: challenge.id, type: challenge.type } : null);
    say(coachRef.current?.challenge(challenge, Date.now()) ?? []);
  }, [challenge]);

  // Quiet when the app goes to the background, and when this screen goes away.
  useEffect(() => {
    if (!live) return;
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      coachRef.current?.silence();
      stopSpeaking();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [live]);
  useEffect(
    () => () => {
      coachRef.current?.stop();
      coachRef.current = null;
      stopSpeaking();
    },
    [],
  );

  // Tick the countdown; a short buzz on "go".
  useEffect(() => {
    if (countdown === null) return;
    const id = setTimeout(() => {
      if (countdown <= 1) vibrate(80);
      setCountdown((c) => (c === null || c <= 1 ? null : c - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  function startSession() {
    // iOS only delivers orientation readings after a permission prompt from a user gesture.
    requestDeviceOrientationAccess();
    verified.reset();
    trackingRef.current = false;
    setTracking(false);
    setCountdown(null);
    engineRef.current = createRepEngine(exercise);
    trackerRef.current = createHudTracker({ exercise, unit: info.unit, goal });
    stopCoach();
    // The coach speaks the language the voice can (the app language, else English).
    const voiceLocale = speechLocale();
    coachRef.current = new VoiceCoach({
      exerciseName: exerciseNameInSentence(speechTranslator("exercises", voiceLocale), exercise),
      unit: info.unit,
      goal,
      t: speechTranslator("voice", voiceLocale),
    });
    watcherRef.current = new ChallengeWatcher();
    // Spoken inside the Start tap: browsers only allow speech after a user gesture.
    say(coachRef.current.start(Date.now()));
    startClickedAtRef.current = Date.now();
    firstPoseAtRef.current = 0;
    setHud(INITIAL_HUD);
    setAnnouncement("");
    setResult(null);
    setSaveState("unsaved");
    setStage("live");
  }

  function stopCoach() {
    if (coachRef.current) {
      coachRef.current.stop();
      stopSpeaking();
    }
    coachRef.current = null;
    watcherRef.current = null;
  }

  function endSession() {
    stopCoach();
    const endedAt = Date.now();
    const summary = engineRef.current?.summary() ?? emptySummary(exercise);
    const value = info.unit === "seconds" ? summary.holdMs / 1000 : summary.reps;
    // The session starts when tracking first saw the body (not while the model was loading).
    const startedAt = Math.min(endedAt, firstPoseAtRef.current || startClickedAtRef.current || endedAt);
    engineRef.current = null;
    trackerRef.current = null;
    setCountdown(null);
    // Staked run: flush the trace and ask the verifier for its verdict (shown on the summary).
    verified.finish();
    setResult({
      id: createSessionId(),
      summary,
      startedAt,
      endedAt,
      goal,
      goalMet: goal > 0 && value >= goal,
    });
    setSaveState("unsaved");
    setStage("finished");
  }

  /** Back to setup; also drops the back-button guard entry unless back already popped it. */
  function cancelToSetup(popGuard = true) {
    stopCoach();
    engineRef.current = null;
    trackerRef.current = null;
    setCountdown(null);
    verified.cancel();
    setStage("setup");
    if (popGuard && onGuardEntry()) window.history.back();
  }

  /** In-app navigation away from the workout: replace the guard entry rather than stack on it. */
  function leave(href: string) {
    if (onGuardEntry()) router.replace(href);
    else router.push(href);
  }

  const worked = result !== null && hasWork(result.summary);
  // Once something was counted, a camera hiccup must not throw the work away: offer to end
  // (and review/save) instead of going back to setup.
  const hasProgress = hud.reps > 0 || hud.holdTenths >= 10;
  const guard: "live" | "unsaved" | null =
    stage === "live" ? "live" : stage === "finished" && saveState === "unsaved" && worked ? "unsaved" : null;
  const [discardPrompt, setDiscardPrompt] = useState(0);

  // Arm the back-button guard: one extra same-URL entry, reused across live -> finished.
  const guardHrefRef = useRef<string | null>(null);
  const leavingRef = useRef(false);
  useEffect(() => {
    if (!guard) return;
    if (!onGuardEntry()) window.history.pushState({ [GUARD_KEY]: true }, "");
    guardHrefRef.current = window.location.href;
    leavingRef.current = false;
  }, [guard]);

  // What back does in each stage, read through a ref so the listener below stays registered.
  const onBack = () => {
    if (guard === "live") {
      if (hasProgress) endSession();
      else cancelToSetup(false);
    } else if (guard === "unsaved") {
      window.history.pushState({ [GUARD_KEY]: true }, "");
      setDiscardPrompt((n) => n + 1);
    } else {
      // Nothing to protect (saved, or nothing counted): the user meant to leave and only our
      // same-URL guard entry was popped, so keep going (once: the next popstate is the real
      // navigation away).
      leavingRef.current = true;
      window.history.back();
    }
  };
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  const inWorkout = stage !== "setup";
  useEffect(() => {
    if (!inWorkout) return;
    leavingRef.current = false;
    const onPopState = () => {
      // Forward onto our own entry, a real navigation to another URL, or the second step of
      // leaving: not ours to handle.
      if (leavingRef.current || onGuardEntry() || window.location.href !== guardHrefRef.current) return;
      onBackRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [inWorkout]);

  // Reload / tab close mid-workout: let the browser ask first.
  useEffect(() => {
    if (!live) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers only show the prompt when returnValue is set.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [live]);

  // A rejected verification must not leave the Today card on "Verifying".
  const failedEndedAt = verified.outcome?.kind === "failed" && result ? result.endedAt : null;
  useEffect(() => {
    if (failedEndedAt !== null) markVerificationFailed(failedEndedAt);
  }, [failedEndedAt]);

  /** Persists the finished session. Returns false unless it reached localStorage. */
  function persist(): boolean {
    if (!result) return false;
    let next: SaveState;
    try {
      next = saveSession({ ...result, exercise }) ? "saved" : "memory-only";
    } catch {
      next = "failed";
    }
    setSaveState(next);
    return next === "saved";
  }

  if (stage === "setup") {
    // The guide preference lives in localStorage; wait one frame for it rather than flashing
    // the wrong screen.
    if (!hydrated) return <div className={styles.page} />;
    if (guideChoice === "open" || (guideChoice === "auto" && !guideHidden)) {
      return <FormGuide exercise={exercise} onContinue={() => setGuideChoice("closed")} />;
    }
    return (
      <SetupView
        exercise={exercise}
        facing={facing}
        onFacingChange={setFacing}
        onStart={startSession}
        onOpenGuide={() => setGuideChoice("open")}
        goal={goal}
        verified={verified.status === "ready" || verified.status === "error"}
        stake={
          <StakeBanner
            status={verified.status}
            commitment={verified.commitment}
            otherExercise={verified.otherExercise}
            error={verified.error}
          />
        }
      />
    );
  }

  if (stage === "finished" && result) {
    return (
      <FinishedView
        exercise={exercise}
        result={result}
        saveState={saveState}
        discardPrompt={discardPrompt}
        onSaveAndFinish={() => {
          if (persist()) leave("/");
        }}
        onSaveAndGoAgain={() => {
          if (persist()) startSession();
        }}
        onDiscard={() => leave("/")}
        onRetry={startSession}
        onGoHome={() => leave("/")}
        verification={
          stakedRun ? (
            <VerificationCard
              status={verified.status}
              outcome={verified.outcome}
              error={verified.error}
              unit={info.unit}
              onRetry={verified.finish}
              shareDayIndex={verified.commitment?.dayIndex ?? null}
              shareCrewId={verified.commitment?.crewId ?? null}
            />
          ) : null
        }
      />
    );
  }

  // ----- LIVE -----
  let panel: ReactNode = null;
  const backButton = hasProgress ? (
    <button type="button" className={styles.secondaryButton} onClick={endSession}>
      {t("endAndReview")}
    </button>
  ) : (
    <button type="button" className={styles.secondaryButton} onClick={() => cancelToSetup()}>
      {t("back")}
    </button>
  );
  const retryButton = (
    <button type="button" className={styles.primaryButton} onClick={retryCamera}>
      {t("tryAgain")}
    </button>
  );
  const retryPoseButton = (
    <button type="button" className={styles.primaryButton} onClick={pose.retry}>
      {t("tryAgain")}
    </button>
  );

  switch (cameraStatus) {
    case "idle":
    case "requesting":
      panel = (
        <StatusPanel tone="loading" title={t("startingCamera")} actions={backButton}>
          <p>{t("startingCameraText")}</p>
        </StatusPanel>
      );
      break;
    case "denied":
      panel = (
        <StatusPanel
          tone="error"
          icon={<CameraIcon size={28} />}
          title={t("cameraBlockedTitle")}
          actions={
            <>
              {retryButton}
              {backButton}
            </>
          }
        >
          <p>{standalone ? t("cameraBlockedStandalone") : t("cameraBlockedBrowser")}</p>
        </StatusPanel>
      );
      break;
    case "insecure":
      panel = (
        <StatusPanel tone="error" icon={<ShieldIcon size={28} />} title={t("cameraInsecureTitle")} actions={backButton}>
          <p>{rich(t("cameraInsecureText"), { localhost: <code>localhost</code> })}</p>
          <p>{rich(t("cameraInsecureWifi"), { address: <code>http://192.168…</code> })}</p>
        </StatusPanel>
      );
      break;
    case "unavailable":
      panel = (
        <StatusPanel
          tone="error"
          icon={<CameraIcon size={28} />}
          title={t("noCameraTitle")}
          actions={
            <>
              {retryButton}
              {backButton}
            </>
          }
        >
          <p>{cameraError ?? t("noCameraText")}</p>
          <p>{t("noCameraHint")}</p>
        </StatusPanel>
      );
      break;
    case "error":
      panel = (
        <StatusPanel
          tone="error"
          icon={<AlertIcon size={28} />}
          title={t("cameraProblemTitle")}
          actions={
            <>
              {retryButton}
              {backButton}
            </>
          }
        >
          <p>{cameraError ?? t("cameraProblemText")}</p>
        </StatusPanel>
      );
      break;
    case "ready":
      if (pose.status === "error") {
        const stopped = pose.failure === "runtime";
        panel = (
          <StatusPanel
            tone="error"
            icon={<AlertIcon size={28} />}
            title={stopped ? t("poseStoppedTitle") : t("poseCouldNotStartTitle")}
            actions={
              <>
                {retryPoseButton}
                {backButton}
              </>
            }
          >
            <p>{pose.error ?? t("poseLoadFailed")}</p>
            <p>{stopped ? t("poseStoppedText") : t("poseFirstLoadText")}</p>
          </StatusPanel>
        );
      } else if (pose.status !== "running") {
        panel = (
          <StatusPanel
            tone="loading"
            title={t("loadingPoseTitle")}
            actions={
              pose.slow ? (
                <>
                  {retryPoseButton}
                  {backButton}
                </>
              ) : (
                backButton
              )
            }
          >
            <p>{t("loadingPoseText")}</p>
            {pose.slow ? <p>{t("loadingPoseSlow")}</p> : null}
          </StatusPanel>
        );
      }
      break;
  }

  let hudVerification: HudVerification | null = null;
  if (stakedRun) {
    const s = verified.status;
    const pending = verified.challengesPending > 0 && !verified.challenge;
    const goalText = formatGoal(goal, info.unit, t);
    hudVerification =
      s === "error"
        ? {
            note: t("notVerifiedNote", { reason: verified.error ?? t("verificationStopped") }),
            tone: "warn",
            action: verified.outcome === null ? { label: t("retry"), onClick: verified.begin } : undefined,
          }
        : verified.error
          ? { note: verified.error, tone: "warn" }
          : {
              note:
                s === "starting"
                  ? t("connectingVerifier")
                  : t(pending ? "verifiedRunNotePending" : "verifiedRunNote", { goal: goalText }),
              tone: "ok",
            };
    if (verified.challenge) hudVerification.challenge = <ChallengePrompt challenge={verified.challenge} />;
  }

  return (
    <div className={styles.stage}>
      <div ref={boxRef} className={styles.mirrorBox} data-mirrored={mirrored ? "" : undefined}>
        <video
          ref={videoRef}
          className={styles.video}
          data-fit={fit}
          muted
          playsInline
          autoPlay
          disablePictureInPicture
          aria-label={t("cameraPreview", { name })}
        />
        <canvas ref={canvasRef} className={styles.overlay} aria-hidden="true" />
      </div>

      {panel ?? (
        <Hud
          exercise={exercise}
          hud={hud}
          fps={pose.fps}
          delegate={pose.delegate}
          fit={fit}
          tilted={tilted}
          goal={goal}
          verification={hudVerification}
          onToggleFit={() => setFit((f) => (f === "cover" ? "contain" : "cover"))}
          voiceOn={prefs.voiceCoach}
          onToggleVoice={() => {
            const next = !prefs.voiceCoach;
            setPreference("voiceCoach", next);
            if (next) speak(speechTranslator("voice", speechLocale())("voiceCoachOn"), true);
            else stopSpeaking();
          }}
          onEnd={endSession}
        />
      )}

      {panel === null && countdown !== null ? (
        <ReadyCountdown
          value={countdown}
          total={COUNTDOWN_SECS}
          detail={t("countdownGoal", { goal: formatGoal(goal, info.unit, t) })}
          onSkip={() => setCountdown(null)}
        />
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {tilted ? t("phoneTilted") : announcement}
      </p>
    </div>
  );
}
