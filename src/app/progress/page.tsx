import type { Metadata } from "next";
import ProgressOnChain from "@/components/progress/ProgressOnChain";
import PageHeader from "@/components/ui/PageHeader";
import { getT } from "@/lib/i18n/server";
import styles from "./page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("progress");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ProgressPage() {
  const t = await getT("progress");
  return (
    <div className={styles.page}>
      <PageHeader flush eyebrow={t("pageEyebrow")} title={t("pageTitle")} />
      <ProgressOnChain />
    </div>
  );
}
