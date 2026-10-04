import { renderFitrIcon } from "@/components/pwa/iconArt";
import { PWA_ICONS, isPwaIconFile } from "@/components/pwa/iconSet";

/**
 * Manifest / TWA icons: /icons/icon-192.png, /icons/icon-512.png, /icons/maskable-512.png.
 *
 * Route Handlers are not cached by default, so `force-static` + `generateStaticParams`
 * prerender every file at build time and `dynamicParams = false` 404s any other name.
 * (If Cache Components is ever enabled, drop `dynamic`: that segment option is removed there
 * and a GET handler without request-time APIs is prerendered automatically.)
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { name: string }[] {
  return Object.keys(PWA_ICONS).map((name) => ({ name }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  if (!isPwaIconFile(name)) {
    return new Response("Not found", { status: 404 });
  }
  const { size, variant } = PWA_ICONS[name];
  return renderFitrIcon(size, variant);
}
