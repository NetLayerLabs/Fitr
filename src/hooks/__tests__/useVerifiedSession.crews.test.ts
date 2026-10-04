/** Multi-pool verified workouts: which pool a workout attests for, and /start naming it. */
import { address } from "@solana/kit";
import { describe, expect, it, vi } from "vitest";
import { FakeChain, PROGRAM } from "@/components/crews/__tests__/fakeChain";
import type { StartResponse } from "@/lib/attest/protocol";
import { encodeCrewName } from "@/lib/solana/vault/crews";
import { CommitmentStatus, Exercise } from "@/lib/solana/vault/generated";
import { D0, MINT, T0, USER } from "@/lib/solana/vault/__tests__/fixtures";
import { loadWorkoutCommitment, VerifiedSessionController, type StakedCommitment } from "../useVerifiedSession";

const OTHER = address("Vote111111111111111111111111111111111111111");
const NOW = T0 + 3600;

async function chain() {
  const c = new FakeChain();
  const global = await c.pool(0n);
  const run = await c.pool(11n, { name: encodeCrewName("Run Club") });
  const legs = await c.pool(12n, { name: encodeCrewName("Leg Day") });
  return { c, global, run, legs };
}

const load = (c: FakeChain, exercise: StakedCommitment["exercise"], preferredCrewId: bigint | null = null) =>
  loadWorkoutCommitment(c.rpc(), USER, { mint: MINT, nowSecs: NOW, exercise, preferredCrewId, programAddress: PROGRAM });

describe("loadWorkoutCommitment", () => {
  it("global pool only: same result as before (no crew fields)", async () => {
    const { c, global } = await chain();
    await c.commitment(global, USER, D0);
    expect(await load(c, "pushup")).toEqual({ dayIndex: D0, exercise: "pushup", goalTarget: 20, amount: 100_000_000n, status: "committed" });
  });

  it("picks the crew stake for this exercise and lists the others", async () => {
    const { c, global, run, legs } = await chain();
    await c.commitment(global, USER, D0);
    await c.commitment(run, USER, D0);
    await c.commitment(legs, USER, D0, { exercise: Exercise.Squat });
    await c.commitment(run, OTHER, D0);

    const pushup = await load(c, "pushup");
    expect(pushup).toMatchObject({ exercise: "pushup", status: "committed" });
    expect(pushup?.crewId).toBeUndefined(); // global first
    expect(pushup?.alternatives).toEqual([{ crewId: 11n, crewName: "Run Club" }]);

    const viaCrew = await load(c, "pushup", 11n);
    expect(viaCrew).toMatchObject({ crewId: 11n, crewName: "Run Club" });
    expect(viaCrew?.alternatives).toEqual([{ crewId: 0n, crewName: "" }]);

    expect(await load(c, "squat")).toMatchObject({ exercise: "squat", crewId: 12n, crewName: "Leg Day" });
  });

  it("an already verified stake yields to an open one; nothing open for this exercise points elsewhere", async () => {
    const { c, global, run } = await chain();
    await c.commitment(global, USER, D0, { status: CommitmentStatus.Completed });
    await c.commitment(run, USER, D0);
    expect(await load(c, "pushup")).toMatchObject({ crewId: 11n, status: "committed" });
    const other = await load(c, "plank");
    expect(other).toMatchObject({ exercise: "pushup", crewId: 11n });
  });

  it("propagates RPC failures (the hook then falls back to the global read)", async () => {
    const { c } = await chain();
    c.failProgramAccounts = true;
    await expect(load(c, "pushup")).rejects.toThrow();
  });
});

describe("VerifiedSessionController.begin", () => {
  function server() {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_path: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      const res: StartResponse = {
        sessionId: "sess_0123456789abcdef",
        serverTime: 1,
        exercise: "pushup",
        goalTarget: 20,
        challengePlan: [],
        chunkIntervalMs: 1000,
        maxChunkChars: 131072,
        maxDurationMs: 600_000,
      };
      return Response.json(res);
    });
    return { bodies, fetchImpl: fetchImpl as unknown as typeof fetch };
  }

  it("sends the crew id for a crew stake, and nothing extra for the global pool", async () => {
    for (const [stake, expected] of [
      [{ crewId: 11n, crewName: "Run Club" }, "11"],
      [{}, undefined],
    ] as const) {
      const { bodies, fetchImpl } = server();
      const ctl = new VerifiedSessionController("pushup", { fetchImpl, chunkIntervalMs: 60_000 });
      await ctl.lookup(USER, async () => ({ dayIndex: D0, exercise: "pushup", goalTarget: 20, amount: 1n, status: "committed", ...stake }));
      await ctl.begin();
      expect(bodies[0].crewId).toBe(expected);
      expect("crewId" in bodies[0]).toBe(expected !== undefined);
      ctl.dispose();
    }
  });
});
