import type { Metadata } from "next";
import styles from "@/components/you/You.module.css";
import PageHeader from "@/components/ui/PageHeader";
import pageStyles from "../page.module.css";

export const metadata: Metadata = {
  title: "How verification works",
  description: "What Fitr checks before a staked day counts, what the blockchain enforces, and what you have to trust.",
};

export default function VerificationPage() {
  return (
    <div className={pageStyles.page}>
      <PageHeader flush back="/you" eyebrow="Trust" title="How verification works" />
      <div className={styles.prose}>
        <p className={styles.lead}>
          Fitr is built to be cheat-resistant, not cheat-proof. Here is exactly what is checked, by whom, and what you
          are trusting.
        </p>

        <h2>1. Your phone counts the reps</h2>
        <p>
          On-device pose AI finds 33 body points in each camera frame and counts a rep only when your joints move
          through the full range (for example, elbows past 90° on a push-up). Half reps are shown as &ldquo;not
          counted&rdquo;. This runs entirely on your phone.
        </p>

        <h2>2. For staked workouts, Fitr&apos;s server checks again</h2>
        <p>When money is on the line, your phone also sends the skeleton points (never video) to Fitr&apos;s verification server while you work out. The server:</p>
        <ul>
          <li>re-counts every rep itself with the same counting engine, so it never takes your phone&apos;s word for it;</li>
          <li>
            gives you <strong>live challenges</strong> at random moments, such as &ldquo;raise your right hand&rdquo;, that a
            pre-recorded video can&apos;t know in advance;
          </li>
          <li>checks the movement is physically plausible: bone lengths stay constant, joints don&apos;t teleport, the pace is human;</li>
          <li>checks timing against its own clock, and rejects a session that was already submitted.</li>
        </ul>
        <p>Only when all of that passes does the server mark your day complete on-chain.</p>

        <h2>3. The blockchain enforces the money rules</h2>
        <p>
          Your stake sits in an on-chain vault program on Solana, not with Fitr. The program enforces the deadlines,
          one commitment per wallet per day, the payout math (your stake back plus a pro-rata share of forfeited
          stakes, minus a 5% fee taken only from forfeits) and no double claims. Fitr can&apos;t move your stake to
          itself, and if a day is voided everyone is refunded.
        </p>

        <h2>What you are trusting</h2>
        <p>
          The blockchain can&apos;t see your workout, so you trust Fitr&apos;s server to judge it fairly: to mark you
          complete when you did the work, and not to mark anyone complete who didn&apos;t. Each decision carries a
          fingerprint of the session it judged, so it can be audited.
        </p>
        <p>
          No camera-based system is impossible to fool. A determined cheater with a modified app or a convincing
          body double might get through. The checks above are there to make that hard, slow and not worth the stake.
        </p>
      </div>
    </div>
  );
}
