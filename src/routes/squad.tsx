import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Crown, Send } from "lucide-react";
import { useSquad, useGameState } from "@/hooks/use-game";
import { Masthead, StateGate } from "@/components/game/Masthead";
import { GlassCard } from "@/components/game/GlassCard";
import { DotText } from "@/components/game/DotText";
import { RULES, fmtPubg } from "@/lib/game-rules";
import { openTgLink } from "@/lib/telegram-client";

export const Route = createFileRoute("/squad")({
  head: () => ({
    meta: [
      { title: "Squad — invite & earn | PUBG" },
      { name: "description", content: "Invite friends to PUBG and earn 20% of their mining plus 10% of their purchases." },
      { property: "og:title", content: "Squad — invite & earn | PUBG" },
      { property: "og:description", content: "Earn 20% of everything your squad mines, forever." },
    ],
  }),
  component: Squad,
});

function Squad() {
  const q = useSquad();
  const st = useGameState();
  const d = q.data;

  const share = () => {
    if (!d?.link) {
      toast("Invite link is being set up");
      return;
    }
    const text = "🪂 Drop into PUBG with me — mine $PUBG, open airdrop crates and cash out in GRAM!";
    openTgLink(`https://t.me/share/url?url=${encodeURIComponent(d.link)}&text=${encodeURIComponent(text)}`);
  };
  const copy = async () => {
    if (!d?.link) return;
    await navigator.clipboard.writeText(d.link).catch(() => {});
    toast.success("Invite link copied");
  };

  return (
    <div className="page">
      <Masthead lead="Build your" dots="SQUAD" line2="earn forever" intro="Your recruits mine — you earn. Rewards land automatically, no claim needed." />
      <StateGate isLoading={q.isLoading} error={q.error}>
        {d && (
          <>
            <GlassCard variant="context" video className="entrance">
              <div className="p-5">
                <p className="card__title text-[19px]">
                  Recruits
                  <br />
                  <span className="text-on-card-soft">in your squad</span>
                </p>
                <div className="mt-5" style={{ height: 42 }}>
                  <DotText text={String(d.refCount)} r={2.4} pitch={6} />
                </div>
                <p className="mt-3 text-[14px] text-on-card-soft tabular">Earned {fmtPubg(d.refEarned)} PUBG from your squad mining</p>
                <div className="mt-5 flex gap-2">
                  <button className="pill flex-1" onClick={share}>
                    <Send className="h-4 w-4" /> Invite friends
                  </button>
                  <button className="pill pill--ghost w-12 !px-0" onClick={copy} aria-label="Copy link">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </GlassCard>

            <div className="mt-[var(--gap)] grid grid-cols-3 gap-[var(--gap)]">
              {[
                { k: "Their mining", v: `${RULES.squadL1 * 100}%`, s: `+${RULES.squadL2 * 100}% level 2` },
                { k: "Their buys", v: `${RULES.purchaseL1 * 100}%`, s: `in GRAM · +${RULES.purchaseL2 * 100}% L2` },
                { k: "Per recruit", v: `+${RULES.inviteBonus}`, s: "PUBG instantly" },
              ].map((x) => (
                <div key={x.k} className="glass p-3">
                  <p className="eyebrow !text-[9.5px]">{x.k}</p>
                  <p className="mt-1 text-[20px] font-semibold tracking-tight text-dot">{x.v}</p>
                  <p className="text-[11px] text-copy">{x.s}</p>
                </div>
              ))}
            </div>

            <GlassCard variant="connections" className="entrance mt-[var(--gap)]">
              <div className="p-5">
                <p className="card__title text-[17px]">Free Squad Beacon server</p>
                <p className="text-[13px] text-on-card-soft">Invite {RULES.freeSquadServerGoal} friends to deploy it free for 60 days.</p>
                <div className="meter mt-3">
                  <span style={{ width: `${Math.min(1, d.refCount / RULES.freeSquadServerGoal) * 100}%` }} />
                </div>
                <p className="mt-1 text-right text-[12px] text-on-card-soft tabular">
                  {Math.min(d.refCount, RULES.freeSquadServerGoal)}/{RULES.freeSquadServerGoal}
                </p>
              </div>
            </GlassCard>

            <section className="mt-7">
              <h2 className="mb-3 text-[17px] font-semibold tracking-tight">This week’s top recruiters</h2>
              <div className="glass divide-y divide-border/60">
                {d.top.length === 0 && <p className="p-4 text-[13px] text-copy">No recruits yet this week — be the first on the board.</p>}
                {d.top.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 text-[13px] font-semibold text-copy tabular">{i + 1}</span>
                    {i === 0 && <Crown className="h-4 w-4 text-dot" />}
                    <span className="flex-1 truncate text-[14px] font-medium">
                      {t.name}
                      {t.me ? " (you)" : ""}
                    </span>
                    <span className="text-[13px] font-semibold tabular">{t.invites}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-7">
              <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Your recruits</h2>
              <div className="glass divide-y divide-border/60">
                {d.recruits.length === 0 && <p className="p-4 text-[13px] text-copy">Share your link — each friend who joins lands here.</p>}
                {d.recruits.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <span className="truncate text-[14px] font-medium">{r.name}</span>
                    <span className="text-[12px] text-copy tabular">mined {fmtPubg(r.mined, 0)} PUBG</span>
                  </div>
                ))}
              </div>
            </section>
            {st.data && <p className="mt-4 text-center text-[11px] text-copy">Squad ID r{st.data.me.id}</p>}
          </>
        )}
      </StateGate>
    </div>
  );
}
