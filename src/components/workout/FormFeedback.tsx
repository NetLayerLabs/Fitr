import { AlertIcon, CameraIcon } from "@/components/icons/Icons";
import type { FormIssue } from "@/lib/pose/types";
import { useT } from "@/lib/i18n/I18nProvider";
import { FORM_ISSUE_COPY, FORM_ISSUE_KIND, formIssueCopy } from "./formIssueCopy";
import styles from "./WorkoutScreen.module.css";

export { FORM_ISSUE_COPY, FORM_ISSUE_KIND };

export interface FormFeedbackProps {
  /** Current (debounced) top issue, or null when form is good. */
  issue: FormIssue | null;
  /** Reason of a just-rejected rep, shown briefly; takes precedence over `issue`. */
  rejection: FormIssue | null;
}

/**
 * Visual feedback toast. Not a live region itself: announcements go through the screen's
 * single polite live region so screen readers are not flooded.
 */
export default function FormFeedback({ issue, rejection }: FormFeedbackProps) {
  const t = useT("workout");
  if (rejection) {
    return (
      <div className={styles.toast} data-tone="rejected">
        <AlertIcon size={22} />
        <p>
          <strong>{t("repNotCounted")}</strong> {formIssueCopy(rejection, t)}
        </p>
      </div>
    );
  }
  if (issue) {
    const tracking = FORM_ISSUE_KIND[issue] === "tracking";
    return (
      <div className={styles.toast} data-tone={tracking ? "tracking" : "form"}>
        {tracking ? <CameraIcon size={22} /> : <AlertIcon size={22} />}
        <p>{formIssueCopy(issue, t)}</p>
      </div>
    );
  }
  return null;
}
