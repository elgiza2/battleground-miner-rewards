import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const CARD_VIDEOS = {
  speed: {
    poster: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/167977c6-8539-46b1-9a15-8dba566f50b8.png",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130045_1a612b69-4854-4b34-8043-ccb91f2c60af.mp4",
  },
  context: {
    poster: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/0446d1d5-e65e-4db5-8090-3e30d09afc43.png",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130054_dd005674-d693-4d81-80a5-357f7f10b3a3.mp4",
  },
  connections: {
    poster: "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/da8d0242-4dee-4f6d-813f-a5887e86ad77.png",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_130103_7550f407-f14b-40a6-9616-7a26d7a8bd9f.mp4",
  },
} as const;

export type CardVariant = keyof typeof CARD_VIDEOS;

export function Grain() {
  return (
    <svg className="card__grain" viewBox="0 0 429 554" preserveAspectRatio="none" aria-hidden="true">
      <rect width="429" height="554" filter="url(#cardNoise)" />
    </svg>
  );
}

export function GlassCard({
  variant,
  video = false,
  hero = false,
  className,
  children,
}: {
  variant: CardVariant;
  video?: boolean;
  hero?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("card", `card--${variant}`, hero && "card--hero", className)}>
      {video && (
        <video
          className="card__media"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          poster={CARD_VIDEOS[variant].poster}
          src={CARD_VIDEOS[variant].src}
        />
      )}
      <Grain />
      {children}
    </div>
  );
}

/** Shared SVG filter defs (grain noise) mounted once in the shell. */
export function FilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }} aria-hidden="true">
      <defs>
        <filter id="cardNoise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".54" numOctaves="3" seed="27" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.8" intercept="-.25" />
            <feFuncG type="linear" slope="1.8" intercept="-.25" />
            <feFuncB type="linear" slope="1.8" intercept="-.25" />
            <feFuncA type="table" tableValues="0 .52" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
