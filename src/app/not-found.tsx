import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/Brand";
import { PlayIcon } from "@/components/icons/Icons";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("common");
  return { title: t("notFoundMetaTitle") };
}

/**
 * Styles live in globals.css (".not-found*"); see the note there on why this is not a CSS module
 * (and why it does not use the ui/Button, whose module stylesheet would be preloaded everywhere).
 */
export default async function NotFound() {
  const t = await getT("common");
  return (
    <div className="not-found">
      <span className="not-found-mark">
        <BrandMark size={48} />
      </span>
      <p className="not-found-code">404</p>
      <h1 className="not-found-title">{t("notFoundTitle")}</h1>
      <p className="not-found-text">{t("notFoundText")}</p>
      <Link href="/" className="not-found-cta">
        {t("notFoundCta")}
        <span className="not-found-cta-cap" aria-hidden="true">
          <PlayIcon size={18} />
        </span>
      </Link>
    </div>
  );
}
