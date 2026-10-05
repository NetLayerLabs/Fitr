"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Address } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { crewDisplayName, crewPath, parseInviteInput } from "@/lib/solana/vault/crews";
import type { Pool } from "@/lib/solana/vault/generated";
import CreateCrewForm from "./CreateCrewForm";
import { challengeLabel } from "./labels";
import { useClosedCrews, useMyCrews } from "./useCrews";
import styles from "./crews.module.css";

function JoinCrew() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = parseInviteInput(text);
    if (id === null) {
      setError("Paste an invite link like fitr.day/c/123… or the crew number.");
      return;
    }
    setError(null);
    router.push(crewPath(id));
  };
  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="join-crew-title">
      <h2 id="join-crew-title" className={styles.sectionTitle}>
        Join a crew
      </h2>
      <div className={styles.inline}>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="fitr.day/c/…"
          aria-label="Invite link or crew number"
          autoComplete="off"
          inputMode="url"
          enterKeyHint="go"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "join-crew-error" : undefined}
        />
        <Button type="submit" variant="secondary">
          Open
        </Button>
      </div>
      {error ? (
        <p id="join-crew-error" className={styles.error}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

export interface CrewHubProps {
  account: UiWalletAccount;
  owner: Address;
  globalPool: Pick<Pool, "goalLimits" | "paused">;
}

/** The Commit tab's "Crew" side: your crews, join by link, start a new one. */
export default function CrewHub({ account, owner, globalPool }: CrewHubProps) {
  const crews = useMyCrews(owner);
  const closed = useClosedCrews();
  const list = (crews.data ?? []).filter((c) => !closed.has(c.crewId.toString()));
  return (
    <>
      <Card as="section" padding="md" aria-labelledby="my-crews-title">
        <div className={styles.stack}>
          <h2 id="my-crews-title" className={styles.sectionTitle}>
            Your crews
          </h2>
          {crews.status === "loading" && list.length === 0 ? (
            <p className={styles.hint} role="status">
              Looking for your crews…
            </p>
          ) : list.length === 0 ? (
            <p className={styles.hint}>
              {crews.status === "error"
                ? "Couldn’t load your crews right now. Try again in a moment."
                : "No crews yet. Start one below and share the link, or open an invite from a friend."}
            </p>
          ) : (
            <ul className={styles.list} role="list">
              {list.map((c) => (
                <li key={c.crewId.toString()}>
                  <Link href={crewPath(c.crewId)} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{crewDisplayName(c)}</span>
                      <span className={styles.rowMeta}>{challengeLabel(c)}</span>
                    </span>
                    {c.creator === owner ? <span className={styles.tag}>Yours</span> : null}
                    <ChevronRightIcon size={18} className={styles.chevron} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      <Card as="section" padding="md">
        <JoinCrew />
      </Card>
      <Card as="section" padding="md">
        <CreateCrewForm account={account} owner={owner} globalPool={globalPool} />
      </Card>
    </>
  );
}
