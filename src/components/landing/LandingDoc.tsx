import type { ReactNode } from "react";
import LandingFooter from "./LandingFooter";
import LandingNav from "./LandingNav";
import pageStyles from "./LandingPage.module.css";
import section from "./section.module.css";
import styles from "./LandingDoc.module.css";

/**
 * Public info page shell (fitr.day/verification, /privacy, /credits): the landing nav and footer
 * around one of the app's info pages, rendered in a readable column. `data-page="landing"` gives
 * it the full-width frame and hides the app tab bar, as on the landing page.
 */
export default function LandingDoc({ children }: { children: ReactNode }) {
  return (
    <div className={pageStyles.page} data-page="landing">
      <LandingNav onHome={false} />
      <div className={`${section.container} ${styles.doc}`}>{children}</div>
      <LandingFooter />
    </div>
  );
}
