import type { JSX } from "react";
import { AlertIcon, CheckIcon, type IconProps } from "@/components/icons/Icons";
import section from "./section.module.css";
import styles from "./Problem.module.css";

interface Row {
  /** A sourced number, or an icon when the point is qualitative. */
  stat?: { value: string; label: string };
  Icon?: (props: IconProps) => JSX.Element;
  title: string;
  body: string;
  source?: string;
  fix: string;
}

const ROWS: readonly Row[] = [
  {
    stat: { value: "$17", label: "paid per gym visit" },
    title: "We pay, then don't show up",
    body: "Members on flat monthly gym plans averaged 4.3 visits a month: over $17 a visit, when a $10 pass was on offer. Good intentions are cheap.",
    source: "DellaVigna & Malmendier, “Paying Not to Go to the Gym”, American Economic Review, 2006",
    fix: "Your own SKR goes on today's goal. Show up and it comes back. Skip it and it's gone.",
  },
  {
    stat: { value: "½", label: "a half-rep logs as a full one" },
    title: "Nobody checks the reps",
    body: "Workout logs count whatever you tell them. Half-reps, skipped sets and yesterday's video all count the same, so a streak proves very little.",
    fix: "On-device AI holds every rep to a joint-angle standard, and random live challenges catch pre-recorded clips.",
  },
  {
    stat: { value: "2×", label: "losses weigh about twice as much as gains" },
    title: "Skipping costs nothing",
    body: "Missing one workout costs you nothing today, so “tomorrow” keeps winning. Commitment contracts with real money at stake have helped people keep promises they kept breaking.",
    source: "Tversky & Kahneman, 1992 · Giné, Karlan & Zinman, “Put Your Money Where Your Butt Is”, 2010",
    fix: "Every day settles onchain: finishers get their stake back plus a share of what the no-shows forfeited.",
  },
];

/** The problem Fitr solves, each point paired with Fitr's answer. Sources are real, cited studies. */
export default function Problem() {
  return (
    <section id="problem" className={section.section} aria-labelledby="problem-title">
      <div className={section.container}>
        <div className={`${section.head} ${section.reveal}`}>
          <p className={section.eyebrow}>The problem</p>
          <h2 id="problem-title" className={section.title}>
            Wanting to get fit is easy. Showing up is the hard part.
          </h2>
          <p className={section.lede}>
            Most fitness goals don&apos;t fail for lack of a plan. They fail because skipping today costs nothing
            and nobody checks the work.
          </p>
        </div>

        <ol className={styles.rows} role="list">
          {ROWS.map(({ stat, Icon, title, body, source, fix }) => (
            <li key={title} className={`${styles.card} ${section.reveal} ${section.spot}`} data-spotlight="">
              <span className={section.glare} aria-hidden="true" />
              <div className={styles.problem}>
                {stat ? (
                  <p className={styles.stat}>
                    <span className={styles.statValue}>{stat.value}</span>
                    <span className={styles.statLabel}>{stat.label}</span>
                  </p>
                ) : Icon ? (
                  <span className={styles.problemIcon} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                ) : null}
                <h3 className={styles.title}>
                  <AlertIcon size={16} aria-hidden="true" className={styles.alert} />
                  {title}
                </h3>
                <p className={styles.body}>{body}</p>
                {source ? <p className={styles.source}>{source}</p> : null}
              </div>
              <div className={styles.fix}>
                <span className={styles.fixTag}>
                  <CheckIcon size={14} strokeWidth={2.75} aria-hidden="true" />
                  Fitr
                </span>
                <p>{fix}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
