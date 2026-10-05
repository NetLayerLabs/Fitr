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
import { useHydrated, useNow } from "@/hooks/useSessions";
import { useVault } from "@/hooks/useVault";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseGoal, exerciseName } from "@/lib/i18n/exercise";
import type { Translator } from "@/lib/i18n/translate";
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

const MEMBER_TAG: Record<MemberStatus, { label: "tagVerified" | "tagCommitted" | "tagMissed" | "tagWithdrawn"; tone?: "lime" | "warn" | "danger" }> = {
  verified: { label: "tagVerified", tone: "lime" },
  committed: { label: "tagCommitted", tone: "warn" },
  missed: { label: "tagMissed", tone: "danger" },
  revoked: { label: "tagWithdrawn", tone: "danger" },
};

/** Renders a message with one {placeholder} replaced by a React node (e.g. an SKR amount). */
function withNode(template: string, name: string, node: ReactNode): ReactNode {
  const [before, ...rest] = template.split(`{${name}}`);
  if (rest.length === 0) return template;
  return (
    <>
      {before}
      {node}
      {rest.join(`{${name}}`)}
    </>
  );
}

/** "25 push-ups" split around the number so the number can be shown big. */
function splitGoal(phrase: string, goal: number): { before: string; after: string } {
  const n = String(goal);
  const i = phrase.indexOf(n);
  if (i < 0) return { before: "", after: phrase };
  return { before: phrase.slice(0, i).trim(), after: phrase.slice(i + n.length).trim() };
}

function Frame({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  const t = useT("crews");
  return (
    <div className={stake.screen} data-ambient="strong">
      <PageHeader eyebrow={eyebrow ?? t("eyebrowCrew")} title={title} back="/commit" />
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

function who(user: Address, owner: Address | null, t: Translator<"crews">): ReactNode {
  return user === owner ? <span className={styles.you}>{t("you")}</span> : <span className={styles.mono}>{shortenAddress(user)}</span>;
}

/** The crew's page in the app: challenge, invite, today's members, streak, leaderboard, commit. */
export default function CrewScreen({ crewId }: { crewId: bigint }) {
  const t = useT("crews");
  const tx = useT("exercises");
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
      <Frame title={t("eyebrowCrew")} eyebrow={t("eyebrowCommitTogether")}>
        <div className={stake.skeletonCardTall} aria-hidden="true" />
        <p className="sr-only" role="status">
          {t("loadingCrew")}
        </p>
      </Frame>
    );
  }

  if (vault.status === "unavailable") {
    return (
      <Frame title={t("eyebrowCrew")} eyebrow={t("eyebrowCommitTogether")}>
        <Notice
          icon={<LockIcon size={24} />}
          title={t("notFoundTitle")}
          action={
            <Button variant="primary" href="/commit">
              {t("goToCommit")}
            </Button>
          }
        >
          <p>{t("notFoundBody")}</p>
        </Notice>
      </Frame>
    );
  }

  if (!snapshot || today === null) {
    return (
      <Frame title={t("eyebrowCrew")} eyebrow={t("eyebrowCommitTogether")}>
        <Notice
          icon={<LockIcon size={24} />}
          title={t("unreachableTitle")}
          action={
            <Button variant="secondary" onClick={vault.refresh}>
              {t("tryAgain")}
            </Button>
          }
        >
          <p>{t("unreachableBody")}</p>
        </Notice>
      </Frame>
    );
  }

  const crew: CrewInfo = crewInfoFromPool(snapshot.pool, snapshot.poolAddress);
  const name = crewDisplayName(crew, t);
  const challenge = challengeLabel(crew, t, tx);
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
  const fixedKind = crew.fixedExercise;
  const fixedGoal = fixedKind && crew.fixedGoal ? splitGoal(exerciseGoal(tx, fixedKind, crew.fixedGoal), crew.fixedGoal) : null;
  const requireSgt = snapshot.pool.requireSgt;

  let commit: ReactNode;
  if (!owner || !account) {
    commit = (
      <>
        <p className={`${styles.hint}`}>{t("connectToCommit")}</p>
        <ConnectWalletList />
      </>
    );
  } else if (requireSgt && seeker.status === "ready" && seeker.data && !seeker.data.isSeeker) {
    commit = (
      <p className={styles.hint}>
        <ShieldIcon size={16} /> {t("seekerOnly")}
      </p>
    );
  } else if (requireSgt && seeker.status !== "ready") {
    commit =
      seeker.status === "error" ? (
        <Button variant="secondary" onClick={seeker.refresh}>
          {t("checkSeekerAgain")}
        </Button>
      ) : (
        <p className={styles.hint} role="status">
          {t("checkingSeeker")}
        </p>
      );
  } else {
    commit = null;
  }

  return (
    <Frame title={name}>
      {closed ? (
        <Notice icon={<LockIcon size={24} />} title={t("deletedTitle")}>
          <p>{t("deletedBody")}</p>
        </Notice>
      ) : null}
      <Card as="section" padding="lg" aria-labelledby="crew-challenge-title">
        <div className={styles.stack}>
          <p className={styles.eyebrow} id="crew-challenge-title">
            {t("todaysChallenge")}
          </p>
          {fixedGoal && crew.fixedGoal ? (
            <p className={styles.challenge}>
              {fixedGoal.before ? <span className={styles.challengeNoun}>{fixedGoal.before}</span> : null}
              <span className={`numeral ${styles.challengeBig}`}>{crew.fixedGoal}</span>
              {fixedGoal.after ? <span className={styles.challengeNoun}>{fixedGoal.after}</span> : null}
            </p>
          ) : (
            <p className={styles.challengeNoun}>{fixedKind ? exerciseName(tx, fixedKind) : t("ownWorkoutOwnGoal")}</p>
          )}
          <p className={styles.hint}>
            {fixedGoal ? t("sameGoalSentence") : t("challengeSentence", { challenge })} {t("challengeRules")}
          </p>
          {closed ? null : <InviteActions crewId={crew.crewId} crewName={name} challenge={challenge} />}
        </div>
      </Card>

      <div className={styles.stats}>
        <div className={styles.stat} role="group" aria-label={t("statStreak")}>
          <span className={styles.statValue} data-tone={streak && streak.current > 0 ? "lime" : undefined}>
            {streak ? streak.current : "–"}
          </span>
          <span className={styles.statLabel}>{t("statStreak")}</span>
        </div>
        <div className={styles.stat} role="group" aria-label={t("statVerifiedToday")}>
          <span className={styles.statValue}>
            {board.data ? `${counts.verified}/${counts.total}` : "–"}
          </span>
          <span className={styles.statLabel}>{t("statVerifiedToday")}</span>
        </div>
        <div className={styles.stat} role="group" aria-label={t("statMembers")}>
          <span className={styles.statValue}>{board.data ? board.data.profiles.length : "–"}</span>
          <span className={styles.statLabel}>{t("statMembers")}</span>
        </div>
      </div>

      <Card as="section" padding="md" aria-labelledby="crew-today-title">
        <div className={styles.stack}>
          <h2 id="crew-today-title" className={styles.sectionTitle}>
            {t("todayTitle")}
          </h2>
          {board.status === "error" && !board.data ? (
            <p className={styles.hint}>{t("dayLoadError")}</p>
          ) : !board.data ? (
            <p className={styles.hint} role="status">
              {t("loading")}
            </p>
          ) : members.length === 0 ? (
            <p className={styles.hint}>{t("nobodyCommitted")}</p>
          ) : (
            <ul className={styles.list} role="list">
              {members.map((m) => {
                const tag = MEMBER_TAG[m.status];
                return (
                  <li key={m.user} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{who(m.user, owner, t)}</span>
                      <span className={styles.rowMeta}>
                        {m.exercise ? exerciseGoal(tx, m.exercise, m.goalTarget) : `${m.goalTarget}`} ·{" "}
                        <SkrText text={fmt(m.amount)} />
                      </span>
                    </span>
                    <span className={styles.tag} data-tone={tag.tone}>
                      {t(tag.label)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {streak ? (
            <p className={styles.fine}>
              {streak.best > streak.current ? t("streakExplainerBest", { best: streak.best }) : t("streakExplainer")}
            </p>
          ) : null}
        </div>
      </Card>

      <section id="commit" aria-labelledby="crew-commit-title" className={styles.stack}>
        <h2 id="crew-commit-title" className={styles.sectionTitle}>
          {t("yourStakeTitle")}
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
            {t("leaderboardTitle")}
          </h2>
          {!board.data ? (
            <p className={styles.hint} role="status">
              {t("loading")}
            </p>
          ) : leaders.length === 0 ? (
            <p className={styles.hint}>{t("leaderboardEmpty")}</p>
          ) : (
            <ol className={styles.list} role="list" aria-label={t("leaderboardLabel")}>
              {leaders.map((r) => (
                <li key={r.user} className={styles.row}>
                  <span className={styles.rank} data-top={r.rank === 1 ? "true" : undefined}>
                    {r.rank}
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{who(r.user, owner, t)}</span>
                    <span className={styles.rowMeta}>{t.plural("leaderDays", r.completed, { streak: r.streak })}</span>
                  </span>
                  <span className={styles.rowEnd}>
                    <span>{withNode(t("bonusAmount"), "amount", <SkrText text={fmt(r.bonus)} />)}</span>
                    <span className={styles.fine}>{t("bonusLabel")}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className={styles.fine}>
            {t("bonusExplainer", { fee: snapshot.pool.feeBps / 100, token: solanaConfig.tokenLabel })}
          </p>
          {BigInt(snapshot.pool.rollover) > 0n ? (
            <p className={styles.fine}>
              {withNode(t("rolloverNote"), "amount", <SkrText text={fmt(BigInt(snapshot.pool.rollover))} />)}
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
