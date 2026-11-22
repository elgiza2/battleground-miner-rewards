import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "@/components/game/GlassIcons";
import { useCatalog, useGameState, auth, errMsg, useRefresh } from "@/hooks/use-game";
import { Masthead, StateGate } from "@/components/game/Masthead";
import { GlassCard } from "@/components/game/GlassCard";
import { PaySheet, type PayItem } from "@/components/game/PaySheet";
import { claimFreeServerFn } from "@/lib/game.functions";
import { art, tierVariant } from "@/lib/art";
import { fmtGram, fmtPubg } from "@/lib/game-rules";
import { haptic } from "@/lib/telegram-client";

export const Route = createFileRoute("/servers")({
  head: () => ({
    meta: [
      { title: "Armory — 90 mining servers | PUBG" },
      { name: "description", content: "Pick from 90 battle-gear mining servers, from Field Radios to the Golden Airdrop." },
      { property: "og:title", content: "Armory — 90 mining servers | PUBG" },
      { property: "og:description", content: "Two free servers and 88 upgrades that mine $PUBG around the clock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Armory,
});

const TIERS = ["All", "Field Radio", "Ammo Rig", "Supply Drop", "Jeep Rig", "Bunker Node", "Radar Tower", "Gunship", "Cargo Hauler", "Command Fortress", "Golden Airdrop"];

function Armory() {
  const cat = useCatalog();
  const st = useGameState();
  const refresh = useRefresh();
  const [tier, setTier] = useState(0);
  const [pay, setPay] = useState<PayItem | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const paid = useMemo(() => (cat.data?.servers ?? []).filter((s) => s.unlock === "gram" && (tier === 0 || s.tier === tier)), [cat.data, tier]);
  const free = st.data?.freeServers;

  const claimFree = async (kind: "ads" | "squad") => {
    setClaiming(kind);
    try {
      const r = await claimFreeServerFn({ data: { ...auth(), kind } });
      haptic("success");
      toast.success(`${r.name} deployed!`);
      await refresh("state", "catalog");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="page">
      <Masthead lead="Armory of" dots="90" line2="mining servers" intro="Every server mines $PUBG 24/7. Higher tiers mine faster and pay back more." />
      <StateGate isLoading={cat.isLoading || st.isLoading} error={cat.error ?? st.error}>
        {free && (
          <div className="grid grid-cols-2 gap-[var(--gap)]">
            <FreeCard
              image={art("server-ads")}
              title="Ad Hunter Crate"
              sub={`${free.ads.progress}/${free.ads.goal} videos`}
              pct={free.ads.progress / free.ads.goal}
              ready={free.ads.ready}
              busy={claiming === "ads"}
              onClaim={() => claimFree("ads")}
              variant="connections"
            />
            <FreeCard
              image={art("server-squad")}
              title="Squad Beacon"
              sub={free.squad.claimed ? "Deployed" : `${free.squad.progress}/${free.squad.goal} invites`}
              pct={free.squad.progress / free.squad.goal}
              ready={free.squad.ready}
              busy={claiming === "squad"}
              onClaim={() => claimFree("squad")}
              variant="context"
            />
          </div>
        )}

        <div className="no-scrollbar -mx-[var(--gutter)] mt-6 flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1">
          {TIERS.map((t, i) => (
            <button key={t} className="chip" data-on={tier === i} onClick={() => setTier(i)}>
              {i === 0 ? t : `T${i} · ${t}`}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
          {paid.map((s) => {
                        return (
              <GlassCard key={s.id} variant={tierVariant(s.tier)} className="entrance">
                <button
                  className="flex w-full flex-col p-3 text-left"
                  onClick={() =>
                    setPay({
                      title: s.name,
                      subtitle: `Mines ${fmtPubg(s.dailyRate)} PUBG/day for ${s.durationDays} days — ${fmtPubg(s.dailyRate * s.durationDays, 0)} PUBG total.`,
                      image: art(s.image),
                      price: s.price,
                      purpose: "server",
                      ref: String(s.id),
                      allowBalance: true,
                    })
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="tag">{s.rarity}</span>
                    <span className="text-[11px] text-on-card-soft">Mk {s.level}</span>
                  </div>
                  <img src={art(s.image)} alt={s.name} loading="lazy" className="mx-auto my-2 h-24 w-24 object-contain drop-shadow-xl" style={{ filter: `saturate(${1 + s.level * 0.06})` }} />
                  <p className="truncate text-[14px] font-semibold">{s.name}</p>
                  <p className="text-[12px] text-on-card-soft tabular">{fmtPubg(s.dailyRate, 0)} PUBG/day</p>
                  <span className="pill pill--sm mt-3 w-full">{fmtGram(s.price)} GRAM</span>
                </button>
              </GlassCard>
            );
          })}
        </div>
      </StateGate>
      <PaySheet item={pay} balance={cat.data?.balance ?? 0} onClose={() => setPay(null)} />
    </div>
  );
}

function FreeCard(p: { image: string; title: string; sub: string; pct: number; ready: boolean; busy: boolean; onClaim: () => void; variant: "connections" | "context" }) {
  return (
    <GlassCard variant={p.variant} className="entrance">
      <div className="flex h-full flex-col p-3">
        <span className="tag self-start">Free</span>
        <img src={p.image} alt={p.title} className="mx-auto my-2 h-20 w-20 object-contain drop-shadow-xl" />
        <p className="text-[14px] font-semibold">{p.title}</p>
        <p className="text-[12px] text-on-card-soft tabular">{p.sub}</p>
        <div className="meter mt-2">
          <span style={{ width: `${Math.min(1, p.pct) * 100}%` }} />
        </div>
        <button className="pill pill--sm mt-3 w-full" disabled={!p.ready || p.busy} onClick={p.onClaim}>
          {p.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : !p.ready && <Lock className="h-3.5 w-3.5" />}
          {p.ready ? "Deploy free" : "Locked"}
        </button>
      </div>
    </GlassCard>
  );
}
