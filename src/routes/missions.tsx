import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Check, Crown, ExternalLink, Flame, Link2, Loader2, Play, Star, Target, Trophy, Users } from "@/components/game/GlassIcons";
import { useMissions, useGameState, auth, errMsg, useRefresh } from "@/hooks/use-game";
import { Masthead, StateGate } from "@/components/game/Masthead";
import { GlassCard } from "@/components/game/GlassCard";
import { DotText } from "@/components/game/DotText";
import { useAdAction } from "@/components/game/useAdAction";
import { claimTaskFn } from "@/lib/game.functions";
import { RULES, fmtPubg } from "@/lib/game-rules";
import { haptic, openTgLink } from "@/lib/telegram-client";

export const Route = createFileRoute("/missions")({
  head: () => ({
    meta: [
      { title: "Missions — PUBG" },
      { name: "description", content: "Daily video ladder, invite missions and check-in streaks that pay $PUBG." },
      { property: "og:title", content: "Missions — PUBG" },
      { property: "og:description", content: "Climb the 1000-video ladder and invite missions for $PUBG rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Missions,
});

const ICONS = { calendar: Calendar, play: Play, flame: Flame, trophy: Trophy, crown: Crown, star: Star, users: Users, link: Link2, target: Target } as const;

type Mission = NonNullable<ReturnType<typeof useMissions>["data"]>[number];

function Missions() {
  const m = useMissions();
  const st = useGameState();
  const ad = useAdAction();
  const refresh = useRefresh();
  const [busy, setBusy] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const list = m.data ?? [];
  const daily = list.filter((t) => t.kind === "checkin" || t.kind === "ads_daily");
  const invites = list.filter((t) => t.kind === "referrals");
  const veteran = list.filter((t) => t.kind === "ads_total");
  const social = list.filter((t) => t.kind === "channel" || t.kind === "link");
  const adsToday = st.data?.me.adsToday ?? 0;
  const next = list.filter((t) => t.kind === "ads_daily" && t.progress < t.goal).sort((a, b) => a.goal - b.goal)[0];

  const claim = async (t: Mission) => {
    setBusy(t.id);
    try {
      const r = await claimTaskFn({ data: { ...auth(), taskId: t.id } });
      haptic("success");
      toast.success(`+${fmtPubg(r.reward)} PUBG`, { description: t.title });
      await refresh("missions", "state", "wallet");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const action = (t: Mission) => {
    if (t.claimed) return <span className="pill pill--sm !bg-transparent !shadow-none text-success"><Check className="h-4 w-4" /> Done</span>;
    const complete = t.kind === "checkin" || t.progress >= t.goal || ((t.kind === "link" || t.kind === "channel") && opened[t.id]);
    if ((t.kind === "link" || t.kind === "channel") && !opened[t.id])
      return (
        <button
          className="pill pill--ink pill--sm"
          onClick={() => {
            openTgLink(t.url ?? (t.chat ? `https://t.me/${t.chat}` : "https://t.me"));
            setTimeout(() => setOpened((o) => ({ ...o, [t.id]: true })), 2500);
          }}
        >
          Go <ExternalLink className="h-3.5 w-3.5" />
        </button>
      );
    if (t.kind === "referrals" && !complete)
      return (
        <Link to="/squad" className="pill pill--ink pill--sm">
          Invite
        </Link>
      );
    if (t.kind === "ads_daily" && !complete)
      return (
        <button className="pill pill--ink pill--sm" disabled={ad.busy} onClick={() => ad.watch()}>
          <Play className="h-3.5 w-3.5" /> Watch
        </button>
      );
    return (
      <button className="pill pill--dot pill--sm" disabled={!complete || busy === t.id} onClick={() => claim(t)}>
        {busy === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Claim
      </button>
    );
  };

  return (
    <div className="page">
      <Masthead lead="Daily" dots="1000" line2="video challenge" intro="Every video drops instant PUBG and 10 minutes of 2x mining. Climb the ladder before midnight UTC." />
      <StateGate isLoading={m.isLoading} error={m.error}>
        <GlassCard variant="speed" video className="entrance">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <p className="card__title text-[19px]">
                Videos watched
                <br />
                <span className="text-on-card-soft">today</span>
              </p>
              <span className="tag">+{RULES.adReward} each</span>
            </div>
            <div className="mt-5" style={{ height: 40 }}>
              <DotText text={String(adsToday)} r={2.4} pitch={6} />
            </div>
            {next && (
              <>
                <div className="mt-4 mb-1 flex justify-between text-[12.5px] text-on-card-soft">
                  <span>Next: {next.title} · +{fmtPubg(next.reward)} PUBG</span>
                  <span className="tabular">
                    {adsToday}/{next.goal}
                  </span>
                </div>
                <div className="meter">
                  <span style={{ width: `${(adsToday / next.goal) * 100}%` }} />
                </div>
              </>
            )}
            <button className="pill mt-5 w-full" disabled={ad.busy} onClick={() => ad.watch()}>
              {ad.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Watch video
            </button>
          </div>
        </GlassCard>

        <Section title="Daily ladder" items={daily} action={action} />
        <Section title="Invite missions" items={invites} action={action} />
        <Section title="Veteran" items={veteran} action={action} />
        {social.length > 0 && <Section title="Community" items={social} action={action} />}
      </StateGate>
    </div>
  );
}

function Section({ title, items, action }: { title: string; items: Mission[]; action: (t: Mission) => React.ReactNode }) {
  if (!items.length) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-[17px] font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2">
        {items.map((t) => {
          const Icon = ICONS[t.icon as keyof typeof ICONS] ?? Target;
          const showBar = ["ads_daily", "ads_total", "referrals"].includes(t.kind);
          return (
            <div key={t.id} className="glass flex items-center gap-3 p-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center text-dot">
                <Icon className="h-10 w-10" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{t.title}</p>
                <p className="truncate text-[12px] text-copy">
                  +{fmtPubg(t.reward)} PUBG{t.kind === "checkin" ? " × streak" : ""} · {t.description}
                </p>
                {showBar && !t.claimed && (
                  <div className="meter meter--paper mt-1.5">
                    <span style={{ width: `${(t.progress / t.goal) * 100}%` }} />
                  </div>
                )}
              </div>
              {action(t)}
            </div>
          );
        })}
      </div>
    </section>
  );
}
