import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import { SITE_ORIGIN } from "@/components/landing/links";

const TITLE = "Fitr — Put your word on the line";
const DESCRIPTION =
  "Stake your own SKR on a daily workout goal. On-device AI counts every rep, live challenges and onchain rules keep it honest, and the people who show up get their stake back plus a share of what no-shows forfeit. Built for Solana Seeker.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Fitr",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/art/exercises/stand-man.jpg", width: 960, height: 960, alt: "Fitr athlete standing, ready to train" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/art/exercises/stand-man.jpg"],
  },
};

export default function Landing() {
  return <LandingPage />;
}
