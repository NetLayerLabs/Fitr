// @vitest-environment jsdom
/**
 * Staked (verified) workouts through the real WorkoutScreen + useVerifiedSession, with the
 * attestor API mocked at fetch level and the wallet / today's commitment injected.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StakedCommitment } from "@/hooks/useVerifiedSession";
import type { EngineEvent, EngineState, PoseFrame, RepEngine, SessionSummary } from "@/lib/pose/types";
import { reloadSessions, SESSIONS_STORAGE_KEY } from "@/lib/storage/history";
import { resetGuidePrefsCache, setGuideHidden } from "@/lib/storage/guidePrefs";

const h = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  owner: null as string | null,
  onFrame: null as null | ((frame: PoseFrame) => void),
  reps: 0,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/wallet/hooks", () => ({
  useSelectedWallet: () => ({ owner: h.owner, account: undefined, wallet: undefined, wallets: [], setAccount: () => {} }),
}));

vi.mock("@/hooks/useCamera", () => ({
  useCamera: (opts: { enabled: boolean; facingMode?: string }) => ({
    videoRef: { current: null },
    status: opts.enabled ? "ready" : "idle",
    error: null,
    facingMode: opts.facingMode ?? "user",
    toggleFacingMode: () => {},
    dimensions: { width: 640, height: 480 },
    retry: () => {},
  }),
}));

vi.mock("@/hooks/usePoseStream", () => ({
  usePoseStream: (opts: { enabled: boolean; onFrame: (frame: PoseFrame) => void }) => {
    h.onFrame = opts.onFrame;
    return { status: opts.enabled ? "running" : "idle", error: null, failure: null, slow: false, fps: 30, delegate: "GPU", retry: () => {} };
  },
}));

vi.mock("@/lib/pose/engine", () => ({
  createRepEngine: (): RepEngine => {
    h.reps = 0;
    const state = (): EngineState => ({
      exercise: "pushup",
      phase: "up",
      reps: h.reps,
      rejectedReps: 0,
      holdMs: 0,
      primaryAngleDeg: 160,
      bodyLineDeg: 178,
      formIssues: [],
      trackingConfidence: 0.9,
      side: "left",
    });
    return {
      exercise: "pushup",
      update(frame) {
        h.reps += 1;
        const events: EngineEvent[] = [
          { type: "rep", repIndex: h.reps, durationMs: 1500, minAngleDeg: 80, maxAngleDeg: 165, tMs: frame.timestampMs },
        ];
        return { state: state(), events };
      },
      getState: state,
      summary: (): SessionSummary => ({
        exercise: "pushup",
        reps: h.reps,
        rejectedReps: 0,
        holdMs: 0,
        repDurationsMs: Array.from({ length: h.reps }, () => 1500),
        activeMs: 12_000,
        framesProcessed: 300,
        framesWithPose: 290,
        avgTrackingConfidence: 0.88,
      }),
      reset() {
        h.reps = 0;
      },
    };
  },
}));

import WorkoutScreen from "../WorkoutScreen";

const WALLET = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const STAKE: StakedCommitment = { dayIndex: 20721, exercise: "pushup", goalTarget: 12, amount: 5_000_000n, status: "committed" };

function frame(t: number): PoseFrame {
  return { timestampMs: t, landmarks: [], imageWidth: 640, imageHeight: 480 };
}

function attestServer(finish: () => unknown) {
  let chunks = 0;
  const paths: string[] = [];
  const fetchImpl = vi.fn(async (path: string) => {
    paths.push(path);
    if (path === "/api/attest/start") {
      return Response.json({
        sessionId: "sess_0123456789abcdef",
        serverTime: 1,
        exercise: "pushup",
        goalTarget: 12,
        challengePlan: [{ id: "c1", atMsFromStart: 6000, windowMs: 6000, type: null }],
        chunkIntervalMs: 1000,
        maxChunkChars: 131072,
        maxDurationMs: 600_000,
      });
    }
    if (path === "/api/attest/chunk") {
      chunks++;
      return Response.json({
        ack: { seq: chunks - 1, frames: 1, duplicate: false },
        serverElapsedMs: 1000,
        dueChallenge: { id: "c1", type: "raise_left_hand", prompt: "Raise your LEFT hand above your head", windowMs: 6000, remainingMs: 5500 },
        challengesPending: 0,
      });
    }
    return Response.json(finish());
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, paths };
}

const vibrate = vi.fn();

function renderStaked(server: ReturnType<typeof attestServer>, stake: StakedCommitment | null = STAKE) {
  return render(
    <WorkoutScreen
      exercise="pushup"
      verification={{
        loadCommitment: async () => stake,
        deps: {
          fetchImpl: server.fetchImpl,
          perfNow: () => 0,
          chunkIntervalMs: 5,
          fastChunkIntervalMs: 5,
          retryDelayMs: 0,
          vibrate,
          explorerTxUrl: (sig) => `https://explorer.solana.com/tx/${sig}`,
        },
      }}
    />,
  );
}

beforeEach(() => {
  h.owner = WALLET;
  h.replace.mockReset();
  h.push.mockReset();
  vibrate.mockReset();
  window.history.replaceState(null, "");
  localStorage.clear();
  reloadSessions();
  resetGuidePrefsCache();
  setGuideHidden("pushup", true);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PASS = {
  verdict: "pass",
  count: 13,
  goalTarget: 12,
  reasons: [],
  sessionHash: "ab".repeat(32),
  onchain: { status: "submitted", signature: "5igTx" },
};

describe("WorkoutScreen: verified (staked) workouts", () => {
  it("shows the stake, verifies live with a challenge prompt, and links the onchain proof", async () => {
    const server = attestServer(() => PASS);
    renderStaked(server);

    // Setup: the staked goal (12, not the default 20) and an honest privacy note.
    await waitFor(() => expect(document.body.textContent).toMatch(/Staked · 5 SKR on 12 reps/));
    expect(screen.getByText(/only body-point data goes to Fitr's verifier/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    // Full-bleed lime "Ready to go" countdown once tracking runs.
    expect(screen.getByText("Ready to go")).toBeTruthy();
    expect(screen.getByText("Goal 12 reps")).toBeTruthy();

    // The attestor session opens and the HUD shows the committed goal.
    expect(await screen.findByText(/Verified run · goal 12 reps/)).toBeTruthy();
    act(() => h.onFrame?.(frame(2000)));

    // A live check arrives in a chunk response: a big alert with a countdown, plus a buzz.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Live check/);
    expect(alert.textContent).toMatch(/Raise your LEFT hand/);
    expect(alert.textContent).toMatch(/seconds left/);
    expect(vibrate).toHaveBeenCalledWith([250, 120, 250, 120, 250]);

    act(() => h.onFrame?.(frame(3000)));
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();

    expect(await screen.findByText("Verified onchain ✓")).toBeTruthy();
    const link = screen.getByRole("link", { name: "View transaction" });
    expect(link.getAttribute("href")).toBe("https://explorer.solana.com/tx/5igTx");
    expect(server.paths.at(-1)).toBe("/api/attest/finish");

    // Save semantics are unchanged.
    fireEvent.click(screen.getByRole("button", { name: /Save & finish/ }));
    expect(JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY) ?? "[]")[0]).toMatchObject({ goal: 12, goalMet: false });
    expect(h.replace).toHaveBeenCalledWith("/");
  });

  it("explains an honest failure", async () => {
    const server = attestServer(() => ({ verdict: "fail", count: 4, goalTarget: 12, reasons: ["challenge_not_issued"], sessionHash: "00", onchain: null }));
    renderStaked(server);
    await screen.findByText(/Staked ·/);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    await screen.findByText(/Verified run/);
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(await screen.findByText("Not verified")).toBeTruthy();
    expect(screen.getByText(/ended before every live check appeared/)).toBeTruthy();
    expect(screen.getByText(/counted 4 of 12 reps/)).toBeTruthy();
  });

  it("unstaked: no wallet means no network and the default goal", async () => {
    h.owner = null;
    const server = attestServer(() => PASS);
    renderStaked(server, null);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    act(() => h.onFrame?.(frame(2000)));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.queryByText(/Verified run/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(screen.queryByText(/Verif/)).toBeNull();
    expect(server.paths).toEqual([]);
    expect(screen.getByText(/Goal 20 reps/)).toBeTruthy();
  });

  it("a stake for another exercise is pointed out and not verified", async () => {
    const server = attestServer(() => PASS);
    renderStaked(server, { ...STAKE, exercise: "squat" });
    await waitFor(() => expect(screen.getByText(/Today's stake is for/)).toBeTruthy());
    expect(screen.getByRole("link", { name: "squats" }).getAttribute("href")).toBe("/workout/squat");
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(server.paths).toEqual([]);
  });
});
