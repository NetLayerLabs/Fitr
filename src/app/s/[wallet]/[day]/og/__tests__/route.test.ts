import { describe, expect, it, vi } from "vitest";
import { address } from "@solana/kit";
import { CommitmentStatus } from "@/lib/solana/vault/generated";
import { D0, makeCommitment, makePool, USER } from "@/lib/solana/vault/__tests__/fixtures";
import { mapShareCard } from "@/lib/actions/shareCard";

const POOL = address("SysvarC1ock11111111111111111111111111111111");
vi.mock("@/lib/actions/publicData", () => ({
  getShareCard: async () => ({
    kind: "ok",
    card: mapShareCard({
      wallet: USER,
      dayIndex: D0,
      poolAddress: POOL,
      pool: makePool(),
      commitment: makeCommitment(D0, { status: CommitmentStatus.Completed, reps: 30 }, POOL),
      commitmentAddress: POOL,
      profile: null,
      profileAddress: POOL,
    }),
  }),
}));

describe("share card OG image", () => {
  it("renders a 1200×630 PNG (default font when the display font can't load)", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const { GET } = await import("../route");
    const res = await GET(new Request(`https://fitr.day/s/${USER}/${D0}/og`), {
      params: Promise.resolve({ wallet: USER, day: String(D0) }),
    } as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
    const view = new DataView(buf.buffer);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
    vi.unstubAllGlobals();
  }, 30_000);
});
