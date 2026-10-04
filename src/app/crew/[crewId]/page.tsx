import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CrewScreen from "@/components/crews/CrewScreen";
import { parseCrewId } from "@/lib/solana/vault/crews";

export const metadata: Metadata = {
  title: "Crew",
  description: "Your Fitr crew: today's challenge, who showed up, the crew streak and the leaderboard.",
};

/** In-app crew page (app.fitr.day/crew/<id>, opened by the Android app's App Links). */
export default async function CrewPage(props: PageProps<"/crew/[crewId]">) {
  const { crewId } = await props.params;
  const id = parseCrewId(crewId);
  if (id === null) notFound();
  // Keyed so switching crews (client navigation) starts from a clean state.
  return <CrewScreen key={id.toString()} crewId={id} />;
}
