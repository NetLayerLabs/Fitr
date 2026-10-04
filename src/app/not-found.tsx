import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/Brand";
import { PlayIcon } from "@/components/icons/Icons";

export const metadata: Metadata = {
  title: "Not found",
};

/**
 * Styles live in globals.css (".not-found*"); see the note there on why this is not a CSS module
 * (and why it does not use the ui/Button, whose module stylesheet would be preloaded everywhere).
 */
export default function NotFound() {
  return (
    <div className="not-found">
      <span className="not-found-mark">
        <BrandMark size={48} />
      </span>
      <p className="not-found-code">404</p>
      <h1 className="not-found-title">This page skipped leg day</h1>
      <p className="not-found-text">We couldn&apos;t find what you were looking for.</p>
      <Link href="/" className="not-found-cta">
        Back to Today
        <span className="not-found-cta-cap" aria-hidden="true">
          <PlayIcon size={18} />
        </span>
      </Link>
    </div>
  );
}
