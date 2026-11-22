import { beginCell, Address } from "@ton/core";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { PUBG_JETTON, RULES, TREASURY_ADDRESS, adsServerProgress, checkWithdraw, quoteSwap, squadServerReady, toNano, withdrawMin, type Currency } from "./game-rules";
import { botToken, esc, kb, tg, verifyInitData, type TgUser } from "./telegram.server";

export const DEMO_ID = 100000001;
const n = (v: unknown) => Number(v ?? 0);
const today = () => new Date().toISOString().slice(0, 10);

export class GameError extends Error {}
const fail = (msg: string): never => {
  throw new GameError(msg);
};

// ---------- identity ----------

export async function resolveUser(initData: string): Promise<{ user: TgUser; startParam: string | null }> {
  const token = botToken();
  if (initData && token) {
    const v = verifyInitData(initData, token);
    if (!v) fail("Session expired. Reopen PUBG from Telegram.");
    return { user: v!.user, startParam: v!.startParam };
  }
  if (import.meta.env.DEV && !initData) {
    return { user: { id: DEMO_ID, first_name: "Demo", username: "demo_player" }, startParam: null };
  }
  if (!token) fail("The game is being set up. Please try again soon.");
  return fail("Open PUBG inside Telegram.");
}

export type Player = Awaited<ReturnType<typeof loadPlayer>>;
async function loadPlayer(id: number) {
  const { data, error } = await db.from("bg_players").select("*").eq("telegram_id", id).maybeSingle();
  if (error) throw error;
  return data;
}

function parseRef(startParam: string | null | undefined, selfId: number) {
  const m = /^r(\d{3,15})$/.exec(startParam ?? "");
  const id = m ? Number(m[1]) : null;
  return id && id !== selfId ? id : null;
}

export async function ensurePlayer(user: TgUser, startParam: string | null, opts: { fromBot?: boolean } = {}) {
  let p = await loadPlayer(user.id);
  let isNew = false;
  if (!p) {
    const refId = parseRef(startParam, user.id);
    const referrer = refId ? await loadPlayer(refId) : null;
    const { error } = await db.from("bg_players").insert({
      telegram_id: user.id,
      username: user.username ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      photo_url: user.photo_url ?? null,
      language_code: user.language_code ?? null,
      is_premium: !!user.is_premium,
      referrer_id: referrer?.telegram_id ?? null,
      referrer2_id: referrer?.referrer_id ?? null,
      started_bot: !!opts.fromBot,
      last_seen_at: new Date().toISOString(),
    });
    if (error && !String(error.message).includes("duplicate")) throw error;
    if (!error) {
      isNew = true;
      await db.from("bg_owned_servers").insert({
        telegram_id: user.id,
        server_id: 3,
        source: "trial",
        expires_at: new Date(Date.now() + 86400_000).toISOString(),
      });
      await db.from("bg_owned_operators").insert({ telegram_id: user.id, operator_id: "rookie" });
      if (referrer) {
        await db
          .from("bg_players")
          .update({ ref_count: referrer.ref_count + 1 })
          .eq("telegram_id", referrer.telegram_id);
        await db.rpc("bg_credit", {
          _tid: referrer.telegram_id,
          _amount: RULES.inviteBonus,
          _reason: "invite_bonus",
          _meta: { from: user.id },
        });
        void tg("sendMessage", {
          chat_id: referrer.telegram_id,
          parse_mode: "HTML",
          text: `<b>🪂 New recruit landed!</b>\n\n<b>${esc(user.first_name ?? "A friend")}</b> joined your squad.\n<b>+${RULES.inviteBonus} PUBG</b> added — and you earn <b>20%</b> of everything they mine. 🔥`,
        });
      }
    }
    p = await loadPlayer(user.id);
  } else {
    const patch = {
      username: user.username ?? p.username,
      first_name: user.first_name ?? p.first_name,
      photo_url: user.photo_url ?? p.photo_url,
      last_seen_at: new Date().toISOString(),
      ...(opts.fromBot ? { started_bot: true, bot_blocked: false } : {}),
    };
    await db.from("bg_players").update(patch).eq("telegram_id", user.id);
  }
  if (user.username) {
    await db
      .from("bg_admins")
      .update({ telegram_id: user.id })
      .eq("username", user.username.toLowerCase())
      .is("telegram_id", null);
  }
  return { player: p!, isNew };
}

export async function authPlayer(initData: string) {
  const { user, startParam } = await resolveUser(initData);
  const { player } = await ensurePlayer(user, startParam);
  return { user, player };
}

export async function adminRole(user: TgUser): Promise<"owner" | "tasks" | null> {
  if (!user.username) return null;
  const { data } = await db.from("bg_admins").select("role").eq("username", user.username.toLowerCase()).maybeSingle();
  return (data?.role as "owner" | "tasks" | undefined) ?? null;
}

// ---------- config ----------

export async function getConfig() {
  const { data } = await db.from("bg_config").select("key,value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
  let botUsername = (map["bot"]?.["username"] as string | null) ?? null;
  if (!botUsername && botToken()) {
    const me = await tg<{ username: string }>("getMe", {});
    if (me.ok && me.result?.username) {
      botUsername = me.result.username;
      await db.from("bg_config").upsert({ key: "bot", value: { username: botUsername } });
    }
  }
  const community = (map["community"]?.["username"] as string | null) ?? null;
  return { botUsername, community };
}

// ---------- market ----------

type Market = { pubg_per_gram: number; swap_fee: number; pubg_usd?: number; gram_usd?: number; updated_at?: string };

async function stonPrice(addr: string) {
  try {
    const r = await fetch(`https://api.ston.fi/v1/assets/${addr}`);
    const j = (await r.json()) as { asset?: { dex_price_usd?: string } };
    const v = Number(j.asset?.dex_price_usd);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export async function getMarket(): Promise<Market> {
  const { data } = await db.from("bg_config").select("value").eq("key", "market").maybeSingle();
  const m = (data?.value ?? { pubg_per_gram: 11000, swap_fee: RULES.swapFee }) as Market;
  const age = m.updated_at ? Date.now() - new Date(m.updated_at).getTime() : Infinity;
  if (age > 10 * 60_000) {
    const [pubg, gram] = await Promise.all([stonPrice(PUBG_JETTON), stonPrice("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c")]);
    if (pubg && gram) {
      const next: Market = { ...m, pubg_usd: pubg, gram_usd: gram, pubg_per_gram: Math.round(gram / pubg), updated_at: new Date().toISOString() };
      await db.from("bg_config").upsert({ key: "market", value: next as never });
      return next;
    }
  }
  return m;
}

export async function swapPubg(initData: string, pubg: number) {
  const { player: p } = await authPlayer(initData);
  if (!(pubg >= RULES.swapMinPubg)) fail(`Minimum swap is ${RULES.swapMinPubg} PUBG`);
  if (n(p.balance) < pubg) fail("Not enough PUBG");
  const m = await getMarket();
  const gram = quoteSwap(pubg, m.pubg_per_gram, m.swap_fee ?? RULES.swapFee);
  if (gram <= 0) fail("Amount too small");
  const { error } = await db.rpc("bg_swap", { _tid: p.telegram_id, _pubg: pubg, _gram: gram });
  if (error) fail("Not enough PUBG");
  return { gram, pubg };
}

// ---------- mining ----------

async function ownedServers(id: number) {
  const { data } = await db
    .from("bg_owned_servers")
    .select("id, server_id, source, acquired_at, expires_at, bg_servers(name, image, daily_rate, rarity, tier, level)")
    .eq("telegram_id", id)
    .order("acquired_at", { ascending: false });
  return (data ?? []).map((r) => {
    const s = r.bg_servers as unknown as { name: string; image: string; daily_rate: number; rarity: string; tier: number; level: number };
    return {
      id: r.id,
      serverId: r.server_id,
      source: r.source,
      acquiredAt: r.acquired_at,
      expiresAt: r.expires_at,
      name: s.name,
      image: s.image,
      rarity: s.rarity,
      tier: s.tier,
      level: s.level,
      dailyRate: n(s.daily_rate),
      active: new Date(r.expires_at).getTime() > Date.now(),
    };
  });
}

export async function getState(initData: string) {
  const { user, player: p } = await authPlayer(initData);
  const [servers, cfg, pendingRes, opRes, role, market] = await Promise.all([
    ownedServers(p.telegram_id),
    getConfig(),
    db.rpc("bg_pending", { _tid: p.telegram_id, _cap_hours: RULES.storageHours }),
    db.from("bg_operators").select("boost_pct, name, image").eq("id", p.operator_id).maybeSingle(),
    adminRole(user),
    getMarket(),
  ]);
  const active = servers.filter((s) => s.active);
  const baseRate = active.reduce((a, s) => a + s.dailyRate, 0);
  const boosted = !!p.boost_until && new Date(p.boost_until).getTime() > Date.now();
  const opBoost = n(opRes.data?.boost_pct);
  const mult = (1 + opBoost / 100) * (boosted ? 2 : 1);
  const adsClaims = servers.filter((s) => s.source === "ads").length;
  const squadClaimed = servers.some((s) => s.source === "referrals");
  const ads = adsServerProgress(p.ads_total, adsClaims);
  return {
    now: new Date().toISOString(),
    me: {
      id: p.telegram_id,
      name: p.first_name ?? "Soldier",
      username: p.username,
      photo: p.photo_url,
      balance: n(p.balance),
      gram: n(p.gram_balance),
      totalMined: n(p.total_mined),
      refCount: p.ref_count,
      refEarned: n(p.total_ref_earned),
      adsToday: p.ads_day === today() ? p.ads_today : 0,
      adsTotal: p.ads_total,
      boostUntil: p.boost_until,
      operatorId: p.operator_id,
      operatorName: opRes.data?.name ?? "Rookie",
      operatorImage: opRes.data?.image ?? "op-rookie",
      operatorBoost: opBoost,
      wallet: p.wallet_address,
      joinedCommunity: p.joined_channel,
      lastClaimAt: p.last_claim_at,
      streak: p.streak,
      checkedInToday: p.last_checkin === today(),
    },
    mining: {
      pending: n(pendingRes.data),
      baseRate,
      ratePerDay: baseRate * mult,
      multiplier: mult,
      boosted,
      capHours: RULES.storageHours,
      activeCount: active.length,
    },
    servers,
    freeServers: {
      ads: { ...ads, goal: RULES.freeAdsServerGoal, claims: adsClaims },
      squad: { ready: squadServerReady(p.ref_count, squadClaimed), claimed: squadClaimed, goal: RULES.freeSquadServerGoal, progress: Math.min(p.ref_count, RULES.freeSquadServerGoal) },
    },
    config: cfg,
    market: { pubgPerGram: market.pubg_per_gram, pubgUsd: market.pubg_usd ?? null, gramUsd: market.gram_usd ?? null, swapFee: market.swap_fee ?? RULES.swapFee },
    role,
  };
}

export async function claimMining(initData: string, double: boolean) {
  const { player: p } = await authPlayer(initData);
  let bonus = 1;
  if (double) {
    const adAt = p.ad_last_at ? new Date(p.ad_last_at).getTime() : 0;
    if (Date.now() - adAt < 120_000 && adAt > new Date(p.last_claim_at).getTime()) bonus = 2;
  }
  const { data, error } = await db.rpc("bg_claim", { _tid: p.telegram_id, _bonus: bonus });
  if (error) throw error;
  return { amount: n(data), doubled: bonus === 2 };
}

export async function recordAd(initData: string) {
  const { player: p } = await authPlayer(initData);
  const { data, error } = await db.rpc("bg_record_ad", {
    _tid: p.telegram_id,
    _reward: RULES.adReward,
    _boost_minutes: RULES.adBoostMinutes,
    _min_gap_seconds: RULES.adMinGapSeconds,
    _daily_cap: RULES.adDailyCap,
  });
  if (error) throw error;
  const r = data as { ok: boolean; error?: string; ads_today?: number; ads_total?: number };
  if (!r.ok) {
    return { ok: false as const, error: r.error === "daily_cap" ? "Daily video limit reached. Back tomorrow!" : "Slow down — wait a few seconds between videos." };
  }
  if (r.ads_today === 10 && p.referrer_id) {
    void db.rpc("bg_credit", { _tid: p.referrer_id, _amount: RULES.recruitActiveBonus, _reason: "recruit_active", _meta: { from: p.telegram_id } });
  }
  return { ok: true as const, adsToday: r.ads_today ?? 0, adsTotal: r.ads_total ?? 0, reward: RULES.adReward };
}

// ---------- catalog ----------

export async function getCatalog(initData: string) {
  const { player: p } = await authPlayer(initData);
  const [s, o, owned] = await Promise.all([
    db.from("bg_servers").select("*").eq("active", true).neq("unlock", "trial").order("sort"),
    db.from("bg_operators").select("*").order("sort"),
    db.from("bg_owned_operators").select("operator_id").eq("telegram_id", p.telegram_id),
  ]);
  const ownedIds = new Set((owned.data ?? []).map((r) => r.operator_id));
  return {
    servers: (s.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      image: r.image,
      tier: r.tier,
      level: r.level,
      rarity: r.rarity,
      price: n(r.price),
      dailyRate: n(r.daily_rate),
      durationDays: r.duration_days,
      unlock: r.unlock,
      unlockGoal: r.unlock_goal,
    })),
    operators: (o.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      image: r.image,
      rarity: r.rarity,
      boostPct: r.boost_pct,
      price: n(r.price),
      unlockAds: r.unlock_ads,
      owned: ownedIds.has(r.id),
      equipped: p.operator_id === r.id,
    })),
    adsTotal: p.ads_total,
    balance: n(p.gram_balance),
  };
}

async function grantServer(tid: number, serverId: number, source: string) {
  const { data: s } = await db.from("bg_servers").select("duration_days,name").eq("id", serverId).single();
  if (!s) fail("Server not found");
  await db.from("bg_owned_servers").insert({
    telegram_id: tid,
    server_id: serverId,
    source,
    expires_at: new Date(Date.now() + s!.duration_days * 86400_000).toISOString(),
  });
  return s!.name;
}

async function payUplineForPurchase(p: NonNullable<Player>, amount: number) {
  if (p.referrer_id) {
    await db.rpc("bg_credit_gram", { _tid: p.referrer_id, _amount: +(amount * RULES.purchaseL1).toFixed(9), _reason: "squad_purchase_l1", _meta: { from: p.telegram_id } });
  }
  if (p.referrer2_id) {
    await db.rpc("bg_credit_gram", { _tid: p.referrer2_id, _amount: +(amount * RULES.purchaseL2).toFixed(9), _reason: "squad_purchase_l2", _meta: { from: p.telegram_id } });
  }
}

export async function buyWithBalance(initData: string, kind: "server" | "operator", ref: string) {
  const { player: p } = await authPlayer(initData);
  const price = await itemPrice(kind, ref);
  if (n(p.gram_balance) < price) fail("Not enough GRAM — swap some PUBG first");
  const { error } = await db.rpc("bg_credit_gram", { _tid: p.telegram_id, _amount: -price, _reason: `buy_${kind}`, _meta: { ref } });
  if (error) fail("Not enough GRAM — swap some PUBG first");
  await db.from("bg_players").update({ total_spent: n(p.total_spent) + price }).eq("telegram_id", p.telegram_id);
  const name = await fulfillItem(p, kind, ref);
  await payUplineForPurchase(p, price);
  return { ok: true, name };
}

async function itemPrice(kind: "server" | "operator" | "boost", ref: string) {
  if (kind === "boost") return RULES.battlePassPrice;
  if (kind === "server") {
    const { data } = await db.from("bg_servers").select("price,unlock,active").eq("id", Number(ref)).maybeSingle();
    if (!data || data.unlock !== "gram" || !data.active) fail("This server can't be bought");
    return n(data!.price);
  }
  const { data } = await db.from("bg_operators").select("price").eq("id", ref).maybeSingle();
  if (!data || n(data.price) <= 0) fail("This operator can't be bought");
  return n(data!.price);
}

async function fulfillItem(p: NonNullable<Player>, kind: "server" | "operator" | "boost", ref: string) {
  if (kind === "server") return grantServer(p.telegram_id, Number(ref), "gram");
  if (kind === "operator") {
    await db.from("bg_owned_operators").upsert({ telegram_id: p.telegram_id, operator_id: ref });
    await db.from("bg_players").update({ operator_id: ref }).eq("telegram_id", p.telegram_id);
    return ref;
  }
  const cur = p.boost_until && new Date(p.boost_until).getTime() > Date.now() ? new Date(p.boost_until).getTime() : Date.now();
  await db.from("bg_players").update({ boost_until: new Date(cur + 86400_000).toISOString() }).eq("telegram_id", p.telegram_id);
  return "Battle Pass";
}

export async function claimFreeServer(initData: string, kind: "ads" | "squad") {
  const { player: p } = await authPlayer(initData);
  const servers = await ownedServers(p.telegram_id);
  if (kind === "ads") {
    const claims = servers.filter((s) => s.source === "ads").length;
    if (!adsServerProgress(p.ads_total, claims).ready) fail(`Watch ${RULES.freeAdsServerGoal} videos to unlock`);
    return { name: await grantServer(p.telegram_id, 1, "ads") };
  }
  const claimed = servers.some((s) => s.source === "referrals");
  if (!squadServerReady(p.ref_count, claimed)) fail(`Invite ${RULES.freeSquadServerGoal} friends to unlock`);
  return { name: await grantServer(p.telegram_id, 2, "referrals") };
}

export async function equipOperator(initData: string, id: string) {
  const { player: p } = await authPlayer(initData);
  const { data: op } = await db.from("bg_operators").select("*").eq("id", id).maybeSingle();
  if (!op) fail("Operator not found");
  const { data: owned } = await db.from("bg_owned_operators").select("operator_id").eq("telegram_id", p.telegram_id).eq("operator_id", id).maybeSingle();
  if (!owned) {
    if (op!.unlock_ads > 0 && p.ads_total >= op!.unlock_ads) {
      await db.from("bg_owned_operators").insert({ telegram_id: p.telegram_id, operator_id: id });
    } else fail("Unlock this operator first");
  }
  await db.from("bg_players").update({ operator_id: id }).eq("telegram_id", p.telegram_id);
  return { ok: true };
}

// ---------- payments ----------

export async function createPayment(initData: string, purpose: "server" | "operator" | "boost", ref: string) {
  const { player: p } = await authPlayer(initData);
  const price = await itemPrice(purpose, ref);
  return insertPayment(p.telegram_id, purpose, ref, price);
}

async function insertPayment(tid: number, purpose: "server" | "operator" | "boost" | "withdraw_fee", ref: string, amount: number) {
  const memo = `dz:${crypto.randomUUID()}`;
  const amountNano = toNano(amount);
  const { data, error } = await db
    .from("bg_payments")
    .insert({ telegram_id: tid, memo, amount_nano: Number(amountNano), purpose, ref })
    .select("id")
    .single();
  if (error) throw error;
  const payload = beginCell().storeUint(0, 32).storeStringTail(memo).endCell().toBoc().toString("base64");
  return { paymentId: data.id, address: TREASURY_ADDRESS, amountNano: amountNano.toString(), amount, payload, memo };
}

type TonTx = {
  transaction_id?: { hash?: string };
  in_msg?: { value?: string; message?: string; source?: string; msg_data?: { text?: string } };
};

async function fetchTreasuryTxs(): Promise<TonTx[]> {
  try {
    const res = await fetch(
      `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(TREASURY_ADDRESS)}&limit=60&archival=true`,
    );
    const json = (await res.json()) as { ok?: boolean; result?: TonTx[] };
    return json.ok && Array.isArray(json.result) ? json.result : [];
  } catch {
    return [];
  }
}

function txComment(tx: TonTx) {
  const m = tx.in_msg;
  if (!m) return "";
  if (m.message) return m.message;
  if (m.msg_data?.text) {
    try {
      return Buffer.from(m.msg_data.text, "base64").toString("utf8");
    } catch {
      return "";
    }
  }
  return "";
}

export async function verifyPayment(initData: string, paymentId: string) {
  const { player: p } = await authPlayer(initData);
  const { data: pay } = await db.from("bg_payments").select("*").eq("id", paymentId).eq("telegram_id", p.telegram_id).maybeSingle();
  if (!pay) fail("Payment not found");
  if (pay!.status === "confirmed") return { status: "confirmed" as const };
  const txs = await fetchTreasuryTxs();
  const ok = await reconcileOne(pay!, txs);
  return { status: ok ? ("confirmed" as const) : ("pending" as const) };
}

type PaymentRow = { id: string; telegram_id: number; memo: string; amount_nano: number; purpose: string; ref: string | null; status: string };

async function reconcileOne(pay: PaymentRow, txs: TonTx[]) {
  const tx = txs.find((t) => txComment(t).trim() === pay.memo && Number(t.in_msg?.value ?? 0) >= Number(pay.amount_nano));
  if (!tx) return false;
  const hash = tx.transaction_id?.hash ?? `memo:${pay.memo}`;
  const { data: won } = await db
    .from("bg_payments")
    .update({ status: "confirmed", tx_hash: hash, sender: tx.in_msg?.source ?? null, confirmed_at: new Date().toISOString() })
    .eq("id", pay.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!won) return true;
  const player = await loadPlayer(pay.telegram_id);
  if (!player) return true;
  const amount = Number(pay.amount_nano) / 1e9;
  let label = pay.purpose;
  if (pay.purpose === "withdraw_fee") {
    const { data: w } = await db
      .from("bg_withdrawals")
      .update({ status: "pending" })
      .eq("id", pay.ref ?? "")
      .eq("status", "awaiting_fee")
      .select("amount,wallet,currency")
      .maybeSingle();
    label = "withdraw fee";
    if (w) {
      await notifyAdmins(
        `<b>💸 Withdrawal request</b>\n\nUser: <b>${esc(player.first_name ?? "")}</b> ${player.username ? "@" + esc(player.username) : ""} (<code>${player.telegram_id}</code>)\nAmount: <b>${n(w.amount)} ${w.currency}</b>\nWallet: <code>${esc(w.wallet)}</code>\n\nOpen /101 to approve.`,
      );
    }
  } else {
    const name = await fulfillItem(player, pay.purpose as "server" | "operator" | "boost", pay.ref ?? "");
    label = `${pay.purpose}: ${name}`;
    await db.from("bg_players").update({ total_spent: n(player.total_spent) + amount }).eq("telegram_id", player.telegram_id);
    await payUplineForPurchase(player, amount);
  }
  await notifyAdmins(
    `<b>✅ New payment</b>\n\nAmount: <b>${amount} GRAM</b>\nFor: <b>${esc(label)}</b>\nUser: <b>${esc(player.first_name ?? "")}</b> ${player.username ? "@" + esc(player.username) : ""} (<code>${player.telegram_id}</code>)\nTx: <code>${esc(hash)}</code>`,
  );
  return true;
}

export async function reconcilePendingPayments() {
  const { data } = await db
    .from("bg_payments")
    .select("*")
    .eq("status", "pending")
    .gt("created_at", new Date(Date.now() - 3 * 3600_000).toISOString())
    .limit(100);
  if (!data?.length) return 0;
  const txs = await fetchTreasuryTxs();
  let c = 0;
  for (const p of data) if (await reconcileOne(p, txs)) c++;
  await db.from("bg_payments").update({ status: "expired" }).eq("status", "pending").lt("created_at", new Date(Date.now() - 3 * 3600_000).toISOString());
  return c;
}

export async function notifyAdmins(text: string) {
  const { data } = await db.from("bg_admins").select("telegram_id").eq("role", "owner").not("telegram_id", "is", null);
  await Promise.allSettled((data ?? []).map((a) => tg("sendMessage", { chat_id: a.telegram_id, text, parse_mode: "HTML" })));
}

// ---------- community / tasks ----------

export async function isMember(chat: string, userId: number) {
  const r = await tg<{ status: string; is_member?: boolean }>("getChatMember", { chat_id: chat.startsWith("@") ? chat : `@${chat}`, user_id: userId });
  if (!r.ok || !r.result) return false;
  return ["member", "administrator", "creator"].includes(r.result.status) || (r.result.status === "restricted" && !!r.result.is_member);
}

export async function checkCommunity(initData: string) {
  const { player: p } = await authPlayer(initData);
  const { community } = await getConfig();
  if (!community) return { joined: p.telegram_id === DEMO_ID, community };
  const joined = await isMember(community, p.telegram_id);
  if (joined !== p.joined_channel) await db.from("bg_players").update({ joined_channel: joined }).eq("telegram_id", p.telegram_id);
  return { joined, community };
}

export async function getMissions(initData: string) {
  const { player: p } = await authPlayer(initData);
  const [{ data: tasks }, { data: claims }] = await Promise.all([
    db.from("bg_tasks").select("*").eq("active", true).order("sort"),
    db.from("bg_task_claims").select("task_id, period").eq("telegram_id", p.telegram_id),
  ]);
  const t = today();
  const claimed = new Set((claims ?? []).map((c) => `${c.task_id}|${c.period}`));
  const adsToday = p.ads_day === t ? p.ads_today : 0;
  return (tasks ?? []).map((task) => {
    const period = task.repeat === "daily" ? t : "once";
    let progress = 0;
    if (task.kind === "ads_daily") progress = adsToday;
    else if (task.kind === "ads_total") progress = p.ads_total;
    else if (task.kind === "referrals") progress = p.ref_count;
    else if (task.kind === "checkin") progress = p.last_checkin === t ? 1 : 0;
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      kind: task.kind,
      goal: task.goal,
      reward: n(task.reward),
      url: task.url,
      chat: task.chat_username,
      icon: task.icon,
      repeat: task.repeat,
      progress: Math.min(progress, task.goal),
      claimed: claimed.has(`${task.id}|${period}`),
    };
  });
}

export async function claimTask(initData: string, taskId: string) {
  const { player: p } = await authPlayer(initData);
  const { data: task } = await db.from("bg_tasks").select("*").eq("id", taskId).eq("active", true).maybeSingle();
  if (!task) fail("Mission not found");
  const t = today();
  const period = task!.repeat === "daily" ? t : "once";
  const adsToday = p.ads_day === t ? p.ads_today : 0;
  let ok = false;
  switch (task!.kind) {
    case "ads_daily": ok = adsToday >= task!.goal; break;
    case "ads_total": ok = p.ads_total >= task!.goal; break;
    case "referrals": ok = p.ref_count >= task!.goal; break;
    case "link": ok = true; break;
    case "checkin": ok = true; break;
    case "channel": ok = task!.chat_username ? await isMember(task!.chat_username, p.telegram_id) : false; break;
  }
  if (!ok) fail(task!.kind === "channel" ? "Join the channel first, then tap Claim" : "Mission not complete yet");
  const { error } = await db.from("bg_task_claims").insert({ telegram_id: p.telegram_id, task_id: task!.id, period });
  if (error) fail("Already claimed");
  let reward = n(task!.reward);
  if (task!.kind === "checkin") {
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const streak = p.last_checkin === yesterday ? p.streak + 1 : 1;
    reward = +(reward * Math.min(streak, 7)).toFixed(9);
    await db.from("bg_players").update({ last_checkin: t, streak }).eq("telegram_id", p.telegram_id);
  }
  if (reward > 0) await db.rpc("bg_credit", { _tid: p.telegram_id, _amount: reward, _reason: "mission", _meta: { task: task!.id } });
  return { reward };
}

// ---------- squad ----------

export async function getSquad(initData: string) {
  const { player: p } = await authPlayer(initData);
  const weekStart = new Date();
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const [{ data: refs }, { data: top }, cfg] = await Promise.all([
    db.from("bg_players").select("first_name, username, total_mined, total_spent, created_at").eq("referrer_id", p.telegram_id).order("created_at", { ascending: false }).limit(100),
    db.rpc("bg_top_inviters", { _since: weekStart.toISOString(), _limit: 10 }),
    getConfig(),
  ]);
  const link = cfg.botUsername ? `https://t.me/${cfg.botUsername}?startapp=r${p.telegram_id}` : null;
  return {
    link,
    refCount: p.ref_count,
    refEarned: n(p.total_ref_earned),
    recruits: (refs ?? []).map((r) => ({ name: r.first_name ?? r.username ?? "Recruit", mined: n(r.total_mined), spent: n(r.total_spent), joinedAt: r.created_at })),
    top: (top ?? []).map((t: { first_name: string | null; username: string | null; invites: number; telegram_id: number }) => ({
      name: t.first_name ?? t.username ?? "Soldier",
      invites: Number(t.invites),
      me: Number(t.telegram_id) === p.telegram_id,
    })),
  };
}

// ---------- wallet ----------

export function normalizeWallet(addr: string) {
  try {
    return Address.parse(addr.trim()).toString({ bounceable: false, urlSafe: true });
  } catch {
    return null;
  }
}

export async function getWallet(initData: string) {
  const { player: p } = await authPlayer(initData);
  const [{ data: w }, { data: ledger }] = await Promise.all([
    db.from("bg_withdrawals").select("id, amount, wallet, status, currency, created_at, processed_at").eq("telegram_id", p.telegram_id).order("created_at", { ascending: false }).limit(20),
    db.from("bg_ledger").select("amount, reason, currency, created_at").eq("telegram_id", p.telegram_id).order("created_at", { ascending: false }).limit(30),
  ]);
  return {
    balance: n(p.balance),
    gram: n(p.gram_balance),
    wallet: p.wallet_address,
    joinedCommunity: p.joined_channel,
    refCount: p.ref_count,
    adsTotal: p.ads_total,
    withdrawals: (w ?? []).map((r) => ({ ...r, amount: n(r.amount) })),
    ledger: (ledger ?? []).map((r) => ({ ...r, amount: n(r.amount) })),
  };
}

export async function requestWithdraw(initData: string, amount: number, wallet: string, currency: Currency) {
  const { player: p } = await authPlayer(initData);
  if (p.telegram_id === DEMO_ID) fail("Withdrawals work inside Telegram only");
  const addr = normalizeWallet(wallet);
  if (!addr) fail("Enter a valid TON wallet address");
  const { community } = await getConfig();
  const joined = community ? await isMember(community, p.telegram_id) : false;
  const bal = currency === "GRAM" ? n(p.gram_balance) : n(p.balance);
  const check = checkWithdraw({ currency, amount, balance: bal, joinedCommunity: joined, referrals: p.ref_count, adsTotal: p.ads_total });
  if (!check.amountOk) fail(`Minimum withdrawal is ${withdrawMin(currency)} ${currency}`);
  if (!check.balanceOk) fail("Not enough balance");
  if (!check.communityOk) fail("Join our community first");
  if (!check.activityOk) fail(`Invite ${RULES.withdrawAltReferrals} friend or watch ${RULES.withdrawAltAds} videos first`);
  const { error } = await db.rpc(currency === "GRAM" ? "bg_credit_gram" : "bg_credit", { _tid: p.telegram_id, _amount: -amount, _reason: "withdraw_hold" });
  if (error) fail("Not enough balance");
  const { data: wd, error: e2 } = await db
    .from("bg_withdrawals")
    .insert({ telegram_id: p.telegram_id, amount, wallet: addr!, status: "awaiting_fee", currency })
    .select("id")
    .single();
  if (e2) throw e2;
  await db.from("bg_players").update({ wallet_address: addr, joined_channel: true }).eq("telegram_id", p.telegram_id);
  const pay = await insertPayment(p.telegram_id, "withdraw_fee", wd.id, RULES.withdrawFee);
  await db.from("bg_withdrawals").update({ fee_payment_id: pay.paymentId }).eq("id", wd.id);
  return { withdrawalId: wd.id, payment: pay };
}

export async function cancelWithdraw(initData: string, id: string) {
  const { player: p } = await authPlayer(initData);
  const { data } = await db
    .from("bg_withdrawals")
    .update({ status: "rejected", admin_note: "cancelled by user", processed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("telegram_id", p.telegram_id)
    .eq("status", "awaiting_fee")
    .select("amount, currency")
    .maybeSingle();
  if (!data) fail("This withdrawal can't be cancelled");
  await db.rpc(data!.currency === "GRAM" ? "bg_credit_gram" : "bg_credit", { _tid: p.telegram_id, _amount: n(data!.amount), _reason: "withdraw_refund" });
  return { ok: true };
}

export async function payWithdrawFeeAgain(initData: string, id: string) {
  const { player: p } = await authPlayer(initData);
  const { data: w } = await db.from("bg_withdrawals").select("id,status").eq("id", id).eq("telegram_id", p.telegram_id).maybeSingle();
  if (!w || w.status !== "awaiting_fee") fail("Nothing to pay");
  const pay = await insertPayment(p.telegram_id, "withdraw_fee", w!.id, RULES.withdrawFee);
  await db.from("bg_withdrawals").update({ fee_payment_id: pay.paymentId }).eq("id", w!.id);
  return pay;
}

export { kb };
