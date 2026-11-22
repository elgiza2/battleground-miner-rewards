import { Link, useRouterState } from "@tanstack/react-router";
import { Pickaxe, Server, Target, Users, Wallet } from "lucide-react";
import { haptic } from "@/lib/telegram-client";

const items = [
  { to: "/", label: "Base", icon: Pickaxe },
  { to: "/servers", label: "Armory", icon: Server },
  { to: "/missions", label: "Missions", icon: Target },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/wallet", label: "Wallet", icon: Wallet },
] as const;

export function Dock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const idx = Math.max(0, items.findIndex((i) => (i.to === "/" ? path === "/" : path.startsWith(i.to))));
  return (
    <nav className="dock" aria-label="Main" style={{ ["--dock-i" as string]: idx }}>
      <span className="dock-pill" aria-hidden="true" />
      {items.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} activeOptions={{ exact: to === "/" }} onClick={() => haptic("light")}>
          <Icon className="dock-icon h-[20px] w-[20px]" strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
