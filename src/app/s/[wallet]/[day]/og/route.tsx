/**
 * Open Graph image for a share card (1200×630 PNG): lime on black, the athlete photo for the
 * exercise, "Verified onchain · 30 push-ups · Day streak 7". Read from the chain like the page.
 * A route handler (not opengraph-image.tsx) because the card's crew pool is a query parameter.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getShareCard } from "@/lib/actions/publicData";
import { parseShareParams, type ShareCardData } from "@/lib/actions/shareCard";
import { exerciseArt, STANDING_ART } from "@/lib/exerciseArt";

export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };
const LIME = "#C6F432";
const INK = "#0A0B0D";

type OgFont = { name: string; data: ArrayBuffer; weight: 800; style: "normal" };
let fontPromise: Promise<OgFont | null> | null = null;

/**
 * Inter Tight ExtraBold from Google Fonts (TTF, fetched once per process). The default OG font is
 * regular weight only; on any failure the image still renders with it.
 */
function displayFont(): Promise<OgFont | null> {
  fontPromise ??= (async () => {
    try {
      const css = await fetch("https://fonts.googleapis.com/css2?family=Inter+Tight:wght@800", {
        signal: AbortSignal.timeout(3_000),
      }).then((r) => (r.ok ? r.text() : ""));
      const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
      if (!src) return null;
      const res = await fetch(src, { signal: AbortSignal.timeout(3_000) });
      if (!res.ok) return null;
      return { name: "Inter Tight", data: await res.arrayBuffer(), weight: 800, style: "normal" };
    } catch {
      return null;
    }
  })();
  return fontPromise.then((f) => {
    if (!f) fontPromise = null; // retry on a later request
    return f;
  });
}

async function dataUrl(publicPath: string, mime: string): Promise<string | null> {
  try {
    const safe = publicPath.replace(/^\/+/, "");
    if (safe.includes("..")) return null;
    const bytes = await readFile(join(process.cwd(), "public", safe));
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function lines(card: ShareCardData | null): { badge: string; big: string; sub: string } {
  if (!card) return { badge: "FITR", big: "Put your word on the line", sub: "Stake SKR on your daily workout · Solana Seeker" };
  const badge =
    card.state === "verified"
      ? "VERIFIED ONCHAIN"
      : card.state === "committed"
        ? "COMMITTED ONCHAIN"
        : card.state === "revoked"
          ? "NOT VERIFIED"
          : "FITR";
  const big = card.state === "not_found" ? "Show up. On the record." : (card.challenge ?? `Day ${card.dayIndex} done`);
  const bits: string[] = [];
  if (card.streak && card.streak > 0) bits.push(`Day streak ${card.streak}`);
  if (card.dateLabel) bits.push(card.dateLabel);
  bits.push(card.crewName ? `${card.walletShort} · ${card.crewName}` : card.walletShort);
  return { badge, big, sub: bits.join("  ·  ") };
}

export async function GET(request: Request, ctx: RouteContext<"/s/[wallet]/[day]/og">): Promise<Response> {
  const { wallet, day } = await ctx.params;
  const parsed = parseShareParams(wallet, day);
  const pool = new URL(request.url).searchParams.get("pool");
  const loaded = parsed ? await getShareCard(parsed.wallet, parsed.dayIndex, pool) : null;
  const card = loaded && loaded.kind === "ok" ? loaded.card : null;
  const art = (card?.exercise && exerciseArt(card.exercise)) || STANDING_ART;
  const [photo, wordmark, font] = await Promise.all([
    dataUrl(art.src, "image/jpeg"),
    dataUrl("/brand/fitr-wordmark-sm.png", "image/png"),
    displayFont(),
  ]);
  const display = font ? { fontFamily: "Inter Tight" } : {};
  const t = lines(card);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: INK, color: "#F5F6F7" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 630,
            height: "100%",
            padding: "56px 56px 52px",
          }}
        >
          {wordmark ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
            <img src={wordmark} width={152} height={54} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: LIME }}>Fitr</div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "10px 22px",
                borderRadius: 999,
                background: card?.state === "verified" || !card ? LIME : "#24282D",
                color: card?.state === "verified" || !card ? INK : "#F5F6F7",
                alignItems: "center",
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 1,
                ...display,
              }}
            >
              {card?.state === "verified" ? (
                <svg width="26" height="26" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
                  <path d="M5 12.5 10 17.5 19 7" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {t.badge}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: t.big.length > 18 ? 66 : 84,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: -2,
                color: LIME,
                ...display,
              }}
            >
              {t.big}
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#A3A9B2" }}>{t.sub}</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#8D949F" }}>fitr.day · on-device AI · Solana Seeker</div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 570, height: "100%" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
            <img src={photo} width={630} height={630} alt="" style={{ objectFit: "cover", width: 570, height: 630 }} />
          ) : null}
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 0,
              top: 0,
              width: 160,
              height: "100%",
              backgroundImage: `linear-gradient(90deg, ${INK}, rgba(10,11,13,0))`,
            }}
          />
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: font ? [font] : undefined,
      headers: { "cache-control": "public, max-age=300, s-maxage=300" },
    },
  );
}
