import type { Metadata } from "next";
import VerificationDoc from "@/components/you/info/VerificationDoc";
import LandingDoc from "@/components/landing/LandingDoc";
import { SITE_ORIGIN } from "@/components/landing/links";

/** Public copy of the in-app page, served as fitr.day/verification (host rewrite → /landing/verification). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "How verification works",
  description: "What Fitr checks before a staked day counts, what the blockchain enforces, and what you have to trust.",
  alternates: { canonical: "/verification" },
};

export default function LandingVerification() {
  return (
    <LandingDoc>
      <VerificationDoc />
    </LandingDoc>
  );
}
