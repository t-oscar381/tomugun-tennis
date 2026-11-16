import qrcode from "qrcode-generator";

/**
 * A QR code as inline SVG, drawn on the server.
 *
 * The group shares one court, so the fastest way to get the eighth person in
 * is to hold a phone up: they point a camera at it and land on the join page
 * with the code already filled in. Pure JS and no canvas, so it renders the
 * same on Cloudflare Workers as it does locally.
 *
 * Error correction "M" and a four-module quiet zone: enough to survive a
 * cracked screen and sunlight without making the modules tiny.
 */
export function Qr({ value, className = "" }: { value: string; className?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();

  const n = qr.getModuleCount();
  const quiet = 4;
  const size = n + quiet * 2;

  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.isDark(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR code that opens the join page for this group"
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#062a20" />
    </svg>
  );
}
