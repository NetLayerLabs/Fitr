import Link from "next/link";
import { ChevronRightIcon, LockIcon, ShieldIcon, TrophyIcon } from "@/components/icons/Icons";
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

/** Links to the trust, privacy and credits pages, plus the app version. */
export default function AboutLinks({ version }: { version: string }) {
  return (
    <>
      <ul className={styles.links} role="list">
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
