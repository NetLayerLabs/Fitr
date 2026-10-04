/**
 * Public pool dashboard: https://fitr.day/pool. Live stats read from the vault program (cached
 * for a minute in-process). Shows "Vault opens soon" until the global pool exists.
 */
import type { Metadata } from "next";
import JoinCta from "@/components/public/JoinCta";
import PoolDashboard from "@/components/public/PoolDashboard";
import PublicShell from "@/components/public/PublicShell";
import styles from "@/components/public/Public.module.css";
import { PUBLIC_ORIGIN } from "@/lib/actions/links";
import { getDashboard } from "@/lib/actions/publicData";
import { solanaConfig } from "@/lib/solana/config";

// Rendered per request (never at build time, which has no RPC); the data layer caches 60 s.
export const dynamic = "force-dynamic";

const TITLE = "Live pool stats";
const DESCRIPTION =
  "Live on-chain stats for Fitr: SKR at stake today, completion rate, SKR paid to the people who showed up, sponsored days and top streaks.";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ORIGIN),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pool" },
  openGraph: {
    type: "website",
    url: "/pool",
    siteName: "Fitr",
    title: `${TITLE} · Fitr`,
    description: DESCRIPTION,
    images: [{ url: "/art/exercises/stand-man.jpg", width: 960, height: 960, alt: "Fitr athlete standing, ready to train" }],
  },
};

export default async function PoolPage() {
  const loaded = await getDashboard();
  if (loaded.kind === "ok") {
    return (
      <PublicShell>
        <PoolDashboard
          stats={loaded.stats}
          tokenLabel={solanaConfig.tokenLabel}
          poolExplorerUrl={solanaConfig.explorerAddressUrl(loaded.stats.globalPool)}
          updatedAtMs={loaded.stats.asOfSecs * 1000}
        />
      </PublicShell>
    );
  }
  const opensSoon = loaded.kind === "no_pool";
  return (
    <PublicShell>
      <section className={styles.notice} aria-labelledby="pool-soon">
        <p className={styles.eyebrow}>{opensSoon ? "Live pool stats" : "Live data unavailable"}</p>
        <h1 id="pool-soon" className={styles.title}>
          {opensSoon ? "Goes live with the vault" : "We couldn't reach Solana just now"}
        </h1>
        <p className={styles.lede}>
          {opensSoon
            ? "Fitr's on-chain vault isn't open yet. Once it is, this page shows the SKR at stake today, the completion rate, what the people who showed up were paid, sponsored days and the top streaks, read straight from the chain."
            : "These stats are read straight from the chain. Refresh in a minute."}
        </p>
      </section>
      <JoinCta
        title="Be ready on day one"
        text="Train free on any Android phone today. When the vault opens, stake your own SKR on your Seeker: show up and you get it back plus a share of what no-shows forfeit."
      />
    </PublicShell>
  );
}
