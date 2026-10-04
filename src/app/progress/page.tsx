import type { Metadata } from "next";
import ProgressOnChain from "@/components/progress/ProgressOnChain";
import PageHeader from "@/components/ui/PageHeader";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Progress",
  description: "Your streak, personal records, awards and workout history, stored on this device.",
};

export default function ProgressPage() {
  return (
    <div className={styles.page}>
      <PageHeader flush eyebrow="Stored on this device" title="Progress" />
      <ProgressOnChain />
    </div>
  );
}
