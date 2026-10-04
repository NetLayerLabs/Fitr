import styles from "@/components/you/You.module.css";
import PageHeader from "@/components/ui/PageHeader";
import pageStyles from "@/app/you/page.module.css";


/** Body of the privacy info page; `back` adds the in-app back arrow (omitted on fitr.day). */
export default function PrivacyDoc({ back }: { back?: string }) {
  return (
    <div className={pageStyles.page}>
      <PageHeader flush back={back} eyebrow="Your data" title="Privacy" />
      <div className={styles.prose}>
        <p className={styles.lead}>
          <strong>Your camera video never leaves your phone.</strong> It is analysed on the device, frame by frame,
          and never recorded or uploaded.
        </p>

        <h2>Free workouts</h2>
        <p>
          Nothing about the workout is sent anywhere. Your history, streaks, records and awards are saved only in this
          app on this phone. Clearing your history on the Progress tab deletes them.
        </p>

        <h2>Staked workouts</h2>
        <p>
          To verify a staked day, your phone sends Fitr&apos;s verification server the skeleton points of the session:
          the positions of 33 body joints over time, plus your answers to the live challenges. No video, no images,
          no audio. The server uses them to check your reps and keeps a fingerprint of the session to stop the same
          workout being submitted twice.
        </p>

        <h2>Your wallet</h2>
        <p>
          Fitr sees your public wallet address when you connect, to show your balance and Seeker status. Your keys
          stay in your wallet, and every transaction is approved by you. Stakes, completions and payouts are recorded
          on the Solana blockchain, which is public.
        </p>

        <h2>Third parties</h2>
        <p>
          The on-device pose AI (Google MediaPipe) may send anonymous usage statistics about the library itself to
          Google. These contain no video, images or body points.
        </p>

        <h2>Settings</h2>
        <p>Your camera, haptics and form-guide preferences are stored only on this phone.</p>
      </div>
    </div>
  );
}
