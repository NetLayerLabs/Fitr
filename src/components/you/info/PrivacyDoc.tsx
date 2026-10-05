import styles from "@/components/you/You.module.css";
import PageHeader from "@/components/ui/PageHeader";
import { makeTranslator, type Translator } from "@/lib/i18n";
import { en } from "@/lib/i18n/messages";
import pageStyles from "@/app/you/page.module.css";

/**
 * Body of the privacy info page; `back` adds the in-app back arrow (omitted on fitr.day).
 * `t` is the app's "you" translator; the public website omits it and stays in English.
 */
export default function PrivacyDoc({ back, t = makeTranslator("en", en, "you") }: { back?: string; t?: Translator<"you"> }) {
  return (
    <div className={pageStyles.page}>
      <PageHeader flush back={back} eyebrow={t("privacyEyebrow")} title={t("privacyTitle")} />
      <div className={styles.prose}>
        <p className={styles.lead}>
          <strong>{t("privacyLeadStrong")}</strong>
          {t("privacyLeadRest")}
        </p>

        <h2>{t("privacyFreeHeading")}</h2>
        <p>{t("privacyFreeBody")}</p>

        <h2>{t("privacyStakedHeading")}</h2>
        <p>{t("privacyStakedBody")}</p>

        <h2>{t("privacyWalletHeading")}</h2>
        <p>{t("privacyWalletBody")}</p>

        <h2>{t("privacyThirdPartiesHeading")}</h2>
        <p>{t("privacyThirdPartiesBody")}</p>

        <h2>{t("privacySettingsHeading")}</h2>
        <p>{t("privacySettingsBody")}</p>
      </div>
    </div>
  );
}
