import type { ReactNode } from "react";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingNav from "@/components/landing/LandingNav";
import pageStyles from "@/components/landing/LandingPage.module.css";
import section from "@/components/landing/section.module.css";
import styles from "./Public.module.css";

/**
 * Frame for the public pages on fitr.day (/s/…, /pool): the landing nav and footer, full-width.
 * `data-page="landing"` hides the app tab bar, like the landing page.
 */
export default function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className={pageStyles.page} data-page="landing">
      <LandingNav onHome={false} />
      <div className={`${section.container} ${styles.main}`}>{children}</div>
      <LandingFooter />
    </div>
  );
}
