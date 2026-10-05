import { SkrText } from "@/components/brand/SkrAmount";
import { skrPretty } from "@/lib/actions/challenge";
import type { DashboardStats } from "@/lib/actions/dashboard";
import { commitActionUrl, dialToUrl, sponsorActionUrl } from "@/lib/actions/links";
import JoinCta from "./JoinCta";
import styles from "./Public.module.css";

export interface PoolDashboardProps {
  stats: DashboardStats;
  tokenLabel: string;
  /** Explorer link for the global pool account. */
  poolExplorerUrl: string;
  /** When the numbers were read (unix ms). */
  updatedAtMs: number;
}

function skr(amount: bigint, label: string) {
  return <SkrText text={`${skrPretty(amount)} ${label}`} />;
}

function pct(rate: number | null): string {
  return rate === null ? "–" : `${Math.round(rate * 100)}%`;
}

function n(v: number): string {
  return v.toLocaleString("en-US");
}

/** The live dashboard body (server component; numbers come from the chain via aggregateDashboard). */
export default function PoolDashboard({ stats: s, tokenLabel, poolExplorerUrl, updatedAtMs }: PoolDashboardProps) {
  const sponsoring = s.dailySponsorAmount > 0n;
  const updated = new Date(updatedAtMs).toISOString().slice(11, 16);
  const fee = `${s.feeBps / 100}%`;
  return (
    <>
      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.live}>Live from Solana</span>
        </p>
        <h1 className={styles.title}>The people who show up, on the record.</h1>
        <p className={styles.lede}>
          Every number here is read from the Fitr vault program, refreshed every minute. Nobody at Fitr can edit them.
        </p>
        <p className={styles.small}>
          Updated {updated} UTC ·{" "}
          <a className={styles.link} href={poolExplorerUrl} target="_blank" rel="noopener noreferrer">
            Pool account ↗
          </a>
          {s.paused ? " · Staking is paused for maintenance" : ""}
        </p>
      </header>

      <section aria-label="Today" className={styles.tiles}>
        <div className={styles.tile} data-hero="">
          <span className={styles.tileLabel}>At stake today</span>
          <span className={styles.tileValue}>{skr(s.todayStaked, tokenLabel)}</span>
          <span className={styles.tileNote}>
            {n(s.todayCommitted)} {s.todayCommitted === 1 ? "person" : "people"} committed · {n(s.todayCompleted)} done so far
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Completion rate</span>
          <span className={styles.tileValue}>{pct(s.completionRate)}</span>
          <span className={styles.tileNote}>
            {n(s.allTimeCompleted)} completed of {n(s.allTimeCompleted + s.allTimeMissed)} settled commitments, all time
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Paid to people who showed up</span>
          <span className={styles.tileValue}>{skr(s.redistributed, tokenLabel)}</span>
          <span className={styles.tileNote}>Bonus on top of their own stake: forfeits after the {fee} fee, plus sponsor top-ups</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Commitments, all time</span>
          <span className={styles.tileValue}>{n(s.allTimeCommitments)}</span>
          <span className={styles.tileNote}>
            by {n(s.people)} {s.people === 1 ? "wallet" : "wallets"} · {n(s.crews)} {s.crews === 1 ? "crew" : "crews"}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Held for open commitments</span>
          <span className={styles.tileValue}>{skr(s.heldForOpenCommitments, tokenLabel)}</span>
          <span className={styles.tileNote}>Locked in the vault until each day settles</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Sponsor reserve</span>
          <span className={styles.tileValue}>{skr(s.sponsorReserve, tokenLabel)}</span>
          <span className={styles.tileNote}>
            {sponsoring ? <>Up to {skr(s.dailySponsorAmount, tokenLabel)} a day goes to finishers</> : "Sponsored days are not switched on yet"}
            {s.recentSponsored > 0n ? <> · {skr(s.recentSponsored, tokenLabel)} added to recent days</> : null}
          </span>
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.panel} aria-labelledby="days-title">
          <h2 id="days-title" className={styles.panelTitle}>
            Recent days · global pool
          </h2>
          {s.recentDays.length === 0 ? (
            <p className={styles.empty}>No days on record yet. The first commitments will show up here.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className={styles.num}>
                    Done
                  </th>
                  <th scope="col">
                    <span className="sr-only">Completion</span>
                  </th>
                  <th scope="col" className={styles.num}>
                    Staked
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.recentDays.map((d) => {
                  const rate = d.committed > 0 ? d.completed / d.committed : 0;
                  return (
                    <tr key={d.dayIndex}>
                      <td>{d.dayIndex === s.today ? "Today" : `#${d.dayIndex}`}</td>
                      <td className={styles.num}>
                        {n(d.completed)}/{n(d.committed)}
                      </td>
                      <td style={{ width: "40%" }}>
                        <div className={styles.bar} role="img" aria-label={`${Math.round(rate * 100)}% completed`}>
                          <span style={{ width: `${Math.round(rate * 100)}%` }} />
                        </div>
                      </td>
                      <td className={styles.num}>{skr(d.staked, tokenLabel)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className={styles.small}>Settled days are closed onchain after everyone is paid, so this list only covers recent days.</p>
        </section>

        <section className={styles.panel} aria-labelledby="streaks-title">
          <h2 id="streaks-title" className={styles.panelTitle}>
            Top streaks
          </h2>
          {s.topStreaks.length === 0 ? (
            <p className={styles.empty}>No live streaks yet. Be the first.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Wallet</th>
                  <th scope="col" className={styles.num}>
                    Days
                  </th>
                  <th scope="col" className={styles.num}>
                    Best
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.topStreaks.map((r, i) => (
                  <tr key={r.wallet}>
                    <td>
                      <span className={styles.rank} data-top={i === 0 ? "" : undefined}>
                        {i + 1}
                      </span>
                    </td>
                    <td className={styles.mono} title={r.wallet}>
                      {r.walletShort}
                    </td>
                    <td className={styles.num}>{n(r.streak)}</td>
                    <td className={styles.num}>{n(r.best)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={styles.small}>Consecutive verified days, global pool. A streak is live while yesterday or today is done.</p>
        </section>
      </div>

      <section className={styles.sponsor} aria-labelledby="sponsor-title">
        <p className={styles.eyebrow}>Sponsor a day</p>
        <h2 id="sponsor-title" className={styles.panelTitle}>
          Boost the bonus for people who show up
        </h2>
        <p className={styles.lede}>
          Anyone can add SKR to the pool&apos;s sponsor reserve: Seeker projects, communities, friends. Each day that at least one
          person completes their workout, up to the daily sponsor amount is added to that day&apos;s bonus and shared by the
          people who finished. It is a gift, not an investment: sponsors get nothing back, and neither you nor Fitr can withdraw
          it.
        </p>
        <div className={styles.sponsorActions}>
          {sponsoring ? (
            <a className={styles.pill} href={dialToUrl(sponsorActionUrl())} target="_blank" rel="noopener noreferrer">
              Sponsor with your wallet ↗
            </a>
          ) : (
            <span className={styles.pill} aria-disabled="true">
              Sponsoring opens soon
            </span>
          )}
          <span className={styles.small}>Opens a Solana Blink on dial.to. You review the transaction in your wallet.</span>
        </div>
      </section>

      <JoinCta
        title="Put your word on the line"
        text={`Stake ${skrPretty(s.minStake)}–${skrPretty(s.maxStake)} ${tokenLabel} of your own on a daily workout goal. Finish and you get it back plus a share of what no-shows forfeit (Fitr takes ${fee} of forfeits only).`}
        blinkUrl={dialToUrl(commitActionUrl({}))}
      />
    </>
  );
}
