import { useId } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

/** Shared sculpted-glass finish; glyphs remain recognizable at control sizes. */
function glassIcon(Glyph: LucideIcon) {
  return function GlassIcon({ className = "", strokeWidth: _strokeWidth, ...props }: LucideProps) {
    const id = `glass-${useId().replace(/:/g, "")}`;
    return (
      <svg {...props} className={`glass-icon ${className}`} viewBox="0 0 28 28" fill="none" aria-hidden={props["aria-label"] ? undefined : true}>
        <defs>
          <linearGradient id={id} x1="3" y1="1" x2="23" y2="28" gradientUnits="userSpaceOnUse">
            <stop className="glass-icon__light" />
            <stop offset="0.36" className="glass-icon__lavender" />
            <stop offset="0.7" className="glass-icon__coral" />
            <stop offset="1" className="glass-icon__deep" />
          </linearGradient>
        </defs>
        <Glyph x="2" y="3" width="24" height="24" stroke="var(--dot)" strokeWidth="3.8" opacity="0.28" />
        <Glyph x="2" y="1" width="24" height="24" stroke={`url(#${id})`} strokeWidth="3.7" />
        <Glyph x="1.4" y="0.4" width="24" height="24" stroke="var(--glass-strong)" strokeWidth="0.65" />
      </svg>
    );
  };
}

export const Pickaxe = glassIcon(Icons.Pickaxe);
export const Server = glassIcon(Icons.Server);
export const Target = glassIcon(Icons.Target);
export const Users = glassIcon(Icons.Users);
export const Wallet = glassIcon(Icons.Wallet);
export const Calendar = glassIcon(Icons.Calendar);
export const Check = glassIcon(Icons.Check);
export const Circle = glassIcon(Icons.Circle);
export const Crown = glassIcon(Icons.Crown);
export const ExternalLink = glassIcon(Icons.ExternalLink);
export const Flame = glassIcon(Icons.Flame);
export const Link2 = glassIcon(Icons.Link2);
export const Loader2 = glassIcon(Icons.Loader2);
export const Play = glassIcon(Icons.Play);
export const Star = glassIcon(Icons.Star);
export const Trophy = glassIcon(Icons.Trophy);
export const ChevronRight = glassIcon(Icons.ChevronRight);
export const Zap = glassIcon(Icons.Zap);
export const Lock = glassIcon(Icons.Lock);
export const Copy = glassIcon(Icons.Copy);
export const Send = glassIcon(Icons.Send);
export const Coins = glassIcon(Icons.Coins);
export const Pencil = glassIcon(Icons.Pencil);
export const Plus = glassIcon(Icons.Plus);
export const Trash2 = glassIcon(Icons.Trash2);