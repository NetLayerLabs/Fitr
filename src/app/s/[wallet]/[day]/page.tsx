/**
 * Public share card: https://fitr.day/s/<wallet>/<dayIndex>[?pool=<crew pool>]
 * Everything shown is read from the chain server-side (Commitment + UserProfile), never from the
 * URL. The Open Graph image is ./og (same data).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JoinCta from "@/components/public/JoinCta";
import PublicShell from "@/components/public/PublicShell";
import ShareCardView from "@/components/public/ShareCardView";
import { PUBLIC_ORIGIN, commitActionUrl, dialToUrl, sharePath } from "@/lib/actions/links";
import { getShareCard } from "@/lib/actions/publicData";
import { parseShareParams } from "@/lib/actions/shareCard";
import { solanaConfig } from "@/lib/solana/config";
import styles from "@/components/public/Public.module.css";

export const dynamic = "force-dynamic";

function poolOf(sp: Record<string, string | string[] | undefined>): string | null {
  const v = sp.pool;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function generateMetadata(props: PageProps<"/s/[wallet]/[day]">): Promise<Metadata> {
  const { wallet, day } = await props.params;
  const parsed = parseShareParams(wallet, day);
  if (!parsed) return { title: "Not found" };
  const pool = poolOf(await props.searchParams);
  const loaded = await getShareCard(parsed.wallet, parsed.dayIndex, pool);
  const card = loaded.kind === "ok" ? loaded.card : null;
  const title = card ? card.headline : "Fitr: verified workouts on Solana";
  const description = card?.challenge
    ? `${card.walletShort} put their own SKR on ${card.challenge}. Join them on Fitr: show up, get it back plus a share of what no-shows forfeit.`
    : "Stake your own SKR on a daily workout goal. On-device AI counts every rep; the people who show up get their stake back plus a share of what no-shows forfeit.";
  const path = sharePath({ wallet: parsed.wallet, dayIndex: parsed.dayIndex, pool });
  const og = `${path.split("?")[0]}/og${pool ? `?pool=${encodeURIComponent(pool)}` : ""}`;
  return {
    metadataBase: new URL(PUBLIC_ORIGIN),
    title: { absolute: `${title} · Fitr` },
    description,
    alternates: { canonical: path },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      url: path,
      siteName: "Fitr",
      title,
      description,
      images: [{ url: og, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default async function SharePage(props: PageProps<"/s/[wallet]/[day]">) {
  const { wallet, day } = await props.params;
  const parsed = parseShareParams(wallet, day);
  if (!parsed) notFound();
  const pool = poolOf(await props.searchParams);
  const loaded = await getShareCard(parsed.wallet, parsed.dayIndex, pool);

  if (loaded.kind === "ok") {
    const card = loaded.card;
    const explorerUrl = card.explorerAccount ? solanaConfig.explorerAddressUrl(card.explorerAccount) : null;
    return (
      <PublicShell>
        <ShareCardView card={card} explorerUrl={explorerUrl} />
      </PublicShell>
    );
  }

  const opensSoon = loaded.kind === "no_pool";
  return (
    <PublicShell>
      <section className={styles.notice} aria-labelledby="share-missing">
        <p className={styles.eyebrow}>{opensSoon ? "Verified on-chain" : "Live data unavailable"}</p>
        <h1 id="share-missing" className={styles.title}>
          {opensSoon ? "This card goes live with the vault" : "We couldn't reach Solana just now"}
        </h1>
        <p className={styles.lede}>
          {opensSoon
            ? "Fitr's on-chain vault isn't open yet, so there is no workout to show here. Once staking is live, this card shows a verified day straight from the chain."
            : "Refresh in a minute: the card is read straight from the chain."}
        </p>
      </section>
      <JoinCta
        title="Put your word on the line"
        text="Stake your own SKR on a daily workout goal. Finish and you get it back plus a share of what no-shows forfeit."
        blinkUrl={opensSoon ? null : dialToUrl(commitActionUrl({ pool }))}
      />
    </PublicShell>
  );
}
