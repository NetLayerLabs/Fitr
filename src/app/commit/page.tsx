import type { Metadata } from "next";
import CommitScreen from "@/components/stake/CommitScreen";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("stake");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/** The Commit tab. Everything wallet- and chain-dependent renders on the client. */
export default function CommitPage() {
  return <CommitScreen />;
}
