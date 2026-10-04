import type { Metadata } from "next";
import CreditsDoc from "@/components/you/info/CreditsDoc";
import LandingDoc from "@/components/landing/LandingDoc";
import { SITE_ORIGIN } from "@/components/landing/links";

/** Public copy of the in-app page, served as fitr.day/credits (host rewrite → /landing/credits). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Credits & licenses",
  description: "The open-source software, fonts and media Fitr is built with.",
  alternates: { canonical: "/credits" },
};

export default function LandingCredits() {
  return (
    <LandingDoc>
      <CreditsDoc />
    </LandingDoc>
  );
}
