import BuiltForSeeker from "./BuiltForSeeker";
import FinalCta from "./FinalCta";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import LandingFooter from "./LandingFooter";
import LandingNav from "./LandingNav";
import Spotlight from "./Spotlight";
import Trust from "./Trust";
import WorkoutShowcase from "./WorkoutShowcase";
import styles from "./LandingPage.module.css";

/**
 * The public marketing page (fitr.day). `data-page="landing"` lets globals.css widen the app
 * frame to the full viewport; BottomNav hides itself on /landing.
 */
export default function LandingPage() {
  return (
    <div className={styles.page} data-page="landing">
      <Spotlight />
      <LandingNav />
      <Hero />
      <HowItWorks />
      <WorkoutShowcase />
      <Trust />
      <BuiltForSeeker />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}
