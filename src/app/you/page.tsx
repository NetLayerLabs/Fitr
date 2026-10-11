import type { Metadata } from "next";
import ProCard from "@/components/pro/ProCard";
import AboutLinks from "@/components/you/AboutLinks";
import LanguagePicker from "@/components/you/LanguagePicker";
import ProfileHeader from "@/components/you/ProfileHeader";
import SettingsPanel from "@/components/you/SettingsPanel";
import styles from "@/components/you/You.module.css";
import WalletPanel from "@/components/wallet/WalletPanel";
import { getT } from "@/lib/i18n/server";
import packageJson from "../../../package.json";
import pageStyles from "./page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("you");
  return { title: t("pageTitle"), description: t("pageDescription") };
}

export default async function YouPage() {
  const t = await getT("you");
  return (
    <div className={pageStyles.page}>
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <div className={styles.screen}>
        <ProfileHeader />

        <section className={styles.section} aria-labelledby="you-wallet-heading">
          <h2 id="you-wallet-heading" className={styles.sectionTitle}>
            {t("walletHeading")}
          </h2>
          <WalletPanel />
        </section>

        <ProCard />

        <section className={styles.section} aria-labelledby="you-settings-heading">
          <h2 id="you-settings-heading" className={styles.sectionTitle}>
            {t("settingsHeading")}
          </h2>
          <LanguagePicker />
          <SettingsPanel />
        </section>

        <section className={styles.section} aria-labelledby="you-about-heading">
          <h2 id="you-about-heading" className={styles.sectionTitle}>
            {t("aboutHeading")}
          </h2>
          <AboutLinks version={packageJson.version} />
        </section>
      </div>
    </div>
  );
}
