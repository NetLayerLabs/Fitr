import type { Metadata } from "next";
import PrivacyDoc from "@/components/you/info/PrivacyDoc";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Your video never leaves your phone. What Fitr stores, what it sends, and when.",
};

export default function PrivacyPage() {
  return <PrivacyDoc back="/you" />;
}
