import type { Metadata } from "next";
import VerificationDoc from "@/components/you/info/VerificationDoc";

export const metadata: Metadata = {
  title: "How verification works",
  description: "What Fitr checks before a staked day counts, what the blockchain enforces, and what you have to trust.",
};

export default function VerificationPage() {
  return <VerificationDoc back="/you" />;
}
