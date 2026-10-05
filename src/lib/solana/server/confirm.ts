/**
 * Signature confirmation by polling getSignatureStatuses (no WebSockets). Used by the server
 * routes and the attestor.
 */
import type { GetSignatureStatusesApi, Rpc, Signature } from "@solana/kit";

export type PollOutcome = "confirmed" | "finalized" | "failed" | "timeout";

export interface PollSignatureOptions {
  /** Level to wait for. Default "confirmed". */
  commitment?: "confirmed" | "finalized";
  /** Default 60 s. */
  timeoutMs?: number;
  /** Default 1 s. */
  intervalMs?: number;
  /** Aborting rejects with the signal's reason. */
  signal?: AbortSignal;
  /** Injectable for tests. */
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Polls until the transaction reaches `commitment` ("confirmed" is also satisfied by
 * "finalized", which is then returned), fails onchain ("failed"), or `timeoutMs` passes
 * ("timeout"). Transient RPC errors are retried until the timeout.
 */
export async function pollSignature(
  rpc: Rpc<GetSignatureStatusesApi>,
  sig: Signature,
  o: PollSignatureOptions = {},
): Promise<PollOutcome> {
  const want = o.commitment ?? "confirmed";
  const timeoutMs = o.timeoutMs ?? 60_000;
  const intervalMs = o.intervalMs ?? 1_000;
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? defaultSleep;
  const deadline = now() + timeoutMs;

  for (;;) {
    if (o.signal?.aborted) throw o.signal.reason;
    try {
      const { value } = await rpc.getSignatureStatuses([sig]).send({ abortSignal: o.signal });
      const st = value[0];
      if (st) {
        if (st.err) return "failed";
        if (st.confirmationStatus === "finalized") return "finalized";
        if (st.confirmationStatus === "confirmed" && want === "confirmed") return "confirmed";
      }
    } catch (e) {
      if (o.signal?.aborted) throw o.signal.reason;
      void e; // transient RPC error: keep polling
    }
    if (now() >= deadline) return "timeout";
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())), o.signal);
  }
}
