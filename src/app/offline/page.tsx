import type { Metadata } from "next";
import Link from "next/link";
import { ARC_END, ARC_PATH, F_BARS, KNOB_RADIUS, MARK_VIEWBOX, RING_RADIUS } from "@/components/pwa/markGeometry";
import styles from "./page.module.css";

/**
 * Static offline fallback. public/sw.js precaches this route and serves it for navigations
 * that fail while offline and have no cached copy. The address bar keeps the URL that failed,
 * so "Try again" is a plain full reload of that URL (works even if no JS has loaded).
 */
export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="offline-title">
        {/* Brand mark (pwa/markGeometry.ts), with a pulsing knob for "waiting for a connection". */}
        <svg className={styles.mark} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false">
          <circle className={styles.track} cx="50" cy="50" r={RING_RADIUS} />
          <path className={styles.arc} d={ARC_PATH} />
          <circle className={styles.knob} cx={ARC_END.x} cy={ARC_END.y} r={KNOB_RADIUS} />
          <g className={styles.glyph}>
            {F_BARS.map((bar, i) => (
              <rect key={i} {...bar} />
            ))}
          </g>
        </svg>

        <p className={styles.eyebrow}>Fitr</p>
        <h1 id="offline-title" className={styles.title}>
          You&rsquo;re offline
        </h1>
        <p className={styles.body}>
          This screen isn&rsquo;t saved on this device yet. Reconnect, then try again.
        </p>
        <p className={styles.note}>
          Screens you&rsquo;ve opened before stay available offline, and pose tracking always runs on your phone.
        </p>

        <div className={styles.actions}>
          {/* href="" reloads the current URL: the page that failed, not /offline. */}
          <a className={styles.primary} href="">
            Try again
          </a>
          <Link className={styles.secondary} href="/">
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
