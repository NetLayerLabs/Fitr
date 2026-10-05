import { SkrText } from "@/components/brand/SkrAmount";
import { CheckIcon } from "@/components/icons/Icons";
import { commitActionUrl, dialToUrl } from "@/lib/actions/links";
import type { ShareCardData } from "@/lib/actions/shareCard";
import { exerciseArt, STANDING_ART } from "@/lib/exerciseArt";
import JoinCta from "./JoinCta";
import styles from "./Public.module.css";

export interface ShareCardViewProps {
  card: ShareCardData;
  /** Explorer link for the card's account (null when there is nothing onchain to show). */
  explorerUrl: string | null;
}

const BADGE: Record<ShareCardData["state"], { text: string; tone?: "muted" | "warn" }> = {
  verified: { text: "Verified onchain" },
  committed: { text: "Committed · workout pending", tone: "muted" },
  revoked: { text: "Not verified", tone: "warn" },
  not_found: { text: "No commitment found", tone: "muted" },
};

/** The public "Verified onchain" card: data read from the chain, plus the Join me CTA. */
export default function ShareCardView({ card, explorerUrl }: ShareCardViewProps) {
  const art = (card.exercise && exerciseArt(card.exercise)) || STANDING_ART;
  const badge = BADGE[card.state];
  const headline =
    card.state === "not_found"
      ? "Nothing on the record for this day"
      : (card.challenge ?? (card.state === "verified" ? `Day ${card.dayIndex} done` : "Committed"));
  const blink =
    card.exercise && card.goal
      ? dialToUrl(commitActionUrl({ pool: card.isGlobalPool ? null : card.pool, exercise: card.exercise, goal: card.goal }))
      : dialToUrl(commitActionUrl({ pool: card.isGlobalPool ? null : card.pool }));
  const who = card.crewName ? `${card.walletShort} · ${card.crewName} crew` : card.walletShort;

  return (
    <>
      <article className={styles.card} aria-labelledby="share-title">
        <div className={styles.media}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static square art */}
          <img src={art.src} alt={art.alt} width={960} height={960} decoding="async" />
        </div>
        <div className={styles.cardBody}>
          <p className={styles.badge} data-tone={badge.tone}>
            {card.state === "verified" ? <CheckIcon size={16} aria-hidden="true" /> : null}
            {badge.text}
          </p>
          <h1 id="share-title" className={styles.big}>
            {headline}
          </h1>
          <dl className={styles.facts}>
            {card.streak !== null && card.streak > 0 ? (
              <div className={styles.fact}>
                <dt>Day streak</dt>
                <dd>{card.streak}</dd>
              </div>
            ) : null}
            {card.stake ? (
              <div className={styles.fact}>
                <dt>Own stake</dt>
                <dd>
                  <SkrText text={card.stake} />
                </dd>
              </div>
            ) : null}
            {card.dateLabel ? (
              <div className={styles.fact}>
                <dt>Day</dt>
                <dd>{card.dateLabel}</dd>
              </div>
            ) : null}
          </dl>
          <p className={styles.mono}>{who}</p>
          <p className={styles.small}>
            Counted by on-device AI on a Solana Seeker, re-checked by Fitr&apos;s verifier with live challenges, and recorded
            by the Fitr vault program. Cheat-resistant, not magic: see{" "}
            <a className={styles.link} href="https://fitr.day/verification">
              how verification works
            </a>
            .
          </p>
          {explorerUrl ? (
            <a className={styles.link} href={explorerUrl} target="_blank" rel="noopener noreferrer">
              View the onchain record ↗
            </a>
          ) : null}
        </div>
      </article>
      <JoinCta
        title="Join me tomorrow"
        text={
          card.challenge
            ? `Put your own SKR on the same goal (${card.challenge}). Finish and you get it back plus a share of what no-shows forfeit. Miss it and it goes to the people who showed up.`
            : "Put your own SKR on a daily workout goal. Finish and you get it back plus a share of what no-shows forfeit. Miss it and it goes to the people who showed up."
        }
        blinkUrl={blink}
      />
    </>
  );
}
