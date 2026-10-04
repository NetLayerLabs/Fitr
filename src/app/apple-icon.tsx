import { renderFitrIcon } from "@/components/pwa/iconArt";

// iOS home-screen icon (<link rel="apple-touch-icon">). Full-bleed: iOS applies its own mask.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderFitrIcon(size.width, "apple");
}
