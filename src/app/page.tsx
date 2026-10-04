import QuickStart from "@/components/home/QuickStart";
import TodayActivity from "@/components/home/TodayActivity";
import TodayHeader from "@/components/home/TodayHeader";
import TodayHero from "@/components/home/TodayHero";
import styles from "./page.module.css";

/** Today: greeting, one adaptive commitment card, today's activity, quick start. */
export default function TodayPage() {
  return (
    <div className={styles.page} data-ambient="strong">
      <TodayHeader />
      <TodayHero />
      <TodayActivity />
      <QuickStart />
    </div>
  );
}
