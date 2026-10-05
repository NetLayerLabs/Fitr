"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Address } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ChevronRightIcon } from "@/components/icons/Icons";
import { useT } from "@/lib/i18n/I18nProvider";
import { crewDisplayName, crewPath, parseInviteInput } from "@/lib/solana/vault/crews";
import type { Pool } from "@/lib/solana/vault/generated";
import CreateCrewForm from "./CreateCrewForm";
import { challengeLabel } from "./labels";
import { useClosedCrews, useMyCrews } from "./useCrews";
import styles from "./crews.module.css";

function JoinCrew() {
  const t = useT("crews");
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = parseInviteInput(text);
    if (id === null) {
      setError(true);
      return;
    }
    setError(false);
    router.push(crewPath(id));
  };
  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="join-crew-title">
      <h2 id="join-crew-title" className={styles.sectionTitle}>
        {t("joinTitle")}
      </h2>
      <div className={styles.inline}>
        <input
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("joinPlaceholder")}
          aria-label={t("joinInputLabel")}
          autoComplete="off"
          inputMode="url"
          enterKeyHint="go"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "join-crew-error" : undefined}
        />
        <Button type="submit" variant="secondary">
          {t("joinOpen")}
        </Button>
      </div>
      {error ? (
        <p id="join-crew-error" className={styles.error}>
          {t("joinInvalid")}
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
  const t = useT("crews");
  const tx = useT("exercises");
  const crews = useMyCrews(owner);
  const closed = useClosedCrews();
  const list = (crews.data ?? []).filter((c) => !closed.has(c.crewId.toString()));
  return (
    <>
      <Card as="section" padding="md" aria-labelledby="my-crews-title">
        <div className={styles.stack}>
          <h2 id="my-crews-title" className={styles.sectionTitle}>
            {t("yourCrewsTitle")}
          </h2>
          {crews.status === "loading" && list.length === 0 ? (
            <p className={styles.hint} role="status">
              {t("lookingForCrews")}
            </p>
          ) : list.length === 0 ? (
            <p className={styles.hint}>
              {crews.status === "error"
                ? t("crewsLoadError")
                : t("noCrewsYet")}
            </p>
          ) : (
            <ul className={styles.list} role="list">
              {list.map((c) => (
                <li key={c.crewId.toString()}>
                  <Link href={crewPath(c.crewId)} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{crewDisplayName(c, t)}</span>
                      <span className={styles.rowMeta}>{challengeLabel(c, t, tx)}</span>
                    </span>
                    {c.creator === owner ? <span className={styles.tag}>{t("yoursTag")}</span> : null}
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
