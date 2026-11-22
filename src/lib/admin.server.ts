import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { adminRole, GameError, resolveUser, getConfig } from "./game.server";
import { enqueueBroadcast, enqueueGift, runTick } from "./jobs.server";
import { esc, tg } from "./telegram.server";

async function requireRole(initData: string, allowed: ("owner" | "tasks")[]) {
  const { user } = await resolveUser(initData);
  const role = await adminRole(user);
  if (!role || !allowed.includes(role)) throw new GameError("Access denied");
  return { user, role };
}

export async function adminMe(initData: string) {
  const { user } = await resolveUser(initData);
  return { role: await adminRole(user), username: user.username ?? null };
}

export async function adminOverview(initData: string) {
  await requireRole(initData, ["owner"]);
  const [stats, pays, wds, cfg, admins, jobs, posts] = await Promise.all([
    db.rpc("bg_admin_stats"),
    db.from("bg_payments").select("id, telegram_id, amount_nano, purpose, ref, status, created_at, confirmed_at, bg_players(first_name, username)").eq("status", "confirmed").order("confirmed_at", { ascending: false }).limit(25),
    db.from("bg_withdrawals").select("id, telegram_id, amount, wallet, status, created_at, bg_players(first_name, username, ref_count, ads_total)").in("status", ["pending"]).order("created_at").limit(50),
    getConfig(),
    db.from("bg_admins").select("username, role, telegram_id, created_at").order("created_at"),
    db.from("bg_jobs").select("key, sent, done, updated_at").order("updated_at", { ascending: false }).limit(8),
    db.from("bg_posts").select("slot, status, error, created_at").order("created_at", { ascending: false }).limit(6),
  ]);
  return {
    stats: stats.data as Record<string, number>,
    payments: (pays.data ?? []).map((p) => ({ ...p, amount: Number(p.amount_nano) / 1e9, player: p.bg_players as unknown as { first_name: string | null; username: string | null } | null })),
    withdrawals: (wds.data ?? []).map((w) => ({ ...w, amount: Number(w.amount), player: w.bg_players as unknown as { first_name: string | null; username: string | null; ref_count: number; ads_total: number } | null })),
    config: cfg,
    admins: admins.data ?? [],
    jobs: jobs.data ?? [],
    posts: posts.data ?? [],
  };
}

export async function adminListTasks(initData: string) {
  await requireRole(initData, ["owner", "tasks"]);
  const { data } = await db.from("bg_tasks").select("*").order("sort");
  return (data ?? []).map((t) => ({ ...t, reward: Number(t.reward) }));
}

export type TaskInput = {
  id?: string | undefined;
  title: string;
  description?: string | null | undefined;
  kind: "ads_daily" | "ads_total" | "referrals" | "channel" | "link" | "checkin";
  goal: number;
  reward: number;
  url?: string | null | undefined;
  chat_username?: string | null | undefined;
  icon: string;
  repeat: "once" | "daily";
  active: boolean;
  sort: number;
};

export async function adminSaveTask(initData: string, t: TaskInput) {
  const { user } = await requireRole(initData, ["owner", "tasks"]);
  const row = {
    title: t.title,
    description: t.description ?? null,
    kind: t.kind,
    goal: t.goal,
    reward: t.reward,
    url: t.url || null,
    chat_username: t.chat_username ? t.chat_username.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "") : null,
    icon: t.icon,
    repeat: t.repeat,
    active: t.active,
    sort: t.sort,
  };
  if (t.id) {
    const { error } = await db.from("bg_tasks").update(row).eq("id", t.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("bg_tasks").insert({ ...row, created_by: user.id });
    if (error) throw error;
  }
  return { ok: true };
}

export async function adminDeleteTask(initData: string, id: string) {
  await requireRole(initData, ["owner", "tasks"]);
  const { error } = await db.from("bg_tasks").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function adminSetManager(initData: string, username: string, add: boolean) {
  const { user } = await requireRole(initData, ["owner"]);
  const u = username.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9_]{4,32}$/.test(u)) throw new GameError("Invalid username");
  if (add) {
    const { data: existing } = await db.from("bg_admins").select("role").eq("username", u).maybeSingle();
    if (existing?.role === "owner") throw new GameError("Already an owner");
    const { data: pl } = await db.from("bg_players").select("telegram_id").ilike("username", u).maybeSingle();
    await db.from("bg_admins").upsert({ username: u, role: "tasks", added_by: user.username ?? String(user.id), telegram_id: pl?.telegram_id ?? null });
  } else {
    await db.from("bg_admins").delete().eq("username", u).eq("role", "tasks");
  }
  return { ok: true };
}

export async function adminProcessWithdrawal(initData: string, id: string, approve: boolean, note: string | null) {
  const { user } = await requireRole(initData, ["owner"]);
  const { data: w } = await db
    .from("bg_withdrawals")
    .update({ status: approve ? "paid" : "rejected", admin_note: note, processed_at: new Date().toISOString(), processed_by: user.id })
    .eq("id", id)
    .eq("status", "pending")
    .select("telegram_id, amount")
    .maybeSingle();
  if (!w) throw new GameError("Already processed");
  if (!approve) await db.rpc("bg_credit", { _tid: w.telegram_id, _amount: Number(w.amount), _reason: "withdraw_refund" });
  void tg("sendMessage", {
    chat_id: w.telegram_id,
    parse_mode: "HTML",
    text: approve
      ? `<b>✅ Withdrawal sent!</b>\n\n<b>${Number(w.amount)} GRAM</b> is on its way to your wallet.${note ? `\nTx: <code>${esc(note)}</code>` : ""}`
      : `<b>Withdrawal returned</b>\n\n<b>${Number(w.amount)} GRAM</b> was returned to your balance.${note ? `\nReason: ${esc(note)}` : ""}`,
  });
  return { ok: true };
}

export async function adminSetCommunity(initData: string, username: string) {
  await requireRole(initData, ["owner"]);
  const u = username.trim().replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "");
  if (u && !/^[A-Za-z0-9_]{4,32}$/.test(u)) throw new GameError("Invalid channel username");
  await db.from("bg_config").upsert({ key: "community", value: { username: u || null } });
  return { ok: true };
}

export async function adminSendGift(initData: string, amount: number) {
  await requireRole(initData, ["owner"]);
  return { key: await enqueueGift(amount) };
}

export async function adminBroadcast(initData: string, text: string) {
  await requireRole(initData, ["owner"]);
  return { key: await enqueueBroadcast(text) };
}

export async function adminRunTick(initData: string) {
  await requireRole(initData, ["owner"]);
  return runTick(18_000);
}
