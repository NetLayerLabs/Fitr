import type { Metadata } from "next";
import CreditsDoc from "@/components/you/info/CreditsDoc";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("you");
  return { title: t("creditsTitle"), description: t("creditsDescription") };
}

export default async function CreditsPage() {
  const [t, tx] = await Promise.all([getT("you"), getT("exercises")]);
  return <CreditsDoc back="/you" t={t} tx={tx} />;
}
