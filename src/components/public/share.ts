/**
 * Share a URL with the platform share sheet (navigator.share: Android's native sheet inside the
 * Fitr app's WebView and Chrome), falling back to copying the link. Pure apart from the injected
 * navigator, so it is testable.
 */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText(text: string): Promise<void> };
}

export async function shareLink(data: { url: string; title: string; text: string }, nav: ShareNavigator | undefined): Promise<ShareOutcome> {
  if (nav?.share && (!nav.canShare || nav.canShare(data))) {
    try {
      await nav.share(data);
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
      // NotAllowedError etc.: fall through to copying.
    }
  }
  if (nav?.clipboard) {
    try {
      await nav.clipboard.writeText(data.url);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
