import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, Play, Zap } from "lucide-react";
import { useGameState, auth, errMsg, useRefresh } from "@/hooks/use-game";
import { Masthead, StateGate } from "@/components/game/Masthead";
import { GlassCard } from "@/components/game/GlassCard";
import { DotText } from "@/components/game/DotText";
import { Gauge } from "@/components/game/Gauge";
import { PaySheet, type PayItem } from "@/components/game/PaySheet";
import { useAdAction } from "@/components/game/useAdAction";
import { claimMiningFn } from "@/lib/game.functions";
import { art } from "@/lib/art";
import { PUBG_ICON, RULES, fmtGram, fmtPubg } from "@/lib/game-rules";
import { haptic } from "@/lib/telegram-client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PUBG — Base" },
      { name: "description", content: "Your PUBG base: live $PUBG mining, airdrop crates and boosts." },
      { property: "og:title", content: "PUBG — Base" },
      { property: "og:description", content: "Live $PUBG mining, airdrop crates and boosts on Telegram." },
    ],
  }),
  component: Base,
});

function useTicker(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Base() {
  const q = useGameState();
  const s = q.data;
  const now = useTicker();
  const refresh = useRefresh();
  const ad = useAdAction();
  const [claiming, setClaiming] = useState<null | "x1" | "x2">(null);
  const [pay, setPay] = useState<PayItem | null>(null);

  const fetchedAt = useMemo(() => Date.now(), [q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useMemo(() => {
    if (!s) return { pending: 0, fill: 0, cap: 0 };
    const perSec = s.mining.ratePerDay / 86400;
    const cap = (s.mining.ratePerDay / 24) * s.mining.capHours;
    const pending = Math.min(s.mining.pending + perSec * ((now - fetchedAt) / 1000), cap || Infinity);
    return { pending, fill: cap > 0 ? pending / cap : 0, cap };
  }, [s, now, fetchedAt]);

  const boostLeft = s?.me.boostUntil ? Math.max(0, new Date(s.me.boostUntil).getTime() - now) : 0;

  const claim = async (double: boolean) => {
    setClaiming(double ? "x2" : "x1");
    try {
      if (double) {
        const ok = await ad.watch({ silent: true });
        if (!ok) return;
      }
      const r = await claimMiningFn({ data: { ...auth(), double } });
      haptic("success");
      toast.success(`+${fmtPubg(r.amount, 4)} PUBG claimed${r.doubled ? " · doubled!" : ""}`);
      await refresh("state", "wallet");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="page">
      <Masthead
        lead="Mine"
        dots="PUBG"
        line2="in the drop zone"
        intro="Deploy servers, open airdrop crates and squad up. Swap your PUBG to GRAM anytime."
        right={
          s && (
            <Link to="/wallet" className="glass flex shrink-0 flex-col items-end px-3 py-2">
              <span className="flex items-center gap-1 text-[15px] font-semibold tabular text-ink">
                <img src={PUBG_ICON} alt="" className="h-4 w-4 rounded-full" />
                {fmtPubg(s.me.balance, 0)}
              </span>
              <span className="mt-0.5 text-[10.5px] text-copy tabular">{fmtGram(s.me.gram)} GRAM</span>
            </Link>
          )
        }
      />
      <StateGate isLoading={q.isLoading} error={q.error}>
        {s && (
          <Link to="/wallet" className="glass mb-[var(--gap)] flex items-center gap-3 px-4 py-3">
            <img src={PUBG_ICON} alt="PUBG" className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <p className="text-[13px] font-semibold">PUBG price</p>
              <p className="text-[11.5px] text-copy tabular">1 GRAM = {fmtPubg(s.market.pubgPerGram, 0)} PUBG</p>
            </div>
            <span className="text-[14px] font-semibold tabular">{s.market.pubgUsd ? `$${s.market.pubgUsd.toFixed(8)}` : "—"}</span>
            <span className="chip !h-7">Swap</span>
          </Link>
        )}
        {s && (
          <div className="grid gap-[var(--gap)] md:grid-cols-3">
            {/* Mining rig */}
            <GlassCard variant="speed" video hero className="entrance">
              <div className="flex h-full flex-col px-[7%] pt-[6.3%] pb-[7%]">
                <div className="flex items-start justify-between">
                  <p className="card__title" style={{ fontSize: "calc(22.7 * var(--u))" }}>
                    Mining Rig
                    <br />
                    Live Extraction
                  </p>
                  {s.mining.boosted && (
                    <span className="tag">
                      <Zap className="mr-1 h-3 w-3" />
                      2x
                    </span>
                  )}
                </div>
                <div className="relative mx-auto mt-[4%] w-[86%]" style={{ aspectRatio: "326 / 190" }}>
                  <div className="absolute inset-x-0 top-0" style={{ aspectRatio: "1" }}>
                    <Gauge fill={live.fill} />
                  </div>
                  <div className="absolute inset-x-0 bottom-[4%] flex items-end justify-center gap-[2%]">
                    <span style={{ height: "calc(40 * var(--u))" }}>
                      <DotText text={live.pending.toFixed(live.pending >= 1000 ? 1 : 4)} r={2.05} />
                    </span>
                  </div>
                </div>
                <p className="mt-[2%] text-center" style={{ fontSize: "calc(18 * var(--u))", color: "var(--on-card-soft)" }}>
                  {s.mining.activeCount > 0 ? (
                    <>
                      PUBG in backpack · {Math.round(live.fill * 100)}% full
                      <br />
                      {fmtPubg(s.mining.ratePerDay)} PUBG / day
                    </>
                  ) : (
                    <>
                      No server running
                      <br />
                      Deploy one in the Armory
                    </>
                  )}
                </p>
                <div className="mt-auto flex gap-2 pt-4">
                  {s.mining.activeCount > 0 ? (
                    <>
                      <button className="pill flex-1" disabled={!!claiming || live.pending <= 0} onClick={() => claim(false)}>
                        {claiming === "x1" && <Loader2 className="h-4 w-4 animate-spin" />}
                        Claim
                      </button>
                      <button className="pill pill--ghost flex-1" disabled={!!claiming || live.pending <= 0} onClick={() => claim(true)}>
                        {claiming === "x2" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        Claim ×2
                      </button>
                    </>
                  ) : (
                    <Link to="/servers" className="pill flex-1">
                      Open Armory
                    </Link>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Airdrop crate */}
            <GlassCard variant="connections" video className="entrance min-h-[360px]">
              <div className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between">
                  <p className="card__title text-[19px]">
                    Airdrop Crate
                    <br />
                    <span className="text-on-card-soft">Instant loot + 2x boost</span>
                  </p>
                  <span className="tag tabular">{s.me.adsToday}/{RULES.adDailyCap}</span>
                </div>
                <img src={art("crate-hero")} alt="Airdrop crate" className="float-y mx-auto my-3 h-40 w-40 object-contain drop-shadow-2xl" />
                <div className="mb-1 flex justify-between text-[12px] text-on-card-soft">
                  <span>Free Ad Hunter server</span>
                  <span className="tabular">
                    {s.freeServers.ads.progress}/{s.freeServers.ads.goal}
                  </span>
                </div>
                <div className="meter">
                  <span style={{ width: `${(s.freeServers.ads.progress / s.freeServers.ads.goal) * 100}%` }} />
                </div>
                <button className="pill mt-4 w-full" disabled={ad.busy} onClick={() => ad.watch()}>
                  {ad.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Open crate
                </button>
              </div>
            </GlassCard>

            {/* Hashrate */}
            <GlassCard variant="context" className="entrance min-h-[320px]">
              <div className="flex h-full flex-col p-5">
                <p className="card__title text-[19px]">
                  Hashrate
                  <br />
                  <span className="text-on-card-soft">Total extraction power</span>
                </p>
                <div className="mt-6 flex items-end gap-2">
                  <span style={{ height: 34 }}>
                    <DotText text={`${s.mining.multiplier.toFixed(1)}x`} r={2.32} pitch={5.6} />
                  </span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-on-card-soft">
                  {s.me.operatorBoost > 0 ? `${s.me.operatorName} +${s.me.operatorBoost}%` : "Rookie operator"}
                  {s.mining.boosted ? ` · 2x boost ${formatLeft(boostLeft)}` : " · no boost active"}
                </p>
                <div className="mt-auto flex gap-2 pt-5">
                  <button
                    className="pill flex-1"
                    onClick={() =>
                      setPay({
                        title: "Battle Pass · 24h",
                        subtitle: "Double mining speed for 24 hours. Stacks with video boosts.",
                        image: art("server-t10"),
                        price: RULES.battlePassPrice,
                        purpose: "boost",
                        ref: "pass24",
                        allowBalance: false,
                      })
                    }
                  >
                    <Zap className="h-4 w-4" /> Battle Pass
                  </button>
                  <Link to="/operators" className="pill pill--ghost flex-1">
                    Operators
                  </Link>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {s && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold tracking-tight">Deployed servers</h2>
              <Link to="/servers" className="flex items-center text-[13px] font-medium text-dot">
                Armory <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="no-scrollbar -mx-[var(--gutter)] flex gap-3 overflow-x-auto px-[var(--gutter)] pb-2">
              {s.servers.filter((x) => x.active).length === 0 && (
                <div className="glass w-full p-5 text-[14px] text-copy">Your trial radio has ended. Watch {RULES.freeAdsServerGoal} videos for a free server or deploy one from the Armory.</div>
              )}
              {s.servers
                .filter((x) => x.active)
                .map((sv) => (
                  <div key={sv.id} className="glass w-[150px] shrink-0 p-3">
                    <img src={art(sv.image)} alt={sv.name} className="mx-auto h-20 w-20 object-contain" />
                    <p className="mt-2 truncate text-[13px] font-semibold">{sv.name}</p>
                    <p className="text-[11.5px] text-copy tabular">{fmtPubg(sv.dailyRate)} PUBG/day</p>
                    <p className="text-[11px] text-copy">{daysLeft(sv.expiresAt)}</p>
                  </div>
                ))}
            </div>
          </section>
        )}
      </StateGate>
      {s && <PaySheet item={pay} balance={s.me.balance} onClose={() => setPay(null)} />}
    </div>
  );
}

function formatLeft(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${Math.floor((ms % 60000) / 1000)}s`;
}
function daysLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.floor(ms / 3600000);
  return h >= 48 ? `${Math.floor(h / 24)} days left` : `${Math.max(h, 0)}h left`;
}
