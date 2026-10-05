"use client";

import { useEffect, type ReactNode } from "react";
import type { Address } from "@solana/kit";
import { LockIcon, ShieldIcon } from "@/components/icons/Icons";
import { SkrText } from "@/components/brand/SkrAmount";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import ConnectWalletList from "@/components/wallet/ConnectWalletList";
import { useSeekerStatus, useSelectedWallet } from "@/components/wallet/hooks";
import { PoolCommitFlow } from "@/components/stake/CommitScreen";
import { liveToday } from "@/components/stake/plan";
import { formatGoal } from "@/components/stake/form";
import { goalNoun } from "@/components/home/today";
import { useHydrated, useNow } from "@/hooks/useSessions";
import { useVault } from "@/hooks/useVault";
import { EXERCISES } from "@/lib/exercises";
import { solanaConfig } from "@/lib/solana/config";
import { formatSkr, shortenAddress } from "@/lib/solana/format";
import { crewDisplayName, crewInfoFromPool, type CrewInfo } from "@/lib/solana/vault/crews";
import { challengeLabel } from "./labels";
import { countMembers, crewLeaderboard, crewMembersToday, crewStreak, type MemberStatus } from "./crewStats";
import InviteActions from "./InviteActions";
import DeleteCrew, { canSignMessages } from "./DeleteCrew";
import { rememberCrew, useClosedCrews, useCrewBoard } from "./useCrews";
import stake from "@/components/stake/stake.module.css";
import styles from "./crews.module.css";

const fmt = (a: bigint) => formatSkr(a, { maxFractionDigits: 2 });

const MEMBER_TAG: Record<MemberStatus, { label: string; tone?: "lime" | "warn" | "danger" }> = {
  verified: { label: "Verified", tone: "lime" },
  committed: { label: "Committed", tone: "warn" },
  missed: { label: "Missed", tone: "danger" },
  revoked: { label: "Withdrawn", tone: "danger" },
};

function Frame({ title, eyebrow = "Crew", children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <div className={stake.screen} data-ambient="strong">
      <PageHeader eyebrow={eyebrow} title={title} back="/commit" />
      <div className={stake.body}>{children}</div>
    </div>
  );
}

function Notice({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card as="section" tone="elevated" padding="lg" aria-labelledby="crew-notice-title">
      <span className={stake.noticeIcon} aria-hidden="true">
        {icon}
      </span>
      <h2 id="crew-notice-title" className={stake.noticeTitle}>
        {title}
      </h2>
      <div className={stake.noticeBody}>{children}</div>
      {action ? <div className={stake.actions}>{action}</div> : null}
    </Card>
  );
}

function who(user: Address, owner: Address | null): ReactNode {
  return user === owner ? <span className={styles.you}>You</span> : <span className={styles.mono}>{shortenAddress(user)}</span>;
}

/** The crew's page in the app: challenge, invite, today's members, streak, leaderboard, commit. */
export default function CrewScreen({ crewId }: { crewId: bigint }) {
  const hydrated = useHydrated();
  const { owner, account } = useSelectedWallet();
  const seeker = useSeekerStatus(owner);
  const vault = useVault(owner, { sgtMint: seeker.data?.sgtMint ?? null, crewId });
  const nowMs = useNow();
  const snapshot = vault.snapshot;
  const nowSecs = Math.floor(nowMs / 1000);
  const today = snapshot && nowMs > 0 ? liveToday(snapshot.cfg, nowSecs, snapshot.today) : null;
  const board = useCrewBoard(snapshot?.poolAddress ?? null, today);
  const closed = useClosedCrews().has(crewId.toString());
  const exists = Boolean(snapshot);

  useEffect(() => {
    if (exists && !closed) rememberCrew(crewId);
  }, [exists, closed, crewId]);

  if (!hydrated || vault.status === "loading") {
    return (
      <Frame title="Crew" eyebrow="Commit together">
        <div className={stake.skeletonCardTall} aria-hidden="true" />
        <p className="sr-only" role="status">
          Loading the crew
        </p>
      </Frame>
    );
  }

  if (vault.status === "unavailable") {
    return (
      <Frame title="Crew" eyebrow="Commit together">
        <Notice
          icon={<LockIcon size={24} />}
          title="Crew not found"
          action={
            <Button variant="primary" href="/commit">
              Go to Commit
            </Button>
          }
        >
          <p>We couldn&apos;t find this crew onchain. Check the invite link, or staking may not be open yet.</p>
        </Notice>
      </Frame>
    );
  }

  if (!snapshot || today === null) {
    return (
      <Frame title="Crew" eyebrow="Commit together">
        <Notice
          icon={<LockIcon size={24} />}
          title="Can't reach the vault"
          action={
            <Button variant="secondary" onClick={vault.refresh}>
              Try again
            </Button>
          }
        >
          <p>We couldn&apos;t read this crew. Check your connection and try again.</p>
        </Notice>
      </Frame>
    );
  }

  const crew: CrewInfo = crewInfoFromPool(snapshot.pool, snapshot.poolAddress);
  const name = crewDisplayName(crew);
  const challenge = challengeLabel(crew);
  const todayDay = snapshot.entries.find((e) => e.day === today)?.dayState ?? null;
  // You first, then everyone else in the order the board gives.
  const members = board.data
    ? crewMembersToday(board.data.today, todayDay, snapshot.cfg, nowSecs).sort(
        (a, b) => Number(b.user === owner) - Number(a.user === owner),
      )
    : [];
  const counts = countMembers(members);
  const streak = board.data ? crewStreak(board.data.days, today, snapshot.cfg, nowSecs) : null;
  const leaders = board.data ? crewLeaderboard(board.data.profiles, today) : [];
  const info = crew.fixedExercise ? EXERCISES[crew.fixedExercise] : null;
  const requireSgt = snapshot.pool.requireSgt;

  let commit: ReactNode;
  if (!owner || !account) {
    commit = (
      <>
        <p className={`${styles.hint}`}>Connect your wallet to commit with the crew. You sign every stake yourself.</p>
        <ConnectWalletList />
      </>
    );
  } else if (requireSgt && seeker.status === "ready" && seeker.data && !seeker.data.isSeeker) {
    commit = (
      <p className={styles.hint}>
        <ShieldIcon size={16} /> Staking is Seeker-only: this wallet does not hold a Seeker Genesis Token. You can still
        follow the crew and train.
      </p>
    );
  } else if (requireSgt && seeker.status !== "ready") {
    commit =
      seeker.status === "error" ? (
        <Button variant="secondary" onClick={seeker.refresh}>
          Check my Seeker again
        </Button>
      ) : (
        <p className={styles.hint} role="status">
          Checking your Seeker…
        </p>
      );
  } else {
    commit = null;
  }

  return (
    <Frame title={name}>
      {closed ? (
        <Notice icon={<LockIcon size={24} />} title="This crew was deleted">
          <p>
            Its creator removed it from Fitr, so nobody can join or stake in it any more. If you staked here, you can
            still claim below.
          </p>
        </Notice>
      ) : null}
      <Card as="section" padding="lg" aria-labelledby="crew-challenge-title">
        <div className={styles.stack}>
          <p className={styles.eyebrow} id="crew-challenge-title">
            Today&apos;s challenge
          </p>
          {info && crew.fixedGoal ? (
            <p className={styles.challenge}>
              <span className={`numeral ${styles.challengeBig}`}>{crew.fixedGoal}</span>
              <span className={styles.challengeNoun}>{goalNoun(info.name, info.unit, crew.fixedGoal)}</span>
            </p>
          ) : (
            <p className={styles.challengeNoun}>{info ? info.name : "Your workout, your goal"}</p>
          )}
          <p className={styles.hint}>
            {info && crew.fixedGoal ? "Same goal for everyone." : `${challenge}.`} No-shows fund the crew members who
            showed up. If nobody shows up, the stakes roll over to the next crew day someone completes.
          </p>
          {closed ? null : <InviteActions crewId={crew.crewId} crewName={name} challenge={challenge} />}
        </div>
      </Card>

      <div className={styles.stats}>
        <div className={styles.stat} role="group" aria-label="Crew streak">
          <span className={styles.statValue} data-tone={streak && streak.current > 0 ? "lime" : undefined}>
            {streak ? streak.current : "–"}
          </span>
          <span className={styles.statLabel}>Crew streak</span>
        </div>
        <div className={styles.stat} role="group" aria-label="Verified today">
          <span className={styles.statValue}>
            {board.data ? `${counts.verified}/${counts.total}` : "–"}
          </span>
          <span className={styles.statLabel}>Verified today</span>
        </div>
        <div className={styles.stat} role="group" aria-label="Members">
          <span className={styles.statValue}>{board.data ? board.data.profiles.length : "–"}</span>
          <span className={styles.statLabel}>Members</span>
        </div>
      </div>

      <Card as="section" padding="md" aria-labelledby="crew-today-title">
        <div className={styles.stack}>
          <h2 id="crew-today-title" className={styles.sectionTitle}>
            Today
          </h2>
          {board.status === "error" && !board.data ? (
            <p className={styles.hint}>Couldn&apos;t load the crew&apos;s day. It refreshes on its own.</p>
          ) : !board.data ? (
            <p className={styles.hint} role="status">
              Loading…
            </p>
          ) : members.length === 0 ? (
            <p className={styles.hint}>Nobody has committed today yet. Be the first, then share the link.</p>
          ) : (
            <ul className={styles.list} role="list">
              {members.map((m) => {
                const tag = MEMBER_TAG[m.status];
                return (
                  <li key={m.user} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{who(m.user, owner)}</span>
                      <span className={styles.rowMeta}>
                        {m.exercise ? formatGoal(m.exercise, m.goalTarget) : `${m.goalTarget}`} ·{" "}
                        <SkrText text={fmt(m.amount)} />
                      </span>
                    </span>
                    <span className={styles.tag} data-tone={tag.tone}>
                      {tag.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {streak ? (
            <p className={styles.fine}>
              The crew streak counts days on which everyone who committed was verified
              {streak.best > streak.current ? ` (best: ${streak.best})` : ""}.
            </p>
          ) : null}
        </div>
      </Card>

      <section id="commit" aria-labelledby="crew-commit-title" className={styles.stack}>
        <h2 id="crew-commit-title" className={styles.sectionTitle}>
          Your stake
        </h2>
        {commit ??
          (owner && account ? (
            <PoolCommitFlow
              account={account}
              owner={owner}
              snapshot={snapshot}
              vault={vault}
              seeker={requireSgt ? seeker.data : null}
              nowMs={nowMs}
              crew={crew}
              closed={closed}
              howItWorks={false}
              wrap={(children) => <div className={styles.stack}>{children}</div>}
            />
          ) : null)}
      </section>

      <Card as="section" padding="md" aria-labelledby="crew-board-title">
        <div className={styles.stack}>
          <h2 id="crew-board-title" className={styles.sectionTitle}>
            Leaderboard
          </h2>
          {!board.data ? (
            <p className={styles.hint} role="status">
              Loading…
            </p>
          ) : leaders.length === 0 ? (
            <p className={styles.hint}>The board fills up after the first verified day.</p>
          ) : (
            <ol className={styles.list} role="list" aria-label="Crew leaderboard">
              {leaders.map((r) => (
                <li key={r.user} className={styles.row}>
                  <span className={styles.rank} data-top={r.rank === 1 ? "true" : undefined}>
                    {r.rank}
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{who(r.user, owner)}</span>
                    <span className={styles.rowMeta}>
                      {r.completed} {r.completed === 1 ? "day" : "days"} verified · streak {r.streak}
                    </span>
                  </span>
                  <span className={styles.rowEnd}>
                    <span>
                      +<SkrText text={fmt(r.bonus)} />
                    </span>
                    <span className={styles.fine}>bonus</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className={styles.fine}>
            Bonus is what members got on top of their own stake back, from crew members who missed (Fitr keeps a{" "}
            {snapshot.pool.feeBps / 100}% fee on forfeits only). {solanaConfig.tokenLabel} amounts come from the crew&apos;s
            onchain profiles.
          </p>
          {BigInt(snapshot.pool.rollover) > 0n ? (
            <p className={styles.fine}>
              Rolling over: <SkrText text={fmt(BigInt(snapshot.pool.rollover))} /> from crew days nobody completed goes to
              the next crew day someone does.
            </p>
          ) : null}
        </div>
      </Card>

      {!closed && owner && account && crew.creator === owner && canSignMessages(account) ? (
        <DeleteCrew account={account} owner={owner} crewId={crew.crewId} name={name} />
      ) : null}
    </Frame>
  );
}
