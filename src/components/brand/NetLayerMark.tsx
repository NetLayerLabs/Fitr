/**
 * The NetLayer Labs mark, from the studio's own artwork (public/brand/netlayer-mark*.png, cropped
 * from NetLayerLabs_Logo.png), so its highlights and glints match the original exactly.
 */
export default function NetLayerMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset
    <img
      className={className}
      src="/brand/netlayer-mark.png"
      srcSet="/brand/netlayer-mark.png 1x, /brand/netlayer-mark@2x.png 2x"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
    />
  );
}
