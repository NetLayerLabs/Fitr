import type { Signature } from "@solana/kit";
import { describe, expect, test } from "vitest";
import { pollSignature } from "../confirm";

const SIG = "5".repeat(88) as Signature;

type Status = { err: unknown; confirmationStatus: "processed" | "confirmed" | "finalized" | null } | null | Error;

/** Fake RPC replaying `seq` (the last entry repeats); a virtual clock advanced by sleep. */
function setup(seq: Status[]) {
  let t = 0;
  let i = 0;
  const rpc = {
    getSignatureStatuses: () => ({
      send: async () => {
        const s = seq[Math.min(i++, seq.length - 1)];
        if (s instanceof Error) throw s;
        return { context: { slot: 1n }, value: [s] };
      },
    }),
  };
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc: rpc as any,
    calls: () => i,
    opts: { now: () => t, sleep: async (ms: number) => void (t += ms), intervalMs: 1000, timeoutMs: 10_000 },
  };
}

describe("pollSignature", () => {
  test("waits through null/processed until confirmed", async () => {
    const s = setup([null, { err: null, confirmationStatus: "processed" }, { err: null, confirmationStatus: "confirmed" }]);
    expect(await pollSignature(s.rpc, SIG, s.opts)).toBe("confirmed");
    expect(s.calls()).toBe(3);
  });

  test("returns finalized when already finalized", async () => {
    const s = setup([{ err: null, confirmationStatus: "finalized" }]);
    expect(await pollSignature(s.rpc, SIG, s.opts)).toBe("finalized");
  });

  test("commitment finalized keeps polling past confirmed", async () => {
    const s = setup([{ err: null, confirmationStatus: "confirmed" }, { err: null, confirmationStatus: "finalized" }]);
    expect(await pollSignature(s.rpc, SIG, { ...s.opts, commitment: "finalized" })).toBe("finalized");
  });

  test("an on-chain error is failed", async () => {
    const s = setup([{ err: { InstructionError: [0, "Custom"] }, confirmationStatus: "confirmed" }]);
    expect(await pollSignature(s.rpc, SIG, s.opts)).toBe("failed");
  });

  test("transient RPC errors are retried", async () => {
    const s = setup([new Error("503"), { err: null, confirmationStatus: "confirmed" }]);
    expect(await pollSignature(s.rpc, SIG, s.opts)).toBe("confirmed");
  });

  test("times out", async () => {
    const s = setup([null]);
    expect(await pollSignature(s.rpc, SIG, s.opts)).toBe("timeout");
    expect(s.calls()).toBe(11);
  });

  test("abort rejects", async () => {
    const s = setup([null]);
    const ac = new AbortController();
    ac.abort(new Error("stop"));
    await expect(pollSignature(s.rpc, SIG, { ...s.opts, signal: ac.signal })).rejects.toThrow("stop");
  });

  test("default sleep works with real timers", async () => {
    const s = setup([null, { err: null, confirmationStatus: "confirmed" }]);
    expect(await pollSignature(s.rpc, SIG, { intervalMs: 1, timeoutMs: 1000 })).toBe("confirmed");
  });
});
