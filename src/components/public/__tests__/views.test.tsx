// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { address } from "@solana/kit";
import { CommitmentStatus } from "@/lib/solana/vault/generated";
import { D0, makeCommitment, makePool, USER } from "@/lib/solana/vault/__tests__/fixtures";
import { aggregateDashboard } from "@/lib/actions/dashboard";
import { mapShareCard } from "@/lib/actions/shareCard";
import PoolDashboard from "../PoolDashboard";
import ShareCardView from "../ShareCardView";

const POOL = address("SysvarC1ock11111111111111111111111111111111");

describe("public views", () => {
  it("share card shows the verified result and a dial.to Join me link", () => {
    const card = mapShareCard({
      wallet: USER,
      dayIndex: D0,
      poolAddress: POOL,
      pool: makePool(),
      commitment: makeCommitment(D0, { status: CommitmentStatus.Completed, reps: 30, goalTarget: 30 }, POOL),
      commitmentAddress: POOL,
      profile: null,
      profileAddress: POOL,
    });
    const html = renderToStaticMarkup(<ShareCardView card={card} explorerUrl="https://explorer.solana.com/address/x" />);
    expect(html).toContain("Verified on-chain");
    expect(html).toContain("30 push-ups");
    expect(html).toContain("https://dial.to/?action=solana-action%3Ahttps%3A%2F%2Ffitr.day%2Fapi%2Factions%2Fcommit%3Fexercise%3Dpushup%26goal%3D30");
    expect(html).toContain("https://fitr.day/download/fitr.apk");
    expect(html).not.toContain("app.fitr.day");
  });

  it("dashboard renders stats, the sponsor framing and no 'earn' wording", () => {
    const stats = aggregateDashboard({
      globalPool: { address: POOL, pool: makePool({ dailySponsorAmount: 5_000_000n, reserve: 20_000_000n }) },
      pools: [],
      dayStates: [],
      profiles: [],
      nowSecs: D0 * 86_400 + 60,
    });
    const html = renderToStaticMarkup(<PoolDashboard stats={stats} tokenLabel="SKR" poolExplorerUrl="https://x" updatedAtMs={0} />);
    expect(html).toContain("At stake today");
    expect(html).toContain("Sponsor with your wallet");
    expect(html).toContain("gift, not an investment");
    expect(html).not.toMatch(/\bearn/i);
    expect(html).not.toContain("app.fitr.day");
  });
});
