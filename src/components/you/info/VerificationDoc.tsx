import styles from "@/components/you/You.module.css";
import PageHeader from "@/components/ui/PageHeader";
import { makeTranslator, type Translator } from "@/lib/i18n";
import { en } from "@/lib/i18n/messages";
import pageStyles from "@/app/you/page.module.css";

/**
 * Body of the verification info page; `back` adds the in-app back arrow (omitted on fitr.day).
 * `t` is the app's "you" translator; the public website omits it and stays in English.
 */
export default function VerificationDoc({ back, t = makeTranslator("en", en, "you") }: { back?: string; t?: Translator<"you"> }) {
  return (
    <div className={pageStyles.page}>
      <PageHeader flush back={back} eyebrow={t("verificationEyebrow")} title={t("verificationTitle")} />
      <div className={styles.prose}>
        <p className={styles.lead}>{t("verificationLead")}</p>

        <h2>{t("verificationPhoneHeading")}</h2>
        <p>{t("verificationPhoneBody")}</p>

        <h2>{t("verificationServerHeading")}</h2>
        <p>{t("verificationServerIntro")}</p>
        <ul>
          <li>{t("verificationServerRecount")}</li>
          <li>
            {t("verificationServerChallengesBefore")}
            <strong>{t("verificationServerChallengesStrong")}</strong>
            {t("verificationServerChallengesAfter")}
          </li>
          <li>{t("verificationServerPlausible")}</li>
          <li>{t("verificationServerTiming")}</li>
        </ul>
        <p>{t("verificationServerOutro")}</p>

        <h2>{t("verificationChainHeading")}</h2>
        <p>{t("verificationChainBody")}</p>

        <h2>{t("verificationTrustHeading")}</h2>
        <p>{t("verificationTrustBody")}</p>
        <p>{t("verificationLimitsBody")}</p>
      </div>
    </div>
  );
}
