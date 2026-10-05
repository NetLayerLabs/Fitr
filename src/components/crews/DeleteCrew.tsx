"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignMessage } from "@solana/react";
import { getBase64Decoder, getUtf8Encoder, type Address } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import Button from "@/components/ui/Button";
import { closeCrewMessage } from "@/lib/crews/closeMessage";
import { forgetCrew, refreshClosedCrews } from "./useCrews";
import styles from "./crews.module.css";

/** True when the connected wallet can sign a plain message (needed to prove crew ownership). */
export function canSignMessages(account: UiWalletAccount): boolean {
  return Array.isArray(account?.features) && account.features.includes("solana:signMessage");
}

/**
 * The creator's "Delete crew": signs a plain message (no transaction, no SOL) that the server checks
 * against the crew's onchain creator, then hides the crew in the app and closes its invite link.
 * Render only when canSignMessages(account) (the signing hook needs the feature).
 */
export default function DeleteCrew({ account, owner, crewId, name }: { account: UiWalletAccount; owner: Address; crewId: bigint; name: string }) {
  const router = useRouter();
  const signMessage = useSignMessage(account);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const message = closeCrewMessage(crewId, owner, Date.now());
      const { signature } = await signMessage({ message: getUtf8Encoder().encode(message) as Uint8Array });
      const res = await fetch("/api/crews/closed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature: getBase64Decoder().decode(signature) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Couldn't delete the crew (${res.status}).`);
      }
      forgetCrew(crewId);
      refreshClosedCrews();
      router.push("/commit");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(/reject|declin|cancel|denied|dismiss|abort/i.test(msg) ? "Cancelled in your wallet. Nothing changed." : msg || "Couldn't delete the crew. Try again.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className={styles.danger}>
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Delete crew
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.dangerConfirm} role="alertdialog" aria-labelledby="delete-crew-title" aria-describedby="delete-crew-body">
      <p id="delete-crew-title" className={styles.sectionTitle}>
        Delete {name}?
      </p>
      <p id="delete-crew-body" className={styles.hint}>
        It disappears from Fitr and its invite link stops working. Nobody can join or stake in it any more. Anyone who
        already staked can still claim. Your wallet signs a message to prove you created it: no transaction, no fee.
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.inline}>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </Button>
        <Button variant="primary" onClick={remove} disabled={busy}>
          {busy ? "Deleting…" : "Delete crew"}
        </Button>
      </div>
    </div>
  );
}
