import LandingDoc from "@/components/landing/LandingDoc";
import { DownloadIcon } from "@/components/landing/LandingIcons";
import { APK_NOTE, LANDING_LINKS } from "@/components/landing/links";
import { crewAppUrl } from "@/lib/solana/vault/crews";
import type { CrewInviteResult } from "./inviteData";
import styles from "./crews.module.css";

export interface CrewInvitePageProps {
  crewId: bigint;
  result: CrewInviteResult;
}

function Ctas({ crewId }: { crewId: bigint }) {
  return (
    <div className={styles.inviteCtas}>
      <a className={`${styles.cta} ${styles.ctaPrimary}`} href={LANDING_LINKS.apk}>
        <DownloadIcon size={20} strokeWidth={2.25} aria-hidden="true" />
        Download Fitr to join
      </a>
      <a className={`${styles.cta} ${styles.ctaSecondary}`} href={crewAppUrl(crewId)}>
        Open in Fitr
      </a>
      <p className={styles.fine}>
        {APK_NOTE}. Already installed? &ldquo;Open in Fitr&rdquo; takes you straight to the crew.
      </p>
    </div>
  );
}

/**
 * The public invite (fitr.day/c/<id>), on the landing shell. A server component: everything it
 * shows was read on the server.
 */
export default function CrewInvitePage({ crewId, result }: CrewInvitePageProps) {
  if (result.kind === "closed") {
    return (
      <LandingDoc>
        <section className={styles.invite} aria-labelledby="invite-title">
          <p className={styles.eyebrow}>Crew invite</p>
          <h1 id="invite-title" className={styles.inviteTitle}>
            This crew was deleted
          </h1>
          <p className={styles.lede}>
            Its creator removed it from Fitr, so it can no longer be joined. Start your own crew in the app, or ask your
            friend for a new invite.
          </p>
          <div className={styles.inviteCtas}>
            <a className={`${styles.cta} ${styles.ctaPrimary}`} href={LANDING_LINKS.apk}>
              <DownloadIcon size={20} strokeWidth={2.25} aria-hidden="true" />
              Download Fitr
            </a>
            <p className={styles.fine}>{APK_NOTE}. Staking is Seeker-only.</p>
          </div>
        </section>
      </LandingDoc>
    );
  }

  if (result.kind === "missing" || result.kind === "no_pool") {
    const soon = result.kind === "no_pool";
    return (
      <LandingDoc>
        <section className={styles.invite} aria-labelledby="invite-title">
          <p className={styles.eyebrow}>Crew invite</p>
          <h1 id="invite-title" className={styles.inviteTitle}>
            {soon ? "Crews open with the vault" : "This crew doesn't exist"}
          </h1>
          <p className={styles.lede}>
            {soon
              ? "Fitr's onchain vault isn't live yet, so no crew can exist so far. Install the app now and this link will work the day staking opens."
              : "The link may be mistyped, or the crew was never created. Ask your friend for a fresh invite, or start your own crew in the app."}
          </p>
          <div className={styles.inviteCtas}>
            <a className={`${styles.cta} ${styles.ctaPrimary}`} href={LANDING_LINKS.apk}>
              <DownloadIcon size={20} strokeWidth={2.25} aria-hidden="true" />
              Download Fitr
            </a>
            <p className={styles.fine}>{APK_NOTE}. Staking is Seeker-only.</p>
          </div>
        </section>
      </LandingDoc>
    );
  }

  const crew = result.kind === "found" ? result.crew : null;
  return (
    <LandingDoc>
      <section className={styles.invite} aria-labelledby="invite-title">
        <p className={styles.eyebrow}>You&apos;re invited</p>
        <h1 id="invite-title" className={styles.inviteTitle}>
          {crew ? `Join ${crew.name}` : "Join a crew on Fitr"}
        </h1>

        <div className={styles.inviteCard}>
          <p className={styles.eyebrow}>The challenge</p>
          <p className={styles.challengeNoun}>{crew ? crew.challenge : "Show up every day, together"}</p>
          {crew ? (
            <p className={styles.hint}>
              {crew.members} {crew.members === 1 ? "member" : "members"}
              {crew.committedToday > 0 ? ` · ${crew.committedToday} committed today` : ""}
            </p>
          ) : null}
        </div>

        <Ctas crewId={crewId} />

        <div className={styles.inviteCard}>
          <h2 className={styles.sectionTitle}>How a crew works</h2>
          <ol className={styles.steps}>
            <li>Everyone stakes their own SKR on the day&apos;s workout. You pick the amount.</li>
            <li>Fitr counts your reps on your phone and re-checks them with live challenges.</li>
            <li>
              Show up and your stake comes back. Miss it and your stake goes to the crew members who showed up (Fitr
              keeps a small fee on forfeits only). If nobody shows up, the stakes roll over to the next crew day someone
              completes.
            </li>
          </ol>
          <p className={styles.fine}>
            A commitment device, not an investment: if the whole crew shows up, everyone simply gets their stake back.
            Staking needs a Solana Seeker.
          </p>
        </div>
      </section>
    </LandingDoc>
  );
}
