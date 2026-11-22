import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { auth, errMsg, useReady } from "@/hooks/use-game";
import { DotText } from "@/components/game/DotText";
import { GlassCard } from "@/components/game/GlassCard";
import { Sheet } from "@/components/game/Sheet";
import {
  adminBroadcastFn,
  adminDeleteTaskFn,
  adminMeFn,
  adminOverviewFn,
  adminProcessWithdrawalFn,
  adminRunTickFn,
  adminSaveTaskFn,
  adminSendGiftFn,
  adminSetCommunityFn,
  adminSetManagerFn,
  adminTasksFn,
} from "@/lib/admin.functions";
import { fmtGram } from "@/lib/game-rules";

export const Route = createFileRoute("/101")({
  head: () => ({
    meta: [
      { title: "Command center — DROPZONE" },
      { name: "description", content: "DROPZONE admin command center." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Command center — DROPZONE" },
      { property: "og:description", content: "DROPZONE admin command center." },
    ],
  }),
  component: Admin,
});

type Tab = "overview" | "withdrawals" | "payments" | "tasks" | "team" | "broadcast";

function Admin() {
  const ready = useReady();
  const me = useQuery({ queryKey: ["admin-me"], queryFn: () => adminMeFn({ data: auth() }), enabled: ready });
  const role = me.data?.role;
  const [tab, setTab] = useState<Tab>("overview");
  const effective: Tab = role === "tasks" ? "tasks" : tab;

  if (me.isLoading || !ready) return <div className="page"><Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-dot" /></div>;
  if (!role)
    return (
      <div className="page">
        <div className="glass mx-auto mt-16 max-w-sm p-6 text-center">
          <p className="text-[16px] font-semibold">Restricted area</p>
          <p className="mt-1 text-[13px] text-copy">Open this page from Telegram with an admin account.</p>
        </div>
      </div>
    );

  const tabs: Tab[] = role === "owner" ? ["overview", "withdrawals", "payments", "tasks", "team", "broadcast"] : ["tasks"];
  return (
    <div className="page !pb-16">
      <header className="mb-5 flex items-end justify-between">
        <h1 className="headline !text-[30px]">
          <span className="headline__line">
            Command
            <span className="dot-word"><DotText text="101" /></span>
          </span>
        </h1>
        <span className="chip">@{me.data?.username} · {role === "owner" ? "Owner" : "Tasks"}</span>
      </header>
      {tabs.length > 1 && (
        <div className="no-scrollbar -mx-[var(--gutter)] mb-5 flex gap-2 overflow-x-auto px-[var(--gutter)]">
          {tabs.map((t) => (
            <button key={t} className="chip capitalize" data-on={effective === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      {effective === "tasks" ? <TasksAdmin /> : <OwnerPanel tab={effective} />}
    </div>
  );
}

function OwnerPanel({ tab }: { tab: Tab }) {
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => adminOverviewFn({ data: auth() }), refetchInterval: 30_000 });
  const d = q.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [community, setCommunity] = useState<string>("");
  const [gift, setGift] = useState("0.001");
  const [text, setText] = useState("");
  const [manager, setManager] = useState("");
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await q.refetch();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  if (q.isLoading || !d) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-dot" />;
  const s = d.stats;

  if (tab === "overview")
    return (
      <div className="space-y-[var(--gap)]">
        <div className="grid grid-cols-2 gap-[var(--gap)] md:grid-cols-4">
          <Stat v="speed" k="Players" n={s["players"]} sub={`+${s["new_today"]} today · ${s["active_today"]} active`} />
          <Stat v="context" k="Videos today" n={s["ads_today"]} sub={`${s["ads_total"]} all time`} />
          <Stat v="connections" k="Revenue today" n={s["revenue_today"]} dec sub={`${fmtGram(s["revenue_total"] ?? 0)} GRAM total · ${s["payers_today"]} payers`} />
          <Stat v="speed" k="Pending payouts" n={s["withdraw_pending_amount"]} dec sub={`${s["withdraw_pending"]} requests · ${fmtGram(s["withdrawn_total"] ?? 0)} paid`} />
        </div>
        <div className="glass grid grid-cols-2 gap-3 p-4 text-[13px]">
          <p>Bot subscribers: <b>{s["bot_users"]}</b></p>
          <p>Active servers: <b>{s["servers_active"]}</b></p>
          <p>Player balances: <b>{fmtGram(s["balances_total"] ?? 0)}</b></p>
          <p>Bot: <b>{d.config.botUsername ? `@${d.config.botUsername}` : "not connected"}</b></p>
        </div>
        <div className="glass p-4">
          <p className="text-[14px] font-semibold">Community channel</p>
          <p className="text-[12px] text-copy">Required to withdraw. Auto-posts go here. The bot must be an admin of the channel.</p>
          <div className="mt-2 flex gap-2">
            <input className="field" placeholder={d.config.community ? `@${d.config.community}` : "@yourchannel"} value={community} onChange={(e) => setCommunity(e.target.value)} />
            <button className="pill pill--dot !h-12" disabled={busy === "c"} onClick={() => run("c", () => adminSetCommunityFn({ data: { ...auth(), username: community } }), "Community saved")}>Save</button>
          </div>
        </div>
        <div className="glass p-4">
          <p className="text-[14px] font-semibold">Scheduler</p>
          <div className="mt-2 space-y-1 text-[12px] text-copy">
            {d.jobs.map((j) => <p key={j.key}>{j.key} · {j.sent} sent · {j.done ? "done" : "running"}</p>)}
            {d.posts.map((p) => <p key={p.slot}>{p.slot} · {p.status}{p.error ? ` · ${p.error}` : ""}</p>)}
          </div>
          <button className="pill pill--ink pill--sm mt-3" disabled={busy === "t"} onClick={() => run("t", () => adminRunTickFn({ data: auth() }), "Scheduler ran")}>
            {busy === "t" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Run now
          </button>
        </div>
      </div>
    );

  if (tab === "withdrawals")
    return (
      <div className="space-y-2">
        {d.withdrawals.length === 0 && <p className="glass p-4 text-[13px] text-copy">No pending withdrawals.</p>}
        {d.withdrawals.map((w) => (
          <div key={w.id} className="glass p-4">
            <div className="flex justify-between">
              <p className="text-[15px] font-semibold tabular">{fmtGram(w.amount)} GRAM</p>
              <p className="text-[12px] text-copy">{new Date(w.created_at).toLocaleString()}</p>
            </div>
            <p className="text-[13px]">{w.player?.first_name} {w.player?.username ? `@${w.player.username}` : ""} · <code>{w.telegram_id}</code></p>
            <p className="text-[12px] text-copy">invites {w.player?.ref_count} · videos {w.player?.ads_total}</p>
            <p className="mt-1 break-all rounded-lg bg-muted px-2 py-1 font-mono text-[11.5px]">{w.wallet}</p>
            <div className="mt-3 flex gap-2">
              <button className="pill pill--dot pill--sm flex-1" disabled={!!busy} onClick={() => run(w.id, () => adminProcessWithdrawalFn({ data: { ...auth(), id: w.id, approve: true, note: prompt("Transaction hash (optional)") || null } }), "Marked as paid")}>Mark paid</button>
              <button className="pill pill--sm flex-1" disabled={!!busy} onClick={() => run(w.id, () => adminProcessWithdrawalFn({ data: { ...auth(), id: w.id, approve: false, note: prompt("Reason (optional)") || null } }), "Returned to balance")}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    );

  if (tab === "payments")
    return (
      <div className="glass divide-y divide-border/60">
        {d.payments.length === 0 && <p className="p-4 text-[13px] text-copy">No payments yet.</p>}
        {d.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[13.5px] font-medium">{p.player?.first_name ?? p.telegram_id} {p.player?.username ? `@${p.player.username}` : ""}</p>
              <p className="text-[11.5px] text-copy">{p.purpose} {p.ref} · {p.confirmed_at ? new Date(p.confirmed_at).toLocaleString() : ""}</p>
            </div>
            <span className="text-[14px] font-semibold tabular text-success">+{fmtGram(p.amount)}</span>
          </div>
        ))}
      </div>
    );

  if (tab === "team")
    return (
      <div className="space-y-3">
        <div className="glass p-4">
          <p className="text-[14px] font-semibold">Add task manager</p>
          <p className="text-[12px] text-copy">They can only add, edit and delete missions. No other data is visible to them.</p>
          <div className="mt-2 flex gap-2">
            <input className="field" placeholder="@username" value={manager} onChange={(e) => setManager(e.target.value)} />
            <button className="pill pill--dot !h-12" disabled={busy === "m"} onClick={() => run("m", () => adminSetManagerFn({ data: { ...auth(), username: manager, add: true } }), "Manager added").then(() => setManager(""))}>Add</button>
          </div>
        </div>
        <div className="glass divide-y divide-border/60">
          {d.admins.map((a) => (
            <div key={a.username} className="flex items-center justify-between px-4 py-3">
              <p className="text-[14px] font-medium">@{a.username} <span className="text-[12px] text-copy">· {a.role === "owner" ? "Owner" : "Tasks"}{a.telegram_id ? "" : " · not opened yet"}</span></p>
              {a.role === "tasks" && (
                <button className="pill pill--sm" onClick={() => run(a.username, () => adminSetManagerFn({ data: { ...auth(), username: a.username, add: false } }), "Removed")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="glass p-4">
        <p className="text-[14px] font-semibold">Send a gift to everyone</p>
        <p className="text-[12px] text-copy">Each user gets a chat message with a Claim button that credits them instantly.</p>
        <div className="mt-2 flex gap-2">
          <input className="field tabular" inputMode="decimal" value={gift} onChange={(e) => setGift(e.target.value)} />
          <button className="pill pill--dot !h-12" disabled={busy === "g"} onClick={() => run("g", () => adminSendGiftFn({ data: { ...auth(), amount: Number(gift) } }), "Gift queued")}>Send</button>
        </div>
      </div>
      <div className="glass p-4">
        <p className="text-[14px] font-semibold">Broadcast message</p>
        <p className="text-[12px] text-copy">Supports &lt;b&gt;bold&lt;/b&gt;. A Play button is added automatically.</p>
        <textarea className="field mt-2 !h-32 py-3" value={text} onChange={(e) => setText(e.target.value)} placeholder="<b>New season is live!</b>" />
        <button className="pill pill--dot mt-2 w-full" disabled={busy === "b" || text.length < 3} onClick={() => run("b", () => adminBroadcastFn({ data: { ...auth(), text } }), "Broadcast queued").then(() => setText(""))}>Queue broadcast</button>
      </div>
    </div>
  );
}

function Stat({ v, k, n, sub, dec }: { v: "speed" | "context" | "connections"; k: string; n: number | undefined; sub: string; dec?: boolean }) {
  return (
    <GlassCard variant={v}>
      <div className="p-4">
        <p className="text-[12.5px] text-on-card-soft">{k}</p>
        <div className="mt-3" style={{ height: 26 }}>
          <DotText text={dec ? Number(n ?? 0).toFixed(2) : String(n ?? 0)} r={1.9} pitch={4.8} />
        </div>
        <p className="mt-2 text-[11.5px] text-on-card-soft">{sub}</p>
      </div>
    </GlassCard>
  );
}

type TaskRow = Awaited<ReturnType<typeof adminTasksFn>>[number];
type Kind = "ads_daily" | "ads_total" | "referrals" | "channel" | "link" | "checkin";
const EMPTY: { title: string; description: string; kind: Kind; goal: number; reward: number; url: string; chat_username: string; icon: string; repeat: "once" | "daily"; active: boolean; sort: number } = { title: "", description: "", kind: "channel", goal: 1, reward: 0.001, url: "", chat_username: "", icon: "users", repeat: "once", active: true, sort: 100 };

function TasksAdmin() {
  const q = useQuery({ queryKey: ["admin-tasks"], queryFn: () => adminTasksFn({ data: auth() }) });
  const [edit, setEdit] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await adminSaveTaskFn({ data: { ...auth(), task: { ...edit, goal: Number(edit.goal), reward: Number(edit.reward), sort: Number(edit.sort) } } });
      toast.success("Mission saved");
      setEdit(null);
      await q.refetch();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  const del = async (t: TaskRow) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try {
      await adminDeleteTaskFn({ data: { ...auth(), id: t.id } });
      toast.success("Deleted");
      await q.refetch();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <button className="pill pill--dot mb-3 w-full" onClick={() => setEdit({ ...EMPTY })}>
        <Plus className="h-4 w-4" /> New mission
      </button>
      <div className="glass divide-y divide-border/60">
        {(q.data ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[14px] font-medium ${t.active ? "" : "text-copy line-through"}`}>{t.title}</p>
              <p className="truncate text-[11.5px] text-copy">{t.kind} · goal {t.goal} · +{t.reward} · {t.repeat}</p>
            </div>
            <button className="pill pill--sm" onClick={() => setEdit({ ...EMPTY, ...t, description: t.description ?? "", url: t.url ?? "", chat_username: t.chat_username ?? "", kind: t.kind as typeof EMPTY.kind, repeat: t.repeat as typeof EMPTY.repeat })}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button className="pill pill--sm" onClick={() => del(t)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Edit mission" : "New mission"}>
        {edit && (
          <div className="space-y-2">
            <input className="field" placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <input className="field" placeholder="Short description" value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="field" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as typeof EMPTY.kind })}>
                <option value="channel">Join channel</option>
                <option value="link">Open link</option>
                <option value="ads_daily">Videos today</option>
                <option value="ads_total">Videos total</option>
                <option value="referrals">Invites</option>
                <option value="checkin">Daily check-in</option>
              </select>
              <select className="field" value={edit.repeat} onChange={(e) => setEdit({ ...edit, repeat: e.target.value as typeof EMPTY.repeat })}>
                <option value="once">Once</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[11px] text-copy">Goal<input className="field" inputMode="numeric" value={edit.goal} onChange={(e) => setEdit({ ...edit, goal: Number(e.target.value) || 1 })} /></label>
              <label className="text-[11px] text-copy">Reward<input className="field" inputMode="decimal" value={edit.reward} onChange={(e) => setEdit({ ...edit, reward: e.target.value as unknown as number })} /></label>
              <label className="text-[11px] text-copy">Order<input className="field" inputMode="numeric" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) || 0 })} /></label>
            </div>
            {edit.kind === "channel" && <input className="field" placeholder="@channel (bot must be admin)" value={edit.chat_username ?? ""} onChange={(e) => setEdit({ ...edit, chat_username: e.target.value })} />}
            {(edit.kind === "link" || edit.kind === "channel") && <input className="field" placeholder="https://… link to open" value={edit.url ?? ""} onChange={(e) => setEdit({ ...edit, url: e.target.value })} />}
            <select className="field" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })}>
              {["users", "link", "play", "flame", "trophy", "crown", "star", "calendar", "target"].map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active
            </label>
            <button className="pill pill--dot w-full" disabled={saving || edit.title.length < 2} onClick={save}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save mission
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
