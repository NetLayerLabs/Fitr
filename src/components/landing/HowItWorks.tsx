import type { JSX } from "react";
import { CameraIcon, CoinIcon, ShieldIcon, TargetIcon, type IconProps } from "@/components/icons/Icons";
import section from "./section.module.css";
import styles from "./HowItWorks.module.css";

interface Step {
  title: string;
  body: string;
  detail: string;
  Icon: (props: IconProps) => JSX.Element;
}

const STEPS: readonly Step[] = [
  {
    title: "Commit",
    body: "Pick an exercise, set your daily goal and choose how much SKR to stake. One transaction, signed on your phone.",
    detail: "Goal minimums are enforced on-chain",
    Icon: TargetIcon,
  },
  {
    title: "Work out",
    body: "Prop up your phone and go. On-device pose AI checks your form and counts every rep that meets the standard.",
    detail: "Runs entirely on your phone",
    Icon: CameraIcon,
  },
  {
    title: "Get verified",
    body: "Fitr's verification server replays your pose data and checks random live challenges, then marks the day complete on-chain.",
    detail: "Live challenges, rep by rep",
    Icon: ShieldIcon,
  },
  {
    title: "Settle",
    body: "Hit your goal and claim your stake back plus a share of what no-shows forfeited. Miss it and your stake goes to the people who showed up.",
    detail: "Paid out by the on-chain vault",
    Icon: CoinIcon,
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className={section.section} aria-labelledby="how-title">
      <div className={section.container}>
        <div className={`${section.head} ${section.reveal}`}>
          <p className={section.eyebrow}>How it works</p>
          <h2 id="how-title" className={section.title}>
            Stake it. Sweat it. Settle it.
          </h2>
          <p className={section.lede}>
            Motivation fades. A promise with something on it does not. Fitr turns your daily workout
            into a commitment you can&apos;t quietly skip.
          </p>
        </div>

        <ol className={styles.steps} role="list">
          {STEPS.map(({ title, body, detail, Icon }, i) => (
            <li key={title} className={`${styles.step} ${section.reveal} ${section.spot}`} data-spotlight="">
              <span className={section.glare} aria-hidden="true" />
              <div className={styles.stepTop}>
                <span className={styles.icon}>
                  <Icon size={22} />
                </span>
                <span className={styles.index} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className={styles.stepTitle}>
                <span className="sr-only">Step {i + 1}: </span>
                {title}
              </h3>
              <p className={styles.body}>{body}</p>
              <p className={styles.detail}>{detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
