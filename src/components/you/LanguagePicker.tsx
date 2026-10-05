"use client";

import { useId, useState } from "react";
import { LOCALES, isLocale } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/I18nProvider";
import styles from "./You.module.css";

/** The app's language. Each option is shown in its own language so anyone can find theirs. */
export default function LanguagePicker() {
  const t = useT("you");
  const { locale, setLocale } = useLocale();
  const [busy, setBusy] = useState(false);
  const id = useId();
  return (
    <div className={styles.languageRow}>
      <label htmlFor={id} className={styles.linkText}>
        <span className={styles.linkTitle}>{t("languageTitle")}</span>
        <span className={styles.linkHint}>{t("languageHint")}</span>
      </label>
      <select
        id={id}
        className={styles.languageSelect}
        value={locale}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.value;
          if (!isLocale(next) || next === locale) return;
          setBusy(true);
          try {
            await setLocale(next);
          } finally {
            setBusy(false);
          }
        }}
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}
