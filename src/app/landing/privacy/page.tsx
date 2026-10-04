import type { Metadata } from "next";
import PrivacyDoc from "@/components/you/info/PrivacyDoc";
import LandingDoc from "@/components/landing/LandingDoc";
import { SITE_ORIGIN } from "@/components/landing/links";

/** Public copy of the in-app page, served as fitr.day/privacy (host rewrite → /landing/privacy). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Privacy",
  description: "Your video never leaves your phone. What Fitr stores, what it sends, and when.",
  alternates: { canonical: "/privacy" },
};

export default function LandingPrivacy() {
  return (
    <LandingDoc>
      <PrivacyDoc />
    </LandingDoc>
  );
}
