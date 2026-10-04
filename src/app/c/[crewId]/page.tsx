import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import CrewInvitePage from "@/components/crews/CrewInvitePage";
import { loadCrewInvite } from "@/components/crews/inviteData";
import { SITE_ORIGIN } from "@/components/landing/links";
import { exerciseArt, STANDING_ART } from "@/lib/exerciseArt";
import { crewInvitePath, crewPath, parseCrewId } from "@/lib/solana/vault/crews";

/**
 * Public crew invite: https://fitr.day/c/<crewId>. Server-rendered from the on-chain crew pool
 * (read server side; the browser never talks to Solana here) with link-preview metadata.
 *
 * Inside the Android app the same path arrives on app.fitr.day (App Links keep the path), so on
 * the app host, or in the Fitr app's WebView, it forwards to the in-app crew page instead.
 */
async function isAppContext(): Promise<boolean> {
  const h = await headers();
  const host = (h.get("x-forwarded-host")?.split(",")[0] ?? h.get("host") ?? "").trim().toLowerCase();
  const ua = h.get("user-agent") ?? "";
  return host.startsWith("app.") || /\bFitrApp\//.test(ua);
}

export async function generateMetadata(props: PageProps<"/c/[crewId]">): Promise<Metadata> {
  const { crewId } = await props.params;
  const id = parseCrewId(crewId);
  if (id === null) return { title: "Invite not found" };
  const res = await loadCrewInvite(id);
  const crew = res.kind === "found" ? res.crew : null;
  const title = crew ? `Join ${crew.name} on Fitr` : "Join a crew on Fitr";
  const description = crew
    ? `${crew.challenge}. ${crew.members} ${crew.members === 1 ? "member" : "members"} stake SKR on showing up; no-shows fund the people who do.`
    : "Stake SKR on showing up with your friends. No-shows fund the people who do. Built for Solana Seeker.";
  const art = (crew?.info.fixedExercise ? exerciseArt(crew.info.fixedExercise) : null) ?? STANDING_ART;
  const path = crewInvitePath(id);
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    // Invites are for the people they are sent to, not for search results.
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      url: path,
      siteName: "Fitr",
      title,
      description,
      images: [{ url: art.src, width: 960, height: 960, alt: art.alt }],
    },
    twitter: { card: "summary_large_image", title, description, images: [art.src] },
  };
}

export default async function CrewInviteRoute(props: PageProps<"/c/[crewId]">) {
  const { crewId } = await props.params;
  const id = parseCrewId(crewId);
  if (id === null) notFound();
  if (await isAppContext()) redirect(crewPath(id));
  const res = await loadCrewInvite(id);
  return <CrewInvitePage crewId={id} result={res} />;
}
