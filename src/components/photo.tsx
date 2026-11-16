import { photo, type Shot } from "@/lib/photos";

/**
 * One photo, sharp on a retina phone without shipping a desktop-sized file to it.
 * `w` is the largest CSS width the image is ever shown at.
 */
export function Photo({
  shot,
  w,
  className = "",
  eager = false,
  sizes,
}: {
  shot: Shot;
  w: number;
  className?: string;
  eager?: boolean;
  sizes?: string;
}) {
  const widths = [Math.round(w / 2), w, w * 2];
  return (
    <img
      src={photo(shot.id, w)}
      srcSet={widths.map((x) => `${photo(shot.id, x)} ${x}w`).join(", ")}
      sizes={sizes ?? `(max-width: ${w}px) 100vw, ${w}px`}
      alt={shot.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}

/**
 * The banner at the top of an inner page: a photo, darkened toward the text,
 * with a label, a serif title and whatever the page needs beside it.
 */
export function Banner({
  shot,
  eyebrow,
  title,
  children,
  aside,
}: {
  shot: Shot;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-court-deep text-white shadow-[0_24px_48px_-28px_rgb(6_42_32/0.7)]">
      <Photo
        shot={shot}
        w={1100}
        eager
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-court-deep/95 via-court-deep/75 to-court-deep/25" />
      <div className="flex flex-wrap items-end justify-between gap-6 p-6 sm:p-9">
        <div className="min-w-0 max-w-xl">
          {eyebrow && <p className="eyebrow text-lime">{eyebrow}</p>}
          <h1 className="mt-2 text-3xl leading-[1.05] sm:text-5xl">{title}</h1>
          {children && <div className="mt-3 text-sm text-white/80 sm:text-base">{children}</div>}
        </div>
        {aside}
      </div>
    </section>
  );
}
