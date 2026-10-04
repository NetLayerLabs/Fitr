import type { Metadata } from "next";
import AboutLinks from "@/components/you/AboutLinks";
import ProfileHeader from "@/components/you/ProfileHeader";
import SettingsPanel from "@/components/you/SettingsPanel";
import styles from "@/components/you/You.module.css";
import WalletPanel from "@/components/wallet/WalletPanel";
import packageJson from "../../../package.json";
import pageStyles from "./page.module.css";

export const metadata: Metadata = {
  title: "You",
  description: "Your wallet, Seeker status, settings, and how Fitr verifies workouts and handles your data.",
};

export default function YouPage() {
  return (
    <div className={pageStyles.page}>
      <h1 className="sr-only">You</h1>
      <div className={styles.screen}>
        <ProfileHeader />

        <section className={styles.section} aria-labelledby="you-wallet-heading">
          <h2 id="you-wallet-heading" className={styles.sectionTitle}>
            Wallet
          </h2>
          <WalletPanel />
        </section>

        <section className={styles.section} aria-labelledby="you-settings-heading">
          <h2 id="you-settings-heading" className={styles.sectionTitle}>
            Settings
          </h2>
          <SettingsPanel />
        </section>

        <section className={styles.section} aria-labelledby="you-about-heading">
          <h2 id="you-about-heading" className={styles.sectionTitle}>
            About Fitr
          </h2>
          <AboutLinks version={packageJson.version} />
        </section>
      </div>
    </div>
  );
}
