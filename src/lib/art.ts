import crateHero from "@/assets/art/crate-hero.webp.asset.json";
import logo from "@/assets/art/logo.webp.asset.json";
import opCommander from "@/assets/art/op-commander.webp.asset.json";
import opLegend from "@/assets/art/op-legend.webp.asset.json";
import opMedic from "@/assets/art/op-medic.webp.asset.json";
import opRookie from "@/assets/art/op-rookie.webp.asset.json";
import opScout from "@/assets/art/op-scout.webp.asset.json";
import opSniper from "@/assets/art/op-sniper.webp.asset.json";
import sAds from "@/assets/art/server-ads.webp.asset.json";
import sSquad from "@/assets/art/server-squad.webp.asset.json";
import s1 from "@/assets/art/server-t1.webp.asset.json";
import s2 from "@/assets/art/server-t2.webp.asset.json";
import s3 from "@/assets/art/server-t3.webp.asset.json";
import s4 from "@/assets/art/server-t4.webp.asset.json";
import s5 from "@/assets/art/server-t5.webp.asset.json";
import s6 from "@/assets/art/server-t6.webp.asset.json";
import s7 from "@/assets/art/server-t7.webp.asset.json";
import s8 from "@/assets/art/server-t8.webp.asset.json";
import s9 from "@/assets/art/server-t9.webp.asset.json";
import s10 from "@/assets/art/server-t10.webp.asset.json";

const ART: Record<string, string> = {
  "crate-hero": crateHero.url,
  logo: logo.url,
  "op-rookie": opRookie.url,
  "op-scout": opScout.url,
  "op-medic": opMedic.url,
  "op-sniper": opSniper.url,
  "op-commander": opCommander.url,
  "op-legend": opLegend.url,
  "server-ads": sAds.url,
  "server-squad": sSquad.url,
  "server-t1": s1.url,
  "server-t2": s2.url,
  "server-t3": s3.url,
  "server-t4": s4.url,
  "server-t5": s5.url,
  "server-t6": s6.url,
  "server-t7": s7.url,
  "server-t8": s8.url,
  "server-t9": s9.url,
  "server-t10": s10.url,
};

export const art = (key: string) => ART[key] ?? logo.url;

/** Card palette per tier — cycles through the three glass finishes. */
export const tierVariant = (tier: number): "speed" | "context" | "connections" =>
  (["speed", "context", "connections"] as const)[(Math.max(tier, 1) - 1) % 3]!;
