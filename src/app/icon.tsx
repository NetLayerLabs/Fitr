import { renderFitrIcon } from "@/components/pwa/iconArt";

// Browser-tab icon (<link rel="icon" type="image/png" sizes="32x32">), prerendered at build time.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return renderFitrIcon(size.width, "favicon");
}
