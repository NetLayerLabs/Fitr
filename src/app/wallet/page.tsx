import { permanentRedirect } from "next/navigation";

/** Wallet moved to the You tab. next.config.ts also 308s /wallet at the edge. */
export default function WalletPage(): never {
  permanentRedirect("/you");
}
