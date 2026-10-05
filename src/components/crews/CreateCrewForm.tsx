"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import Button from "@/components/ui/Button";
import ExercisePicker from "@/components/stake/ExercisePicker";
import GoalStepper from "@/components/stake/GoalStepper";
import { TxError, TxProgress } from "@/components/stake/TxStatus";
import { clampInt, defaultGoal, goalBounds } from "@/components/stake/form";
import { useSolBalance } from "@/components/wallet/hooks";
import type { ExerciseKind } from "@/lib/pose/types";
import { formatSol } from "@/lib/solana/format";
import { CREATE_CREW_RENT_LAMPORTS, crewNameError, crewPath, CREW_NAME_BYTES } from "@/lib/solana/vault/crews";
import type { Pool } from "@/lib/solana/vault/generated";
import { useT } from "@/lib/i18n/I18nProvider";
import { useCreateCrew } from "./useCreateCrew";
import styles from "./crews.module.css";

/** Rent plus a generous network fee. */
const SOL_NEEDED = CREATE_CREW_RENT_LAMPORTS + 200_000n;

export interface CreateCrewFormProps {
  account: UiWalletAccount;
  owner: Address;
  /** The global pool: goal bounds for a fixed goal (crews copy them). */
  globalPool: Pick<Pool, "goalLimits" | "paused">;
}

/** Name + optional fixed exercise / goal → create_crew (one signature) → the crew's page. */
export default function CreateCrewForm({ account, owner, globalPool }: CreateCrewFormProps) {
  const t = useT("crews");
  const router = useRouter();
  const tx = useCreateCrew(account);
  const sol = useSolBalance(owner);
  const [name, setName] = useState("");
  const [fixExercise, setFixExercise] = useState(false);
  const [kind, setKind] = useState<ExerciseKind>("pushup");
  const [fixGoal, setFixGoal] = useState(false);
  const [goal, setGoal] = useState(() => defaultGoal(globalPool, "pushup"));
  const [touched, setTouched] = useState(false);

  const nameErr = crewNameError(name, t);
  const bounds = goalBounds(globalPool, kind);
  const safeGoal = clampInt(goal, bounds);
  const busy = tx.state.phase !== "idle" && tx.state.phase !== "done" && tx.state.phase !== "error";
  const solShort = sol.data !== null && sol.data < SOL_NEEDED;

  const pick = (k: ExerciseKind) => {
    setKind(k);
    setGoal(defaultGoal(globalPool, k));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameErr || busy || solShort || globalPool.paused) return;
    const id = await tx.run({
      name,
      exercise: fixExercise ? kind : null,
      goalTarget: fixExercise && fixGoal ? safeGoal : null,
    });
    if (id !== null) router.push(crewPath(id));
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="create-crew-title">
      <h2 id="create-crew-title" className={styles.sectionTitle}>
        {t("createTitle")}
      </h2>
      <p className={styles.hint}>{t("createHint")}</p>

      <label className={styles.label}>
        {t("crewNameLabel")}
        <input
          className={styles.input}
          value={name}
          onChange={(e) => {
            // Keep within the 32-byte onchain field (emoji are up to 4 bytes).
            const v = e.target.value;
            if (new TextEncoder().encode(v.trim()).length <= CREW_NAME_BYTES) setName(v);
          }}
          onBlur={() => setTouched(true)}
          placeholder={t("crewNamePlaceholder")}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={touched && nameErr ? true : undefined}
          aria-describedby={touched && nameErr ? "crew-name-error" : undefined}
        />
      </label>
      {touched && nameErr ? (
        <p id="crew-name-error" className={styles.error}>
          {nameErr}
        </p>
      ) : null}

      <label className={styles.toggle}>
        <input type="checkbox" checked={fixExercise} onChange={(e) => setFixExercise(e.target.checked)} />
        {t("sameExerciseToggle")}
      </label>
      {fixExercise ? (
        <>
          <ExercisePicker value={kind} onChange={pick} />
          <label className={styles.toggle}>
            <input type="checkbox" checked={fixGoal} onChange={(e) => setFixGoal(e.target.checked)} />
            {t("sameGoalToggle")}
          </label>
          {fixGoal ? <GoalStepper kind={kind} value={safeGoal} bounds={bounds} onChange={setGoal} /> : null}
        </>
      ) : null}

      {tx.state.phase === "error" && tx.state.error ? (
        <TxError message={tx.state.error} signature={tx.state.signature} onDismiss={tx.reset} />
      ) : null}
      {busy ? <TxProgress phase={tx.state.phase as Parameters<typeof TxProgress>[0]["phase"]} /> : null}
      {solShort && sol.data !== null ? (
        <p className={styles.error} role="note">
          {t("createNeedsSol", {
            needed: formatSol(SOL_NEEDED, { maxFractionDigits: 3 }),
            balance: formatSol(sol.data),
          })}
        </p>
      ) : null}
      {globalPool.paused ? (
        <p className={styles.error} role="note">
          {t("createPaused")}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        disabled={busy || solShort || globalPool.paused || (touched && Boolean(nameErr))}
      >
        {busy ? t("working") : t("createButton")}
      </Button>
      <p className={styles.fine}>
        {t("createFine", { rent: formatSol(CREATE_CREW_RENT_LAMPORTS, { maxFractionDigits: 4 }) })}
      </p>
    </form>
  );
}
