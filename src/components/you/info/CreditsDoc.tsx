import styles from "@/components/you/You.module.css";
import PageHeader from "@/components/ui/PageHeader";
import { makeTranslator, type Translator } from "@/lib/i18n";
import { exerciseName } from "@/lib/i18n/exercise";
import { en } from "@/lib/i18n/messages";
import { FORM_GUIDES } from "@/lib/formGuide";
import { EXERCISE_KINDS } from "@/lib/pose/types";
import pageStyles from "@/app/you/page.module.css";

const SOFTWARE: ReadonlyArray<{ name: string; license: string; url: string }> = [
  { name: "MediaPipe Pose Landmarker (Google)", license: "Apache-2.0", url: "https://github.com/google-ai-edge/mediapipe" },
  { name: "Next.js", license: "MIT", url: "https://github.com/vercel/next.js" },
  { name: "React", license: "MIT", url: "https://github.com/facebook/react" },
  { name: "Solana Kit (@solana/kit, @solana/react)", license: "MIT", url: "https://github.com/anza-xyz/kit" },
  { name: "Solana Program clients (@solana-program/*)", license: "Apache-2.0", url: "https://github.com/solana-program" },
  { name: "Wallet Standard", license: "Apache-2.0", url: "https://github.com/wallet-standard/wallet-standard" },
  {
    name: "Solana Mobile Wallet Adapter",
    license: "Apache-2.0",
    url: "https://github.com/solana-mobile/mobile-wallet-adapter",
  },
  { name: "Inter and Inter Tight typefaces", license: "SIL OFL 1.1", url: "https://github.com/rsms/inter" },
  { name: "Geist Mono typeface", license: "SIL OFL 1.1", url: "https://github.com/vercel/geist-font" },
];

function clipCredits(t: Translator<"you">, tx: Translator<"exercises">) {
  const out: Array<{ key: string; label: string; provider: string; url: string }> = [];
  for (const kind of EXERCISE_KINDS) {
    for (const [who, clip] of Object.entries(FORM_GUIDES[kind].clips)) {
      if (!clip) continue;
      out.push({
        key: `${kind}-${who}`,
        label: t("creditsClipLabel", { exercise: exerciseName(tx, kind), author: clip.credit.author }),
        provider: clip.credit.provider,
        url: clip.credit.url,
      });
    }
  }
  return out;
}

/**
 * Body of the credits info page; `back` adds the in-app back arrow (omitted on fitr.day).
 * `t` / `tx` are the app's translators; the public website omits them and stays in English.
 * Library names and licences are never translated.
 */
export default function CreditsDoc({
  back,
  t = makeTranslator("en", en, "you"),
  tx = makeTranslator("en", en, "exercises"),
}: {
  back?: string;
  t?: Translator<"you">;
  tx?: Translator<"exercises">;
}) {
  const clips = clipCredits(t, tx);
  return (
    <div className={pageStyles.page}>
      <PageHeader flush back={back} eyebrow={t("creditsEyebrow")} title={t("creditsTitle")} />
      <div className={styles.prose}>
        <p>{t("creditsIntro")}</p>
        <ul className={styles.credits} role="list">
          {SOFTWARE.map((s) => (
            <li key={s.name} className={styles.credit}>
              <a href={s.url} target="_blank" rel="noreferrer noopener" className={styles.creditName}>
                {s.name}
              </a>
              <span className={styles.creditLicense}>{s.license}</span>
            </li>
          ))}
        </ul>

        {clips.length > 0 ? (
          <>
            <h2>{t("creditsClipsHeading")}</h2>
            <ul className={styles.credits} role="list">
              {clips.map((c) => (
                <li key={c.key} className={styles.credit}>
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className={styles.creditName}>
                    {c.label}
                  </a>
                  <span className={styles.creditLicense}>{c.provider}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

      </div>
    </div>
  );
}
