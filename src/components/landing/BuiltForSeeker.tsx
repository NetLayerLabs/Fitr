import { CoinIcon, FitrMark } from "@/components/icons/Icons";
import { KeyIcon, PhoneIcon } from "./LandingIcons";
import section from "./section.module.css";
import styles from "./BuiltForSeeker.module.css";

const POINTS = [
  {
    Icon: KeyIcon,
    title: "Signed in Seed Vault",
    body: "Every stake and claim is approved with your keys in Seeker's secure hardware. Fitr never sees them.",
  },
  {
    Icon: PhoneIcon,
    title: "Native to Solana Mobile",
    body: "Mobile Wallet Adapter, no browser extension, no seed phrase copy-paste. One tap, one signature.",
  },
  {
    Icon: CoinIcon,
    title: "Staked in SKR",
    body: "Put real $SKR on Solana mainnet behind your goal. You choose the amount; the vault enforces the rules.",
  },
] as const;

/** Seeker-specific section: Seed Vault, Mobile Wallet Adapter, SKR, one stake per device. */
export default function BuiltForSeeker() {
  return (
    <section id="seeker" className={section.section} aria-labelledby="seeker-title">
      <div className={`${section.container} ${styles.grid}`}>
        <div className={section.reveal}>
          <div className={section.head}>
            <p className={section.eyebrow}>Built for Seeker</p>
            <h2 id="seeker-title" className={section.title}>
              One Seeker. One stake. Your keys.
            </h2>
            <p className={section.lede}>
              Staking is exclusive to the Solana Seeker, so every pool is one real phone and one real
              person. Workouts and rep tracking are free on any Android phone or browser.
            </p>
          </div>
          <ul className={styles.points} role="list">
            {POINTS.map(({ Icon, title, body }) => (
              <li key={title}>
                <span className={styles.icon}>
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className={styles.pointTitle}>{title}</h3>
                  <p className={styles.pointBody}>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${styles.visual} ${section.reveal}`} aria-hidden="true">
          <div className={styles.glow} />
          <div className={styles.sheet}>
            <div className={styles.grabber} />
            <div className={styles.sheetHead}>
              <span className={styles.appIcon}>
                <FitrMark size={28} />
              </span>
              <div>
                <p className={styles.sheetApp}>Fitr</p>
                <p className={styles.sheetOrigin}>app.fitr.day</p>
              </div>
            </div>
            <p className={styles.sheetTitle}>Approve transaction</p>
            <dl className={styles.sheetRows}>
              <div>
                <dt>Commitment</dt>
                <dd>40 squats · daily</dd>
              </div>
              <div>
                <dt>Stake</dt>
                <dd className={styles.amount}>250 SKR</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>Solana mainnet</dd>
              </div>
            </dl>
            <div className={styles.sheetActions}>
              <span className={styles.cancel}>Cancel</span>
              <span className={styles.approve}>Approve</span>
            </div>
            <div className={styles.vault}>
              <span className={styles.fingerprint}>
                <KeyIcon size={18} />
              </span>
              Secured by Seed Vault
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
