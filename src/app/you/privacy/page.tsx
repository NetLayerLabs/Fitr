import type { Metadata } from "next";
import PrivacyDoc from "@/components/you/info/PrivacyDoc";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("you");
  return { title: t("privacyTitle"), description: t("privacyDescription") };
}

export default async function PrivacyPage() {
  const t = await getT("you");
  return <PrivacyDoc back="/you" t={t} />;
}
