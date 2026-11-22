import { Link } from "@tanstack/react-router";
import { Pickaxe, Server, Target, Users, Wallet } from "lucide-react";

const items = [
  { to: "/", label: "Base", icon: Pickaxe },
  { to: "/servers", label: "Armory", icon: Server },
  { to: "/missions", label: "Missions", icon: Target },
  { to: "/squad", label: "Squad", icon: Users },
  { to: "/wallet", label: "Wallet", icon: Wallet },
] as const;

export function Dock() {
  return (
    <nav className="dock" aria-label="Main">
      {items.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} activeOptions={{ exact: to === "/" }}>
          <Icon className="h-[20px] w-[20px]" strokeWidth={1.8} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
