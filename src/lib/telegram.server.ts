import { createHash, createHmac, timingSafeEqual } from "crypto";

export type TgUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

export function botToken(): string | null {
  return process.env["TELEGRAM_BOT_TOKEN"] || null;
}

/** Verifies Telegram Mini App initData (HMAC-SHA256 with the bot token). */
export function verifyInitData(initData: string, token: string, maxAgeSec = 86400 * 7) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(check).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as TgUser;
    return { user, startParam: params.get("start_param") };
  } catch {
    return null;
  }
}

export function webhookSecret(token: string) {
  return createHash("sha256").update(`dropzone-webhook:${token}`).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type TgResult<T = unknown> = { ok: boolean; result?: T; description?: string; error_code?: number };

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<TgResult<T>> {
  const token = botToken();
  if (!token) return { ok: false, description: "bot token missing" };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as TgResult<T>;
  if (!json.ok) console.error(`[telegram] ${method} failed`, json.error_code, json.description);
  return json;
}

export async function tgSendPhotoBytes(
  chatId: string | number,
  bytes: Uint8Array,
  caption: string,
  replyMarkup: unknown,
): Promise<TgResult<{ message_id: number }>> {
  const token = botToken();
  if (!token) return { ok: false, description: "bot token missing" };
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("reply_markup", JSON.stringify(replyMarkup));
  form.append("photo", new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), "drop.jpg");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
  return (await res.json().catch(() => ({ ok: false }))) as TgResult<{ message_id: number }>;
}

export function esc(s: string) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

type Btn = { text: string; style?: "primary" | "success" | "danger" } & (
  | { url: string }
  | { callback_data: string }
  | { web_app: { url: string } }
);
export const kb = (rows: Btn[][]) => ({ inline_keyboard: rows });
