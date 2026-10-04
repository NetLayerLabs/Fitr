"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import { crewInviteUrl } from "@/lib/solana/vault/crews";
import { inviteText } from "./labels";
import styles from "./crews.module.css";

export interface InviteActionsProps {
  crewId: bigint;
  crewName: string;
  /** e.g. "20 push-ups for everyone". */
  challenge: string;
}

const noopSubscribe = () => () => {};

/** Share sheet (navigator.share) + copy link for https://fitr.day/c/<id>. */
export default function InviteActions({ crewId, crewName, challenge }: InviteActionsProps) {
  const url = crewInviteUrl(crewId);
  const [copied, setCopied] = useState(false);
  // Server render (and hydration) assume no share sheet, so markup matches.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: `${crewName} on Fitr`, text: inviteText(crewName, challenge), url });
    } catch {
      // Dismissed, or the share target failed: the copy button is still there.
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.actions}>
        {canShare ? (
          <Button variant="primary" onClick={share}>
            Invite
          </Button>
        ) : null}
        <Button variant="secondary" onClick={copy} aria-label={copied ? "Invite link copied" : "Copy invite link"} icon={copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className={styles.link} aria-label="Invite link">
        {url}
      </p>
      <span className="sr-only" role="status">
        {copied ? "Invite link copied" : ""}
      </span>
    </div>
  );
}
