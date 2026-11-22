import { createFileRoute } from "@tanstack/react-router";

// Registers the bot webhook, menu button and commands for the host this request arrives on.
export const Route = createFileRoute("/api/public/telegram/setup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const T = await import("@/lib/telegram.server");
        const secret = process.env["CRON_SECRET"] || process.env["LOVABLE_CRON_SECRET"];
        const key = request.headers.get("x-cron-key") ?? new URL(request.url).searchParams.get("key") ?? "";
        if (!secret || !T.safeEqual(key, secret)) return new Response("unauthorized", { status: 401 });
        const token = T.botToken();
        if (!token) return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN missing" }, { status: 503 });
        const origin = new URL(request.url).origin.replace("http://", "https://");
        const options = await request.json().catch(() => ({})) as { community?: unknown };
        if (options.community !== undefined && (typeof options.community !== "string" || !/^[a-zA-Z0-9_]{5,32}$/.test(options.community))) {
          return Response.json({ ok: false, error: "Invalid community username" }, { status: 400 });
        }
        const J = await import("@/lib/jobs.server");
        await J.setOrigin(origin);
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        await db.from("bg_config").upsert({ key: "bot", value: { username: "Dropeybot" } });
        if (typeof options.community === "string") {
          const { error } = await db.from("bg_config").upsert({ key: "community", value: { username: options.community } });
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        const hook = await T.tg("setWebhook", {
          url: `${origin}/api/public/telegram/webhook`,
          secret_token: T.webhookSecret(token),
          allowed_updates: ["message", "callback_query", "my_chat_member"],
          drop_pending_updates: false,
        });
        const menu = await T.tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Play", web_app: { url: origin } } });
        const cmds = await T.tg("setMyCommands", { commands: [{ command: "start", description: "Open PUBG" }] });
        return Response.json({ ok: hook.ok && menu.ok && cmds.ok, webhook: hook, menu: menu.ok, commands: cmds.ok, origin });
      },
    },
  },
});
