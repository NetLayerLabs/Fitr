"use client";

import { CheckIcon } from "@/components/icons/Icons";
import { SkrLogo } from "@/components/brand/SkrAmount";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./pro.module.css";

const PERKS = ["perkSkr", "perkCrew", "perkFree"] as const;

/** You → Fitr Pro: what is coming and how it will be paid (monthly in SKR). Nothing to buy yet. */
export default function ProCard() {
  const t = useT("pro");
  return (
    <section className={styles.proCard} aria-labelledby="pro-card-title">
      <div className={styles.proHead}>
        <h2 id="pro-card-title" className={styles.proTitle}>
          {t("name")}
        </h2>
        <span className={styles.soon}>{t("comingSoon")}</span>
      </div>
      <p className={styles.proLede}>{t("cardLede")}</p>
      <ul className={styles.perks} role="list">
        {PERKS.map((key) => (
          <li key={key} className={styles.perk}>
            <span className={styles.perkIcon} aria-hidden="true">
              {key === "perkSkr" ? <SkrLogo /> : <CheckIcon size={16} />}
            </span>
            {t(key)}
          </li>
        ))}
      </ul>
      <p className={styles.fine}>{t("cardFine")}</p>
    </section>
  );
}
