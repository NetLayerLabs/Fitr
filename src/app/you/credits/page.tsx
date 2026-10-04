import type { Metadata } from "next";
import CreditsDoc from "@/components/you/info/CreditsDoc";

export const metadata: Metadata = {
  title: "Credits & licenses",
  description: "The open-source software, fonts and media Fitr is built with.",
};

export default function CreditsPage() {
  return <CreditsDoc back="/you" />;
}
