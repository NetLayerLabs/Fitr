"use client";

import Link from "next/link";
import { ChevronRightIcon, LockIcon, ShieldIcon, TrophyIcon } from "@/components/icons/Icons";
import { BrandMark } from "@/components/brand/Brand";
import { ArrowUpRightIcon } from "@/components/landing/LandingIcons";
import { LANDING_LINKS } from "@/components/landing/links";
import { useT } from "@/lib/i18n/I18nProvider";
import AppVersion from "./AppVersion";
import BuiltBy from "@/components/brand/BuiltBy";
import styles from "./You.module.css";

const LINKS = [
  { href: "/you/verification", title: "verificationLinkTitle", hint: "verificationLinkHint", Icon: ShieldIcon },
  { href: "/you/privacy", title: "privacyLinkTitle", hint: "privacyLinkHint", Icon: LockIcon },
  { href: "/you/credits", title: "creditsLinkTitle", hint: "creditsLinkHint", Icon: TrophyIcon },
] as const;

/** The public website, the trust, privacy and credits pages, plus the app version. */
export default function AboutLinks({ version }: { version: string }) {
  const t = useT("you");
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
              <span className={styles.linkTitle}>{t("websiteTitle")}</span>
              <span className={styles.linkHint}>{t("websiteHint")}</span>
            </span>
            <ArrowUpRightIcon size={20} className={styles.chevron} aria-hidden="true" />
            <span className="sr-only">{t("opensInBrowser")}</span>
          </a>
        </li>
        {LINKS.map(({ href, title, hint, Icon }) => (
          <li key={href}>
            <Link href={href} className={styles.link}>
              <span className={styles.linkIcon} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className={styles.linkText}>
                <span className={styles.linkTitle}>{t(title)}</span>
                <span className={styles.linkHint}>{t(hint)}</span>
              </span>
              <ChevronRightIcon size={20} className={styles.chevron} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <AppVersion webVersion={version} />
      <div className={styles.builtBy}>
        <BuiltBy label={t("builtBy")} />
      </div>
    </>
  );
}
