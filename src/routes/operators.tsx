import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { useCatalog, auth, errMsg, useRefresh } from "@/hooks/use-game";
import { Masthead, StateGate } from "@/components/game/Masthead";
import { GlassCard } from "@/components/game/GlassCard";
import { PaySheet, type PayItem } from "@/components/game/PaySheet";
import { equipOperatorFn } from "@/lib/game.functions";
import { art } from "@/lib/art";
import { fmtGram } from "@/lib/game-rules";

export const Route = createFileRoute("/operators")({
  head: () => ({
    meta: [
      { title: "Operators — DROPZONE" },
      { name: "description", content: "Recruit operators that boost your $GRAM mining speed." },
      { property: "og:title", content: "Operators — DROPZONE" },
      { property: "og:description", content: "From Rookie to Legend — each operator boosts every server you run." },
    ],
  }),
  component: Operators,
});

const VARIANTS = ["speed", "context", "connections"] as const;

function Operators() {
  const cat = useCatalog();
  const refresh = useRefresh();
  const [busy, setBusy] = useState<string | null>(null);
  const [pay, setPay] = useState<PayItem | null>(null);

  const equip = async (id: string) => {
    setBusy(id);
    try {
      await equipOperatorFn({ data: { ...auth(), id } });
      toast.success("Operator deployed");
      await refresh("catalog", "state");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <Masthead lead="Pick your" dots="SQUAD" line2="operator" intro="Your operator boosts every server you run. Only one can lead at a time." />
      <StateGate isLoading={cat.isLoading} error={cat.error}>
        <div className="grid grid-cols-2 gap-[var(--gap)] md:grid-cols-3">
          {cat.data?.operators.map((o, i) => {
            const adsLocked = o.unlockAds > 0 && !o.owned;
            const adsReady = adsLocked && (cat.data?.adsTotal ?? 0) >= o.unlockAds;
            return (
              <GlassCard key={o.id} variant={VARIANTS[i % 3]!} className="entrance">
                <div className="flex h-full flex-col p-3">
                  <div className="flex items-center justify-between">
                    <span className="tag">{o.rarity}</span>
                    <span className="text-[13px] font-semibold">+{o.boostPct}%</span>
                  </div>
                  <img src={art(o.image)} alt={o.name} loading="lazy" className="mx-auto mt-2 h-32 w-32 object-contain drop-shadow-xl" />
                  <p className="mt-1 text-[15px] font-semibold">{o.name}</p>
                  <p className="text-[12px] text-on-card-soft">
                    {o.owned ? "Recruited" : o.unlockAds > 0 ? `Unlock: ${o.unlockAds} videos` : o.price > 0 ? `${fmtGram(o.price)} GRAM` : "Free"}
                  </p>
                  {o.equipped ? (
                    <span className="pill pill--ghost pill--sm mt-3 w-full">
                      <Check className="h-3.5 w-3.5" /> Leading
                    </span>
                  ) : o.owned || adsReady ? (
                    <button className="pill pill--sm mt-3 w-full" disabled={busy === o.id} onClick={() => equip(o.id)}>
                      {busy === o.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {o.owned ? "Deploy" : "Unlock & deploy"}
                    </button>
                  ) : adsLocked ? (
                    <span className="pill pill--ghost pill--sm mt-3 w-full tabular">
                      {cat.data?.adsTotal}/{o.unlockAds} videos
                    </span>
                  ) : (
                    <button
                      className="pill pill--sm mt-3 w-full"
                      onClick={() =>
                        setPay({ title: o.name, subtitle: `+${o.boostPct}% mining speed on every server, forever.`, image: art(o.image), price: o.price, purpose: "operator", ref: o.id, allowBalance: true })
                      }
                    >
                      Recruit · {fmtGram(o.price)}
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </StateGate>
      <PaySheet item={pay} balance={cat.data?.balance ?? 0} onClose={() => setPay(null)} />
    </div>
  );
}
