import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import BottomNav from "@/components/nav/BottomNav";
import NativeSync from "@/components/native/NativeSync";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import WalletProviders from "@/components/wallet/WalletProviders";
import "./globals.css";

/** Text face. Exposed as a CSS variable; globals.css composes it into --font-sans. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Display face for headlines and the big, tight numerals (--font-display). */
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Fitr",
    template: "%s · Fitr",
  },
  description:
    "Fitr counts your push-ups, squats and planks with on-device AI pose tracking. Every rep is checked by joint angles, and your video never leaves your phone.",
  applicationName: "Fitr",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fitr",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0B0D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // Draw under notches / home indicator; globals.css pads with env(safe-area-inset-*).
  viewportFit: "cover",
  // User zoom is intentionally left enabled (accessibility).
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <WalletProviders>
          <div className="app-frame">
            <main id="main" className="app-main" tabIndex={-1}>
              {children}
            </main>
            <BottomNav />
          </div>
          <NativeSync />
        </WalletProviders>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
