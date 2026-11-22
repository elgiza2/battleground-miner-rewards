import { generateImage, generateResponse } from "@lovable.dev/ai-gateway";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { RULES } from "./game-rules";
import { getConfig, reconcilePendingPayments } from "./game.server";
import { esc, kb, tg, tgSendPhotoBytes } from "./telegram.server";

export const NOTIFY_HOURS = [7, 12, 17, 21];
export const POST_HOURS = [9, 15, 20];
const BATCH = 200;

export async function getOrigin(): Promise<string | null> {
  const { data } = await db.from("bg_config").select("value").eq("key", "origin").maybeSingle();
  return ((data?.value as { url?: string } | undefined)?.url as string | undefined) ?? null;
}
export async function setOrigin(url: string) {
  if (url.includes("localhost") || url.includes("127.0.0.1")) return;
  await db.from("bg_config").upsert({ key: "origin", value: { url } });
}

const TEMPLATES: ((name: string, balance: string) => string)[] = [
  (name) => `<b>⛏️ ${name}, your servers are filling up!</b>\n\nYour backpack holds 8 hours of loot. <b>Claim it now</b> before it stops filling.`,
  () => `<b>📦 Airdrop incoming!</b>\n\nCrates are dropping right now.\n<b>Every video = instant GRAM + 2x mining boost.</b>`,
  () => `<b>🔥 Squad bonus is live</b>\n\nInvite friends and take <b>20%</b> of everything they mine — forever. Plus <b>10%</b> of every server they buy.`,
  () => `<b>🏆 Chicken Dinner Challenge</b>\n\nWatch <b>1000 videos today</b> and grab the biggest daily reward. The ladder resets at midnight UTC.`,
  (_n, balance) => `<b>💎 Balance check: ${balance} GRAM</b>\n\nKeep the rigs running — withdrawals open at <b>${RULES.withdrawMin} GRAM</b>.`,
  () => `<b>⚡ Battle Pass: 2x for 24h</b>\n\nDouble every drop today for just <b>${RULES.battlePassPrice} GRAM</b>.`,
  () => `<b>🪂 New servers just landed</b>\n\nUpgrade your base — higher tiers mine faster and pay back more.`,
];

function slotKeys(now: Date) {
  const day = now.toISOString().slice(0, 10);
  const h = now.getUTCHours();
  const due = (hours: number[], prefix: string) =>
    hours.filter((x) => h >= x && h <= x + 1).map((x) => `${prefix}:${day}:${x}`);
  return { notify: due(NOTIFY_HOURS, "notify"), posts: due(POST_HOURS, "post") };
}

async function ensureJob(key: string, payload: Record<string, unknown>) {
  const { data } = await db.from("bg_jobs").select("key").eq("key", key).maybeSingle();
  if (data) return;
  const { error } = await db.from("bg_jobs").insert({ key });
  if (!error) await db.from("bg_config").upsert({ key: `job:${key}`, value: payload as never });
}

export async function enqueueGift(amount: number, title = "Daily supply gift") {
  const { data } = await db.from("bg_gifts").insert({ amount, title }).select("id").single();
  if (!data) return null;
  const key = `gift:${data.id}`;
  await ensureJob(key, { type: "gift", giftId: data.id, amount });
  return key;
}

export async function enqueueBroadcast(text: string) {
  const key = `custom:${Date.now()}`;
  await ensureJob(key, { type: "custom", text });
  return key;
}

function buttons(origin: string | null, botUsername: string | null, extra?: { text: string; callback_data: string }) {
  const rows: Parameters<typeof kb>[0] = [];
  if (extra) rows.push([{ ...extra, style: "success" }]);
  const play = origin
    ? { text: "▶  PLAY DROPZONE", web_app: { url: origin }, style: extra ? ("primary" as const) : ("success" as const) }
    : botUsername
      ? { text: "▶  PLAY DROPZONE", url: `https://t.me/${botUsername}?startapp=bot`, style: "success" as const }
      : null;
  if (play) rows.push([play]);
  return kb(rows);
}

async function processJob(key: string, deadline: number) {
  const { data: job } = await db.from("bg_jobs").select("*").eq("key", key).maybeSingle();
  if (!job || job.done) return 0;
  const { data: cfgRow } = await db.from("bg_config").select("value").eq("key", `job:${key}`).maybeSingle();
  const payload = (cfgRow?.value ?? {}) as { type?: string; giftId?: string; amount?: number; text?: string };
  const [origin, cfg] = await Promise.all([getOrigin(), getConfig()]);
  let cursor = Number(job.cursor);
  let sent = job.sent;
  const tplIndex = Math.abs([...key].reduce((a, c) => a + c.charCodeAt(0), 0)) % TEMPLATES.length;
  while (Date.now() < deadline) {
    const { data: players } = await db
      .from("bg_players")
      .select("telegram_id, first_name, balance")
      .gt("telegram_id", cursor)
      .eq("started_bot", true)
      .eq("bot_blocked", false)
      .order("telegram_id")
      .limit(BATCH);
    const list = players ?? [];
    for (let i = 0; i < list.length; i += 25) {
      const chunk = list.slice(i, i + 25);
      const started = Date.now();
      await Promise.all(
        chunk.map(async (pl) => {
          let text: string;
          let markup;
          if (payload.type === "gift") {
            text = `<b>🎁 Daily supply gift!</b>\n\n<b>${payload.amount} GRAM</b> is waiting for you, ${esc(pl.first_name ?? "soldier")}.\nTap below — it lands in your balance instantly.`;
            markup = buttons(origin, cfg.botUsername, { text: "🎁  CLAIM GIFT", callback_data: `g:${payload.giftId}` });
          } else if (payload.type === "custom") {
            text = payload.text ?? "";
            markup = buttons(origin, cfg.botUsername);
          } else {
            text = TEMPLATES[tplIndex]!(esc(pl.first_name ?? "Soldier"), Number(pl.balance).toFixed(4));
            markup = buttons(origin, cfg.botUsername);
          }
          const r = await tg("sendMessage", { chat_id: pl.telegram_id, text, parse_mode: "HTML", reply_markup: markup });
          if (r.ok) sent++;
          else if (r.error_code === 403 || r.error_code === 400)
            await db.from("bg_players").update({ bot_blocked: true }).eq("telegram_id", pl.telegram_id);
        }),
      );
      const wait = 1050 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    if (list.length) cursor = Number(list[list.length - 1]!.telegram_id);
    const done = list.length < BATCH;
    await db.from("bg_jobs").update({ cursor, sent, done, updated_at: new Date().toISOString() }).eq("key", key);
    if (done) return sent;
  }
  return sent;
}

async function generatePost(slot: string) {
  const { data: claim, error } = await db.from("bg_posts").insert({ slot, status: "generating" }).select("id").single();
  if (error || !claim) return;
  try {
    const cfg = await getConfig();
    if (!cfg.community) throw new Error("community not configured");
    const themes = ["a new airdrop wave", "a squad invite contest", "the Chicken Dinner 1000-video challenge", "golden servers landing", "a Battle Pass 2x weekend", "a new operator unlocked", "mining tips for beginners", "a GRAM payout milestone"];
    const theme = themes[Math.floor(Math.random() * themes.length)]!;
    const text = await generateResponse({
      model: "openai/gpt-6-astra",
      input: `Write a short Telegram channel post in English for DROPZONE, a battle-royale themed TON mining game where players mine $GRAM with servers, watch videos for airdrop crates and invite friends. Topic: ${theme}. Return strictly JSON: {"headline": "max 6 words, punchy, with 1 emoji", "body": "2-3 short lines, energetic, no hashtags, no prices or promises of profit"}.`,
    });
    const raw = (text as { output_text?: string }).output_text ?? JSON.stringify(text);
    const match = /\{[\s\S]*\}/.exec(raw);
    const parsed = match ? (JSON.parse(match[0]) as { headline?: string; body?: string }) : {};
    const headline = parsed.headline ?? "🪂 New drop is live";
    const body = parsed.body ?? "Crates are falling. Jump in and claim yours.";
    const img = await generateImage({
      model: "openai/gpt-image-2.5-sunburst",
      prompt: `Cinematic stylized 3D illustration for a battle royale crypto mining game, theme: ${theme}. Supply crates, parachutes, glowing servers, island battleground, soft crimson, violet and orange palette, premium clean look. No text, no letters, no logos.`,
      size: "1536x1024",
      quality: "medium",
    });
    const b64 = (img as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
    if (!b64) throw new Error("no image");
    const caption = `<b>${esc(headline)}</b>\n\n${esc(body)}`;
    const markup = kb([[{ text: "▶  OPEN DROPZONE", url: cfg.botUsername ? `https://t.me/${cfg.botUsername}?startapp=news` : "https://t.me", style: "success" }]]);
    const r = await tgSendPhotoBytes(`@${cfg.community.replace(/^@/, "")}`, Buffer.from(b64, "base64"), caption, markup);
    await db.from("bg_posts").update({ status: r.ok ? "sent" : "failed", text: caption, message_id: r.result?.message_id ?? null, error: r.ok ? null : r.description ?? "send failed" }).eq("id", claim.id);
  } catch (e) {
    console.error("[posts]", e);
    await db.from("bg_posts").update({ status: "failed", error: String((e as Error).message ?? e) }).eq("id", claim.id);
  }
}

/** One scheduler tick: schedule due slots, publish one post, push notifications, reconcile payments. */
export async function runTick(budgetMs = 22_000) {
  const deadline = Date.now() + budgetMs;
  const now = new Date();
  const { notify, posts } = slotKeys(now);
  for (const key of notify) {
    if (key.endsWith(":12")) {
      const { data } = await db.from("bg_jobs").select("key").eq("key", key).maybeSingle();
      if (!data) {
        await db.from("bg_jobs").insert({ key, done: true });
        await enqueueGift(RULES.giftAmount);
      }
    } else await ensureJob(key, { type: "notify" });
  }
  const paid = await reconcilePendingPayments().catch(() => 0);
  for (const slot of posts) {
    const { data } = await db.from("bg_posts").select("id").eq("slot", slot).maybeSingle();
    if (!data) await generatePost(slot);
  }
  const { data: open } = await db.from("bg_jobs").select("key").eq("done", false).order("updated_at").limit(5);
  let sent = 0;
  for (const j of open ?? []) {
    if (Date.now() > deadline) break;
    sent += await processJob(j.key, deadline);
  }
  return { sent, paid, open: (open ?? []).length };
}
