import type { Metadata } from "next";
import CommitScreen from "@/components/stake/CommitScreen";

export const metadata: Metadata = {
  title: "Commit",
  description:
    "Stake SKR on today's workout goal. Show up and get it back plus a share of forfeits; miss it and it goes to the people who did.",
};

/** The Commit tab. Everything wallet- and chain-dependent renders on the client. */
export default function CommitPage() {
  return <CommitScreen />;
}
