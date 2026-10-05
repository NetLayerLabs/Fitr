"use client";

import { useState, type ReactNode } from "react";
import CommitmentsToday from "@/components/crews/CommitmentsToday";
import CrewHub from "@/components/crews/CrewHub";
import { workoutHrefFor } from "@/components/crews/multiPool";
import type { Address } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import { LockIcon, ShieldIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LimeMoment from "@/components/ui/LimeMoment";
import PageHeader from "@/components/ui/PageHeader";
import ConnectWalletList from "@/components/wallet/ConnectWalletList";
import { useSeekerStatus, useSelectedWallet, useSkrBalance, useSolBalance } from "@/components/wallet/hooks";
import { useHydrated, useNow } from "@/hooks/useSessions";
import { usePoolsToday } from "@/hooks/useTodayCommitment";
import { useVault, type VaultState } from "@/hooks/useVault";
import { EXERCISE_CODE, EXERCISES } from "@/lib/exercises";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseName } from "@/lib/i18n/exercise";
import type { ExerciseKind } from "@/lib/pose/types";
import { SKR_DECIMALS, solanaConfig } from "@/lib/solana/config";
import { formatSkr, formatSol } from "@/lib/solana/format";
import type { SeekerStatus } from "@/lib/solana/types";
import type { CrewInfo } from "@/lib/solana/vault/crews";
import { commitDeadline, dayEnd } from "@/lib/solana/vault/day";
import type { Exercise } from "@/lib/solana/vault/generated";
import type { VaultSnapshot } from "@/lib/solana/vault/read";
import { estimatePayout } from "@/lib/solana/vault/status";
import CommitmentPanel from "./CommitmentPanel";
import PoolSummary from "./PoolSummary";
import SponsorCard, { SponsoredNote } from "./SponsorCard";
import StakeForm, { formatFeePercent, formatLocalDeadline, type StakeSubmit } from "./StakeForm";
import { ExplorerLink, TxError, TxProgress } from "./TxStatus";
import { formatHold } from "./form";
import { rich } from "./rich";
import { commitTargetDay, liveToday, pickSettlement, viewEntries } from "./plan";
import { isBusy, useVaultTx } from "./useVaultTx";
import styles from "./stake.module.css";
import { SkrText } from "@/components/brand/SkrAmount";

const fmt = (a: bigint) => formatSkr(a, { maxFractionDigits: 2 });

/** Rent for a first-ever commit (DayState + Commitment + UserProfile) plus fees, rounded up. */
const SOL_NEEDED_FIRST = 6_000_000n;
/** Commitment rent (+ maybe DayState) plus fees when the profile already exists. */
const SOL_NEEDED_REPEAT = 4_000_000n;

function Shell({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  const t = useT("stake");
  return (
    <div className={styles.screen} data-ambient="strong">
      <PageHeader eyebrow={eyebrow ?? t("eyebrowDaily")} title={t("screenTitle")} />
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** `feeBps` comes from the onchain Pool once it is read; before that the copy names no number. */
function HowItWorks({ feeBps }: { feeBps?: number }) {
  const t = useT("stake");
  return (
    <Card as="section" padding="md" aria-labelledby="how-title">
      <h2 id="how-title" className={styles.cardTitle}>
        {t("howTitle")}
      </h2>
      <ol className={styles.how}>
        <li>
          <strong>{t("howCommitLead")}</strong> {t("howCommitBody", { token: solanaConfig.tokenLabel })}
        </li>
        <li>
          <strong>{t("howShowUpLead")}</strong> {t("howShowUpBody")}
        </li>
        <li>
          <strong>{t("howSettleLead")}</strong>{" "}
          {t("howSettleBody", { fee: feeBps === undefined ? t("howSmallFee") : formatFeePercent(feeBps) })}
        </li>
      </ol>
      <p className={styles.fine}>{t("howFine")}</p>
    </Card>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <Shell>
      <div className={styles.skeletonCard} aria-hidden="true" />
      <div className={styles.skeletonCardTall} aria-hidden="true" />
      <p className="sr-only" role="status">
        {label}
      </p>
    </Shell>
  );
}

function Notice({
  icon,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card as="section" tone="elevated" padding="lg" aria-labelledby="notice-title">
      <span className={styles.noticeIcon} aria-hidden="true">
        {icon}
      </span>
      <h2 id="notice-title" className={styles.noticeTitle}>
        {title}
      </h2>
      <div className={styles.noticeBody}>{children}</div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </Card>
  );
}

function StillWorks() {
  const t = useT("stake");
  return (
    <ul className={styles.stillWorks}>
      <li>{t("stillWorksWorkouts")}</li>
      <li>{t("stillWorksProgress")}</li>
    </ul>
  );
}

export default function CommitScreen() {
  const t = useT("stake");
  const hydrated = useHydrated();
  const { owner, account } = useSelectedWallet();
  const seeker = useSeekerStatus(owner);
  const vault = useVault(owner, { sgtMint: seeker.data?.sgtMint ?? null });
  const nowMs = useNow();

  if (!hydrated) return <Skeleton label={t("loading")} />;

  if (!owner || !account) {
    return (
      <Shell>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>{t("heroTitle")}</h2>
          <p className={styles.heroBody}>{t("heroBody", { token: solanaConfig.tokenLabel })}</p>
        </div>
        {vault.snapshot ? (
          <PoolSummary
            dayState={vault.snapshot.entries.find((e) => e.day === vault.snapshot!.today)?.dayState ?? null}
            decimals={SKR_DECIMALS}
            label={solanaConfig.tokenLabel}
          />
        ) : null}
        <Card as="section" padding="md" aria-labelledby="connect-title">
          <h2 id="connect-title" className={styles.cardTitle}>
            {t("connectTitle")}
          </h2>
          <p className={`${styles.hint} ${styles.hintSpaced}`}>{t("connectHint")}</p>
          <ConnectWalletList />
        </Card>
        <HowItWorks />
      </Shell>
    );
  }

  const requireSgt = vault.snapshot ? vault.snapshot.pool.requireSgt : solanaConfig.cluster === "mainnet";

  if (requireSgt && seeker.status === "ready" && seeker.data && !seeker.data.isSeeker) {
    return (
      <Shell>
        <Notice
          icon={<ShieldIcon size={24} />}
          title={t("seekerOnlyTitle")}
          actions={
            <Button variant="primary" href="/workouts" trailingPlay>
              {t("browseWorkouts")}
            </Button>
          }
        >
          <p>{t("seekerOnlyBody")}</p>
          <p>{t("everythingElseWorks")}</p>
          <StillWorks />
        </Notice>
      </Shell>
    );
  }

  if (vault.status === "unavailable") {
    return (
      <Shell>
        <Notice
          icon={<LockIcon size={24} />}
          title={t("opensSoonTitle")}
          actions={
            <Button variant="primary" href="/workouts" trailingPlay>
              {t("trainNow")}
            </Button>
          }
        >
          <p>{t("opensSoonBody", { token: solanaConfig.tokenLabel })}</p>
          <p>{t("meantime")}</p>
          <StillWorks />
        </Notice>
        <HowItWorks />
      </Shell>
    );
  }

  if (vault.status === "error" && !vault.snapshot) {
    return (
      <Shell>
        <Notice
          icon={<LockIcon size={24} />}
          title={t("unreachableTitle")}
          actions={
            <Button variant="secondary" onClick={vault.refresh}>
              {t("tryAgain")}
            </Button>
          }
        >
          <p>{t("unreachableBody")}</p>
        </Notice>
      </Shell>
    );
  }

  if (!vault.snapshot || nowMs === 0) return <Skeleton label={t("loadingPool")} />;

  if (requireSgt && seeker.status !== "ready") {
    if (seeker.status === "error") {
      return (
        <Shell>
          <Notice
            icon={<ShieldIcon size={24} />}
            title={t("seekerCheckFailedTitle")}
            actions={
              <Button variant="secondary" onClick={seeker.refresh}>
                {t("tryAgain")}
              </Button>
            }
          >
            <p>{t("seekerCheckFailedBody")}</p>
          </Notice>
        </Shell>
      );
    }
    return <Skeleton label={t("checkingSeeker")} />;
  }

  return (
    <CommitHome
      account={account}
      owner={owner}
      snapshot={vault.snapshot}
      vault={vault}
      seekerState={seeker}
      seeker={requireSgt ? seeker.data : null}
      nowMs={nowMs}
    />
  );
}

type CommitMode = "solo" | "crew";

/** Solo / Crew switch (a two-option radio group). */
function ModeSwitch({ mode, onChange }: { mode: CommitMode; onChange: (m: CommitMode) => void }) {
  const t = useT("stake");
  return (
    <div className={styles.modeSwitch} role="radiogroup" aria-label={t("modeLabel")}>
      {(["solo", "crew"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          className={styles.modeButton}
          onClick={() => onChange(m)}
        >
          {m === "solo" ? t("modeSolo") : t("modeCrew")}
        </button>
      ))}
    </div>
  );
}

/** The connected Commit tab: today's commitments across pools, then Solo (global pool) or Crew. */
function CommitHome(props: ConnectedProps & { seekerState: Parameters<typeof usePoolsToday>[2] }) {
  const t = useT("stake");
  const [mode, setMode] = useState<CommitMode>("solo");
  const { pools } = usePoolsToday(props.owner, props.vault, props.seekerState);
  const head = (
    <>
      <CommitmentsToday pools={pools} />
      <ModeSwitch mode={mode} onChange={setMode} />
    </>
  );
  if (mode === "crew") {
    return (
      <Shell eyebrow={t("eyebrowTogether")}>
        {head}
        <CrewHub account={props.account} owner={props.owner} globalPool={props.snapshot.pool} />
      </Shell>
    );
  }
  return <PoolCommitFlow {...props} before={head} />;
}

interface ConnectedProps {
  account: UiWalletAccount;
  owner: Address;
  snapshot: VaultSnapshot;
  vault: VaultState;
  seeker: SeekerStatus | null;
  nowMs: number;
}

export interface PoolCommitFlowProps extends ConnectedProps {
  /** The crew was deleted from the app by its creator: claims only, no new stakes or sponsoring. */
  closed?: boolean;
  /** The crew this flow commits into; null / omitted = the global pool. */
  crew?: CrewInfo | null;
  /** Rendered first inside the wrapper (e.g. the Solo/Crew switch). */
  before?: ReactNode;
  /** Wraps the flow; default the Commit tab shell. */
  wrap?: (children: ReactNode) => ReactNode;
  /** Show the "How it works" card (default true). */
  howItWorks?: boolean;
}

interface LastSubmit extends StakeSubmit {
  dayIndex: number;
}

/**
 * Stake / claim flow for ONE pool (the global pool, or a crew on its page): today's slots, the
 * stake form (locked to the crew's fixed exercise/goal) and the done screens.
 */
export function PoolCommitFlow({
  account,
  owner,
  snapshot,
  vault,
  seeker,
  nowMs,
  crew = null,
  before = null,
  wrap,
  howItWorks = true,
  closed = false,
}: PoolCommitFlowProps) {
  const t = useT("stake");
  const tex = useT("exercises");
  const tx = useVaultTx(account);
  const crewId = crew && crew.crewId !== 0n ? crew.crewId : 0n;
  // Only crews name their pool; the global pool's requests stay exactly as before.
  const poolArg = crewId === 0n ? {} : { crewId };
  const frame = (children: ReactNode) => (wrap ? wrap(children) : <Shell>{children}</Shell>);
  const skr = useSkrBalance(owner);
  const sol = useSolBalance(owner);
  const [last, setLast] = useState<LastSubmit | null>(null);
  const [claimedLabel, setClaimedLabel] = useState<string | null>(null);

  const nowSecs = Math.floor(nowMs / 1000);
  const { pool, cfg } = snapshot;
  const today = liveToday(cfg, nowSecs, snapshot.today);
  const entries = viewEntries(snapshot, nowSecs);
  const target = commitTargetDay(snapshot, nowSecs);
  const settlement = pickSettlement(snapshot, nowSecs);
  const busy = isBusy(tx.state.phase);
  const balance = skr.data?.amount ?? null;

  const claimEntry = settlement?.kind === "claim" ? entries.find((e) => e.day === settlement.day) : undefined;
  const claimPayout = claimEntry ? estimatePayout(claimEntry, pool) : null;
  const bundledClaim = claimPayout ? `${claimPayout.exact ? "" : "≈ "}${fmt(claimPayout.principal + claimPayout.bonus)}` : null;

  const solNeeded = snapshot.profile ? SOL_NEEDED_REPEAT : SOL_NEEDED_FIRST;
  const solShortfall =
    sol.data !== null && sol.data < solNeeded
      ? t("solShortfall", { needed: formatSol(solNeeded, { maxFractionDigits: 3 }), has: formatSol(sol.data) })
      : null;

  const sgt = seeker?.sgtMint && seeker.sgtTokenAccount ? { mint: seeker.sgtMint, tokenAccount: seeker.sgtTokenAccount } : null;

  const submitCommit = (v: StakeSubmit) => {
    if (target === null) return;
    setLast({ ...v, dayIndex: target });
    setClaimedLabel(settlement?.kind === "claim" ? bundledClaim : null);
    void tx.run({
      plan: { settle: settlement, commit: true },
      commit: {
        dayIndex: target,
        amount: v.amount,
        exercise: EXERCISE_CODE[v.exercise] as Exercise,
        goalTarget: v.goalTarget,
      },
      sgt: pool.requireSgt ? sgt : null,
      registerDevice: pool.requireSgt && snapshot.deviceLock === null,
      ...poolArg,
    });
  };

  const settleOnly = () => {
    if (!settlement) return;
    setLast(null);
    setClaimedLabel(settlement.kind === "claim" ? bundledClaim : null);
    void tx.run({ plan: { settle: settlement, commit: false }, commit: null, sgt: null, registerDevice: false, ...poolArg });
  };

  if (tx.state.phase === "done" && tx.state.signature) {
    const did = tx.state.did;
    if (did?.committed && last) {
      const info = EXERCISES[last.exercise];
      const isToday = last.dayIndex === today;
      const finishBy = dayEnd(last.dayIndex, cfg) * 1000 - 1000;
      const deadline = formatLocalDeadline(finishBy, t.locale);
      return (
        <LimeMoment
          eyebrow={`${isToday ? t("committedForToday") : t("committedForTomorrow")}${crew?.name ? ` · ${crew.name}` : ""}`}
          title={t("youreIn")}
          big={<span className="numeral">{info.unit === "seconds" ? formatHold(last.goalTarget, t) : last.goalTarget}</span>}
          actions={
            <>
              {isToday ? (
                <Button
                  variant="primary"
                  size="lg"
                  block
                  trailingPlay
                  href={workoutHrefFor(last.exercise as ExerciseKind, crewId)}
                >
                  {t("startWorkout")}
                </Button>
              ) : null}
              <Button variant={isToday ? "ghost" : "primary"} size="lg" block onClick={tx.reset}>
                {t("done")}
              </Button>
            </>
          }
        >
          <p className={styles.momentLine}>
            {rich(t("committedSummary", { exercise: exerciseName(tex, last.exercise), deadline }), {
              amount: <SkrText text={fmt(last.amount)} />,
            })}
          </p>
          {did.settled?.kind === "claim" ? (
            <p className={styles.momentLine}>
              {claimedLabel ? t("claimedInSameSignature", { amount: claimedLabel }) : t("earlierClaimedInSameSignature")}
            </p>
          ) : null}
          <ExplorerLink signature={tx.state.signature} />
        </LimeMoment>
      );
    }
    return (
      <LimeMoment
        eyebrow={did?.settled?.kind === "claim" ? t("eyebrowClaimed") : t("eyebrowSettled")}
        title={did?.settled?.kind === "claim" ? t("paidOut") : t("allSquared")}
        big={claimedLabel && did?.settled?.kind === "claim" ? <span className="numeral">{claimedLabel}</span> : undefined}
        actions={
          <Button variant="primary" size="lg" block onClick={tx.reset}>
            {t("done")}
          </Button>
        }
      >
        <ExplorerLink signature={tx.state.signature} />
      </LimeMoment>
    );
  }

  const todayEntry = entries.find((e) => e.day === today);
  const yourStatus = todayEntry?.commitment
    ? todayEntry.status === "committed"
      ? t("statusInToday")
      : todayEntry.status === "missed"
        ? t("statusMissedToday")
        : t("statusVerifiedToday")
    : target === today
      ? t("statusCommitsClose", { time: formatLocalDeadline(commitDeadline(today, cfg) * 1000, t.locale) })
      : null;

  return frame(
    <>
      {before}
      <PoolSummary dayState={todayEntry?.dayState ?? null} decimals={SKR_DECIMALS} label={solanaConfig.tokenLabel} yourStatus={yourStatus} />

      {tx.state.phase === "error" && tx.state.error ? (
        <TxError message={tx.state.error} signature={tx.state.signature} detail={tx.state.detail} onDismiss={tx.reset} />
      ) : null}
      {busy ? <TxProgress phase={tx.state.phase} /> : null}

      <CommitmentPanel
        entries={entries}
        today={today}
        cfg={cfg}
        pool={pool}
        fmt={fmt}
        settlement={settlement}
        busy={busy}
        onSettle={settleOnly}
        crewId={crewId === 0n ? undefined : crewId}
      />

      {closed ? null : pool.paused ? (
        <Notice icon={<LockIcon size={24} />} title={t("pausedTitle")}>
          <p>{t("pausedBody")}</p>
        </Notice>
      ) : target !== null ? (
        <>
          <SponsoredNote pool={pool} />
          <StakeForm
            pool={pool}
            cfg={cfg}
            targetDay={target}
            isTomorrow={target !== today}
            decimals={SKR_DECIMALS}
            label={solanaConfig.tokenLabel}
            balance={balance}
            solShortfall={solShortfall}
            bundledClaim={settlement?.kind === "claim" ? bundledClaim : null}
            busy={busy}
            fixedExercise={crew?.fixedExercise ?? null}
            fixedGoal={crew?.fixedGoal ?? null}
            crewName={crew && crewId !== 0n ? crew.name || t("yourCrew") : null}
            onSubmit={submitCommit}
          />
        </>
      ) : null}

      {pool.paused || closed ? null : (
        <SponsorCard
          account={account}
          owner={owner}
          pool={pool}
          crewId={crewId === 0n ? undefined : crewId}
          crewName={crew && crewId !== 0n ? crew.name || t("yourCrew") : null}
          balance={balance}
        />
      )}

      {vault.error ? (
        <p className={styles.hint} role="status">
          {t("staleState")}
        </p>
      ) : null}
      {howItWorks ? <HowItWorks feeBps={pool.feeBps} /> : null}
    </>,
  );
}
