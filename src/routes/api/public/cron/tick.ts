import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/tick")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  const T = await import("@/lib/telegram.server");
  const secret = process.env["CRON_SECRET"];
  const key = new URL(request.url).searchParams.get("key") ?? request.headers.get("x-cron-key") ?? "";
  if (!secret || !T.safeEqual(key, secret)) return new Response("unauthorized", { status: 401 });
  const J = await import("@/lib/jobs.server");
  const result = await J.runTick();
  return Response.json({ ok: true, ...result });
}
