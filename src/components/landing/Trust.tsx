import { CheckIcon, ShieldIcon } from "@/components/icons/Icons";
import { ChainIcon, EyeOffIcon, PercentIcon } from "./LandingIcons";
import { LANDING_LINKS } from "./links";
import section from "./section.module.css";
import styles from "./Trust.module.css";

/** Example day for the settlement panel: equal stakes, so the pro-rata share is an even split. */
const EXAMPLE = { people: 10, stake: 100, showed: 7, feeBps: 500 } as const;

function settle() {
  const forfeited = (EXAMPLE.people - EXAMPLE.showed) * EXAMPLE.stake;
  const fee = (forfeited * EXAMPLE.feeBps) / 10_000;
  const shared = forfeited - fee;
  const bonus = Math.floor((shared / EXAMPLE.showed) * 10) / 10;
  return { forfeited, fee, shared, bonus };
}

/** Why it holds up: cheat resistance, privacy, on-chain transparency and the one fee. */
export default function Trust() {
  const { forfeited, fee, shared, bonus } = settle();
  return (
    <section id="trust" className={section.section} aria-labelledby="trust-title">
      <div className={section.container}>
        <div className={`${section.head} ${section.reveal}`}>
          <p className={section.eyebrow}>Why it&apos;s different</p>
          <h2 id="trust-title" className={section.title}>
            A commitment device, not a money game.
          </h2>
          <p className={section.lede}>
            Fitr isn&apos;t move-to-earn. You only stake your own SKR on your own goal, and the rules
            that decide who gets paid are open for anyone to read.
          </p>
        </div>

        <div className={styles.bento}>
          <article className={`${styles.card} ${styles.cheat} ${section.reveal}`}>
            <span className={styles.icon}>
              <ShieldIcon size={22} />
            </span>
            <h3 className={styles.cardTitle}>Cheat-resistant by design</h3>
            <p className={styles.body}>
              Backed by live challenges and on-chain rules, built to catch half-reps and
              pre-recorded clips before a day is marked complete.
            </p>
            <ul className={styles.list} role="list">
              <li>
                <CheckIcon size={16} strokeWidth={2.5} />
                <span>
                  <strong>Strict rep standards.</strong> Joint angles decide what counts, not motion.
                </span>
              </li>
              <li>
                <CheckIcon size={16} strokeWidth={2.5} />
                <span>
                  <strong>Random live challenges.</strong> &ldquo;Raise your right hand&rdquo;, mid-set,
                  re-checked by the server.
                </span>
              </li>
              <li>
                <CheckIcon size={16} strokeWidth={2.5} />
                <span>
                  <strong>One Seeker, one stake.</strong> No farming a pool with a drawer of wallets.
                </span>
              </li>
            </ul>
          </article>

          <article className={`${styles.card} ${section.reveal}`}>
            <span className={styles.icon}>
              <EyeOffIcon size={22} />
            </span>
            <h3 className={styles.cardTitle}>Your video stays yours</h3>
            <p className={styles.body}>
              Pose tracking runs on your phone. Video is never uploaded or stored; verification only
              sees skeleton points.
            </p>
          </article>

          <article className={`${styles.card} ${section.reveal}`}>
            <span className={styles.icon}>
              <ChainIcon size={22} />
            </span>
            <h3 className={styles.cardTitle}>Transparent on Solana</h3>
            <p className={styles.body}>
              Every stake, verification and payout is a public transaction. Stakes sit in the vault
              program. Fitr can&apos;t touch them.
            </p>
          </article>

          <article className={`${styles.card} ${styles.settle} ${section.reveal}`} aria-labelledby="settle-title">
            <div className={styles.settleCopy}>
              <span className={styles.icon}>
                <PercentIcon size={22} />
              </span>
              <h3 id="settle-title" className={styles.cardTitle}>
                One honest fee
              </h3>
              <p className={styles.body}>
                Fitr takes 5% of forfeited stakes, and nothing else. Show up and you pay no fee at
                all.
              </p>
            </div>

            <figure className={styles.example}>
              <figcaption className={styles.exampleCap}>
                Example day: {EXAMPLE.people} people stake {EXAMPLE.stake} SKR. {EXAMPLE.showed} show
                up.
              </figcaption>
              <div className={styles.dots} aria-hidden="true">
                {Array.from({ length: EXAMPLE.people }, (_, i) => (
                  <span key={i} className={i < EXAMPLE.showed ? styles.dotOn : styles.dotOff} />
                ))}
              </div>
              <dl className={styles.rows}>
                <div>
                  <dt>Forfeited by no-shows</dt>
                  <dd>{forfeited} SKR</dd>
                </div>
                <div>
                  <dt>Fitr fee (5%)</dt>
                  <dd>{fee} SKR</dd>
                </div>
                <div>
                  <dt>Shared by the {EXAMPLE.showed} who showed up</dt>
                  <dd>{shared} SKR</dd>
                </div>
                <div className={styles.total}>
                  <dt>Each finisher claims</dt>
                  <dd>
                    {EXAMPLE.stake} <span>+{bonus}</span> SKR
                  </dd>
                </div>
              </dl>
              <p className={styles.fine}>
                Illustrative. Shares are pro-rata and computed by the vault program.{" "}
                <a href={LANDING_LINKS.verification}>How verification works</a>
              </p>
            </figure>
          </article>
        </div>
      </div>
    </section>
  );
}
