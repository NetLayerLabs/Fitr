import type { Metadata } from "next";
import VerificationDoc from "@/components/you/info/VerificationDoc";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("you");
  return { title: t("verificationTitle"), description: t("verificationDescription") };
}

export default async function VerificationPage() {
  const t = await getT("you");
  return <VerificationDoc back="/you" t={t} />;
}
