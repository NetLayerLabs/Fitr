"use client";

import Link from "next/link";
import type { Address } from "@solana/kit";
import { ChevronRightIcon } from "@/components/icons/Icons";
import SeekerBadge from "@/components/wallet/SeekerBadge";
import { WalletIcon } from "@/components/wallet/WalletIcon";
import { useSeekerStatus, useSelectedWallet, useSkrBalance } from "@/components/wallet/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { solanaConfig } from "@/lib/solana/config";
import { formatSkr, shortenAddress } from "@/lib/solana/format";
import styles from "./CommitmentWalletRow.module.css";
import { SkrText } from "@/components/brand/SkrAmount";

function ConnectedRow({ owner }: { owner: Address }) {
  const t = useT("today");
  const skr = useSkrBalance(owner);
  const seeker = useSeekerStatus(owner);
  return (
    <Link href="/you" className={styles.row}>
      <span className={styles.icon}>
        <WalletIcon size={20} />
      </span>
      <span className={styles.body}>
        <span className={styles.primary}>
          {skr.data
            ? <SkrText text={formatSkr(skr.data.amount, { maxFractionDigits: 2 })} />
            : skr.status === "error"
              ? t("balanceUnavailable")
              : t("loadingBalance")}
        </span>
        <span className={styles.secondary}>{shortenAddress(owner)}</span>
      </span>
      <SeekerBadge state={seeker} />
      <ChevronRightIcon size={18} className={styles.chevron} />
    </Link>
  );
}

/** Wallet status inside the commitment card: a link to /wallet either way (connect happens there). */
export default function CommitmentWalletRow() {
  const t = useT("today");
  const { owner } = useSelectedWallet();
  if (owner) return <ConnectedRow owner={owner} />;
  return (
    <Link href="/you" className={styles.row}>
      <span className={styles.icon}>
        <WalletIcon size={20} />
      </span>
      <span className={styles.body}>
        <span className={styles.primary}>{t("connectWallet")}</span>
        <span className={styles.secondary}>{t("seeBalance", { token: solanaConfig.tokenLabel })}</span>
      </span>
      <ChevronRightIcon size={18} className={styles.chevron} />
    </Link>
  );
}
