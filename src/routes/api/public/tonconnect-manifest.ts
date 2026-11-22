import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tonconnect-manifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin.replace("http://", "https://");
        return Response.json(
          { url: origin, name: "DROPZONE", iconUrl: `${origin}/favicon.png` },
          { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" } },
        );
      },
    },
  },
});
