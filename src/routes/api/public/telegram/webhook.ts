import { createFileRoute } from "@tanstack/react-router";

type Update = {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string; is_premium?: boolean }; text?: string };
  callback_query?: { id: string; from: { id: number; first_name?: string; username?: string }; data?: string; message?: { chat: { id: number }; message_id: number } };
  my_chat_member?: { chat: { id: number; type: string }; new_chat_member: { status: string } };
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const T = await import("@/lib/telegram.server");
        const token = T.botToken();
        if (!token) return new Response("not configured", { status: 503 });
        const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!T.safeEqual(got, T.webhookSecret(token))) return new Response("unauthorized", { status: 401 });
        const update = (await request.json().catch(() => null)) as Update | null;
        if (!update) return Response.json({ ok: true });
        try {
          await handle(update);
        } catch (e) {
          console.error("[webhook]", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});

async function handle(u: Update) {
  const T = await import("@/lib/telegram.server");
  const G = await import("@/lib/game.server");
  const J = await import("@/lib/jobs.server");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const origin = await J.getOrigin();

  if (u.my_chat_member && u.my_chat_member.chat.type === "private") {
    const blocked = ["kicked", "left"].includes(u.my_chat_member.new_chat_member.status);
    await db.from("bg_players").update({ bot_blocked: blocked }).eq("telegram_id", u.my_chat_member.chat.id);
    return;
  }

  if (u.callback_query) {
    const q = u.callback_query;
    const m = /^g:([0-9a-f-]{36})$/.exec(q.data ?? "");
    if (!m) return T.tg("answerCallbackQuery", { callback_query_id: q.id });
    const { data: gift } = await db.from("bg_gifts").select("*").eq("id", m[1]!).maybeSingle();
    if (!gift || new Date(gift.expires_at).getTime() < Date.now()) {
      return T.tg("answerCallbackQuery", { callback_query_id: q.id, text: "This gift has expired. Watch for the next drop!", show_alert: true });
    }
    await G.ensurePlayer({ id: q.from.id, first_name: q.from.first_name, username: q.from.username }, null, { fromBot: true });
    const { error } = await db.from("bg_gift_claims").insert({ gift_id: gift.id, telegram_id: q.from.id });
    if (error) return T.tg("answerCallbackQuery", { callback_query_id: q.id, text: "Already claimed ✅", show_alert: false });
    await db.rpc("bg_credit", { _tid: q.from.id, _amount: Number(gift.amount), _reason: "gift", _meta: { gift: gift.id } });
    await T.tg("answerCallbackQuery", { callback_query_id: q.id, text: `🎁 +${Number(gift.amount)} GRAM added to your balance!`, show_alert: true });
    if (q.message) {
      await T.tg("editMessageReplyMarkup", {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: T.kb([
          [{ text: `✅  CLAIMED +${Number(gift.amount)} GRAM`, callback_data: "noop" }],
          ...(origin ? [[{ text: "▶  PLAY DROPZONE", web_app: { url: origin }, style: "success" as const }]] : []),
        ]),
      });
    }
    return;
  }

  const msg = u.message;
  if (!msg?.from || msg.chat.type !== "private") return;
  const text = (msg.text ?? "").trim();
  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] ?? null;
    const { player } = await G.ensurePlayer(msg.from, payload, { fromBot: true });
    const cfg = await G.getConfig();
    const share = cfg.botUsername
      ? `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${cfg.botUsername}?startapp=r${player.telegram_id}`)}&text=${encodeURIComponent("🪂 Drop into DROPZONE with me and mine $GRAM!")}`
      : null;
    const rows: Parameters<typeof T.kb>[0] = [];
    if (origin) rows.push([{ text: "▶  PLAY DROPZONE", web_app: { url: origin }, style: "success" }]);
    if (share) rows.push([{ text: "🔥  INVITE & EARN 20%", url: share, style: "primary" }]);
    if (cfg.community) rows.push([{ text: "📢  JOIN COMMUNITY", url: `https://t.me/${cfg.community}`, style: "danger" }]);
    const caption =
      `<b>🪂 WELCOME TO DROPZONE, ${T.esc(msg.from.first_name ?? "SOLDIER").toUpperCase()}</b>\n\n` +
      `<b>Drop in. Mine $GRAM. Cash out in TON.</b>\n\n` +
      `<b>⛏  Deploy servers</b> — they mine 24/7\n` +
      `<b>📦  Open airdrop crates</b> — instant loot\n` +
      `<b>🔥  Build your squad</b> — earn 20% of their mining\n\n` +
      `<b>Your first server is live. Tap PLAY.</b>`;
    const banner = origin ? `${origin}${(await import("@/assets/art/start-banner.jpg.asset.json")).default.url}` : null;
    if (banner) {
      const r = await T.tg("sendPhoto", { chat_id: msg.chat.id, photo: banner, caption, parse_mode: "HTML", reply_markup: T.kb(rows) });
      if (r.ok) return;
    }
    await T.tg("sendMessage", { chat_id: msg.chat.id, text: caption, parse_mode: "HTML", reply_markup: T.kb(rows) });
    return;
  }
  if (text === "/101") {
    const role = await G.adminRole(msg.from);
    if (role && origin) {
      await T.tg("sendMessage", {
        chat_id: msg.chat.id,
        text: "<b>🛡 Command center</b>",
        parse_mode: "HTML",
        reply_markup: T.kb([[{ text: "OPEN ADMIN PANEL", web_app: { url: `${origin}/101` }, style: "danger" }]]),
      });
    }
    return;
  }
  if (origin) {
    await T.tg("sendMessage", {
      chat_id: msg.chat.id,
      text: "<b>Your servers are mining. Jump back in 👇</b>",
      parse_mode: "HTML",
      reply_markup: T.kb([[{ text: "▶  PLAY DROPZONE", web_app: { url: origin }, style: "success" }]]),
    });
  }
}
