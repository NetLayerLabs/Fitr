import { permanentRedirect } from "next/navigation";

/** History moved to the Progress tab. next.config.ts also 308s /history at the edge. */
export default function HistoryPage(): never {
  permanentRedirect("/progress");
}
