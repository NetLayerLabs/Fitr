import Link from "next/link";
import { ChevronRightIcon, LockIcon, ShieldIcon, TrophyIcon } from "@/components/icons/Icons";
import { BrandMark } from "@/components/brand/Brand";
import { ArrowUpRightIcon } from "@/components/landing/LandingIcons";
import { LANDING_LINKS } from "@/components/landing/links";
import AppVersion from "./AppVersion";
import styles from "./You.module.css";

const LINKS = [
  {
    href: "/you/verification",
    title: "How verification works",
    hint: "What Fitr checks, and what it can't",
    Icon: ShieldIcon,
  },
  { href: "/you/privacy", title: "Privacy", hint: "Your video never leaves your phone", Icon: LockIcon },
  { href: "/you/credits", title: "Credits & licenses", hint: "Open-source software we build on", Icon: TrophyIcon },
] as const;

/** The public website, the trust, privacy and credits pages, plus the app version. */
export default function AboutLinks({ version }: { version: string }) {
  return (
    <>
      <ul className={styles.links} role="list">
        <li>
          {/* Outside the app's own host: the Android shell opens it in the phone's browser. */}
          <a href={LANDING_LINKS.home} target="_blank" rel="noopener noreferrer" className={styles.link}>
            <span className={styles.linkIcon} aria-hidden="true">
              <BrandMark size={20} />
            </span>
            <span className={styles.linkText}>
              <span className={styles.linkTitle}>Fitr website</span>
              <span className={styles.linkHint}>fitr.day · share it with friends</span>
            </span>
            <ArrowUpRightIcon size={20} className={styles.chevron} aria-hidden="true" />
            <span className="sr-only"> (opens in your browser)</span>
          </a>
        </li>
        {LINKS.map(({ href, title, hint, Icon }) => (
          <li key={href}>
            <Link href={href} className={styles.link}>
              <span className={styles.linkIcon} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className={styles.linkText}>
                <span className={styles.linkTitle}>{title}</span>
                <span className={styles.linkHint}>{hint}</span>
              </span>
              <ChevronRightIcon size={20} className={styles.chevron} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <AppVersion webVersion={version} />
    </>
  );
}
