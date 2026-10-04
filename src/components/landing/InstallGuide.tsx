import styles from "./InstallGuide.module.css";

const STEPS = [
  {
    title: "Download on your phone",
    body: (
      <>
        Tap <strong>Download for Android</strong> on your Seeker (or any Android 9+ phone).
      </>
    ),
  },
  {
    title: "Open the APK",
    body: (
      <>
        Open <strong>fitr.apk</strong> from your notifications or Files. If Android asks, allow your
        browser to install apps.
      </>
    ),
  },
  {
    title: "Get past Play Protect",
    body: (
      <>
        Fitr isn&apos;t installed from Google Play, so Play Protect may warn you. Tap{" "}
        <strong>More details</strong>, then <strong>Install anyway</strong>.
      </>
    ),
  },
] as const;

/** Three honest steps for sideloading the APK, shown next to the final download button. */
export default function InstallGuide() {
  return (
    <div className={styles.guide}>
      <h3 id="install-guide-title" className={styles.title}>
        Install on Seeker
      </h3>
      <ol className={styles.steps} aria-labelledby="install-guide-title">
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <span className={styles.num} aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.stepBody}>{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
