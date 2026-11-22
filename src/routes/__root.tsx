import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initTelegram } from "@/lib/telegram-client";
import { Dock } from "@/components/game/Dock";
import { FilterDefs } from "@/components/game/GlassCard";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md p-8 text-center">
        <h1 className="text-5xl font-semibold text-ink">404</h1>
        <p className="mt-2 text-sm text-copy">This drop zone doesn’t exist.</p>
        <Link to="/" className="pill pill--dot mt-6">
          Back to base
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold text-ink">Signal lost</h1>
        <p className="mt-2 text-sm text-copy">Something went wrong. Try again.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="pill pill--dot mt-6"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" },
      { name: "theme-color", content: "#ececeb" },
      { title: "DROPZONE — Mine $GRAM" },
      { name: "description", content: "DROPZONE is a battle-royale mining game on Telegram. Deploy servers, open airdrop crates and mine $GRAM on TON." },
      { property: "og:title", content: "DROPZONE — Mine $GRAM" },
      { property: "og:description", content: "Deploy servers, open airdrop crates and mine $GRAM on TON." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
    ],
    scripts: [
      { src: "https://telegram.org/js/telegram-web-app.js?59" },
      { src: "https://sad.adsgram.ai/js/sad.min.js" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = path.startsWith("/101");
  useEffect(() => {
    initTelegram();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <main className="stage">
        <video
          className="stage-motion stage-motion--wide"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/5c3ec08f-2dbf-4c0a-8588-f6106a789443.webp"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_125226_45cb4f38-aa7e-47e1-885d-ae0b69745369.mp4"
        />
        <video
          className="stage-motion stage-motion--narrow"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/0f4926a4-e660-4df2-9195-2bfb3e341bdd.webp"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260826_125242_daae1570-386d-4bd5-8896-80499e2371e0.mp4"
        />
        <FilterDefs />
        <Outlet />
        {!isAdmin && <Dock />}
      </main>
      <Toaster position="top-center" toastOptions={{ className: "glass" }} />
    </QueryClientProvider>
  );
}
