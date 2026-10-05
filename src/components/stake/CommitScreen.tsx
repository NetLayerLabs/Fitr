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
import StakeForm, { formatFeePercent, formatLocalDeadline, type StakeSubmit } from "./StakeForm";
import { ExplorerLink, TxError, TxProgress } from "./TxStatus";
import { formatHold } from "./form";
import { commitTargetDay, liveToday, pickSettlement, viewEntries } from "./plan";
import { isBusy, useVaultTx } from "./useVaultTx";
import styles from "./stake.module.css";
import { SkrText } from "@/components/brand/SkrAmount";

const fmt = (a: bigint) => formatSkr(a, { maxFractionDigits: 2 });

/** Rent for a first-ever commit (DayState + Commitment + UserProfile) plus fees, rounded up. */
const SOL_NEEDED_FIRST = 6_000_000n;
/** Commitment rent (+ maybe DayState) plus fees when the profile already exists. */
const SOL_NEEDED_REPEAT = 4_000_000n;

function Shell({ children, eyebrow = "Daily commitment" }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className={styles.screen} data-ambient="strong">
      <PageHeader eyebrow={eyebrow} title="Commit" />
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/** `feeBps` comes from the onchain Pool once it is read; before that the copy names no number. */
function HowItWorks({ feeBps }: { feeBps?: number }) {
  return (
    <Card as="section" padding="md" aria-labelledby="how-title">
      <h2 id="how-title" className={styles.cardTitle}>
        How it works
      </h2>
      <ol className={styles.how}>
        <li>
          <strong>Commit.</strong> Pick one exercise, your goal, and how much {solanaConfig.tokenLabel} to lock. It is
          fixed onchain when you sign.
        </li>
        <li>
          <strong>Show up.</strong> Your phone counts every rep; Fitr re-checks the session with live challenges and
          marks it complete onchain.
        </li>
        <li>
          <strong>Settle.</strong> Hit it and your stake comes back plus a share of what others forfeited. Miss it and
          your stake goes to the people who showed up (Fitr keeps{" "}
          {feeBps === undefined ? "a small fee" : formatFeePercent(feeBps)} of forfeits only).
        </li>
      </ol>
      <p className={styles.fine}>
        A commitment device, not an investment: if everyone shows up, everyone simply gets their stake back.
      </p>
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
  return (
    <ul className={styles.stillWorks}>
      <li>All 16 workouts with on-device rep counting and form checks</li>
      <li>Your streaks and history in Progress</li>
    </ul>
  );
}

export default function CommitScreen() {
  const hydrated = useHydrated();
  const { owner, account } = useSelectedWallet();
  const seeker = useSeekerStatus(owner);
  const vault = useVault(owner, { sgtMint: seeker.data?.sgtMint ?? null });
  const nowMs = useNow();

  if (!hydrated) return <Skeleton label="Loading" />;

  if (!owner || !account) {
    return (
      <Shell>
        <div className={styles.hero}>
          <h2 className={styles.heroTitle}>Put something on the line.</h2>
          <p className={styles.heroBody}>
            Stake {solanaConfig.tokenLabel} on today&apos;s workout. Show up and get it back. Skip it and it goes to the
            people who did.
          </p>
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
            Connect your wallet
          </h2>
          <p className={`${styles.hint} ${styles.hintSpaced}`}>You sign every stake yourself. Fitr never holds your keys.</p>
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
          title="Staking is Seeker-only"
          actions={
            <Button variant="primary" href="/workouts" trailingPlay>
              Browse workouts
            </Button>
          }
        >
          <p>
            To keep it one person, one stake, commitments need a Solana Seeker phone. This wallet does not hold a Seeker
            Genesis Token, so staking is off for it.
          </p>
          <p>Everything else still works:</p>
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
          title="Staking opens soon"
          actions={
            <Button variant="primary" href="/workouts" trailingPlay>
              Train now
            </Button>
          }
        >
          <p>The {solanaConfig.tokenLabel} commitment vault is not live yet. Nothing can be staked, and nothing is.</p>
          <p>In the meantime:</p>
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
          title="Can't reach the vault"
          actions={
            <Button variant="secondary" onClick={vault.refresh}>
              Try again
            </Button>
          }
        >
          <p>We couldn&apos;t read the onchain pool. Check your connection and try again.</p>
        </Notice>
      </Shell>
    );
  }

  if (!vault.snapshot || nowMs === 0) return <Skeleton label="Loading the pool" />;

  if (requireSgt && seeker.status !== "ready") {
    if (seeker.status === "error") {
      return (
        <Shell>
          <Notice
            icon={<ShieldIcon size={24} />}
            title="Couldn't check your Seeker"
            actions={
              <Button variant="secondary" onClick={seeker.refresh}>
                Try again
              </Button>
            }
          >
            <p>Staking needs a quick Seeker Genesis Token check, and it did not go through.</p>
          </Notice>
        </Shell>
      );
    }
    return <Skeleton label="Checking your Seeker" />;
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
  return (
    <div className={styles.modeSwitch} role="radiogroup" aria-label="Commit solo or with a crew">
      {(["solo", "crew"] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          className={styles.modeButton}
          onClick={() => onChange(m)}
        >
          {m === "solo" ? "Solo" : "Crew"}
        </button>
      ))}
    </div>
  );
}

/** The connected Commit tab: today's commitments across pools, then Solo (global pool) or Crew. */
function CommitHome(props: ConnectedProps & { seekerState: Parameters<typeof usePoolsToday>[2] }) {
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
      <Shell eyebrow="Commit together">
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
}: PoolCommitFlowProps) {
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
      ? `You need about ${formatSol(solNeeded, { maxFractionDigits: 3 })} for network fees and account rent (most of the rent comes back later). This wallet has ${formatSol(sol.data)}.`
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
      return (
        <LimeMoment
          eyebrow={`${isToday ? "Committed for today" : "Committed for tomorrow"}${crew?.name ? ` · ${crew.name}` : ""}`}
          title="You're in."
          big={<span className="numeral">{info.unit === "seconds" ? formatHold(last.goalTarget) : last.goalTarget}</span>}
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
                  Start workout
                </Button>
              ) : null}
              <Button variant={isToday ? "ghost" : "primary"} size="lg" block onClick={tx.reset}>
                Done
              </Button>
            </>
          }
        >
          <p className={styles.momentLine}>
            {info.name} · <SkrText text={fmt(last.amount)} /> staked · finish before {formatLocalDeadline(finishBy)}
          </p>
          {did.settled?.kind === "claim" ? (
            <p className={styles.momentLine}>
              {claimedLabel ? `${claimedLabel} claimed` : "Earlier payout claimed"} in the same signature.
            </p>
          ) : null}
          <ExplorerLink signature={tx.state.signature} />
        </LimeMoment>
      );
    }
    return (
      <LimeMoment
        eyebrow={did?.settled?.kind === "claim" ? "Claimed" : "Settled"}
        title={did?.settled?.kind === "claim" ? "Paid out." : "All squared away."}
        big={claimedLabel && did?.settled?.kind === "claim" ? <span className="numeral">{claimedLabel}</span> : undefined}
        actions={
          <Button variant="primary" size="lg" block onClick={tx.reset}>
            Done
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
      ? "You're in today."
      : todayEntry.status === "missed"
        ? "You missed today's goal."
        : "You're verified today."
    : target === today
      ? `Commits for today close at ${formatLocalDeadline(commitDeadline(today, cfg) * 1000)}.`
      : null;

  return frame(
    <>
      {before}
      <PoolSummary dayState={todayEntry?.dayState ?? null} decimals={SKR_DECIMALS} label={solanaConfig.tokenLabel} yourStatus={yourStatus} />

      {tx.state.phase === "error" && tx.state.error ? (
        <TxError message={tx.state.error} signature={tx.state.signature} onDismiss={tx.reset} />
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

      {pool.paused ? (
        <Notice icon={<LockIcon size={24} />} title="Commits are paused">
          <p>New commitments are paused for maintenance. Claims still work, and your funds are safe.</p>
        </Notice>
      ) : target !== null ? (
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
          crewName={crew && crewId !== 0n ? crew.name || "your crew" : null}
          onSubmit={submitCommit}
        />
      ) : null}

      {vault.error ? (
        <p className={styles.hint} role="status">
          Showing the last known state; refreshing failed.
        </p>
      ) : null}
      {howItWorks ? <HowItWorks feeBps={pool.feeBps} /> : null}
    </>,
  );
}
