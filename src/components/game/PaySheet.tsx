import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Wallet, Coins } from "@/components/game/GlassIcons";
import { Sheet } from "./Sheet";
import { buyWithBalanceFn, createPaymentFn, verifyPaymentFn } from "@/lib/game.functions";
import { payWithWallet } from "@/lib/ton-client";
import { auth, errMsg, useRefresh } from "@/hooks/use-game";
import { fmtGram } from "@/lib/game-rules";
import { haptic } from "@/lib/telegram-client";

export type PayItem = {
  title: string;
  subtitle?: string;
  image?: string;
  price: number;
  purpose: "server" | "operator" | "boost" | "activation";
  ref: string;
  allowBalance: boolean;
};

export async function waitForPayment(paymentId: string, tries = 24) {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 6000 : 5000));
    const r = await verifyPaymentFn({ data: { ...auth(), paymentId } }).catch(() => null);
    if (r?.status === "confirmed") return true;
  }
  return false;
}

export function PaySheet({ item, balance, onClose }: { item: PayItem | null; balance: number; onClose: () => void }) {
  const [busy, setBusy] = useState<null | "wallet" | "balance" | "confirming">(null);
  const refresh = useRefresh();

  const payWallet = async () => {
    if (!item) return;
    setBusy("wallet");
    try {
      const p = await createPaymentFn({ data: { ...auth(), purpose: item.purpose, ref: item.ref } });
      await payWithWallet(p);
      setBusy("confirming");
      toast("Payment sent", { description: "Confirming on the TON network…" });
      const ok = await waitForPayment(p.paymentId);
      if (ok) {
        haptic("success");
        toast.success(`${item.title} deployed!`);
        await refresh();
        onClose();
      } else toast("Still confirming", { description: "It will land automatically within a few minutes." });
    } catch (e) {
      haptic("error");
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const payBalance = async () => {
    if (!item || item.purpose === "boost" || item.purpose === "activation") return;
    setBusy("balance");
    try {
      await buyWithBalanceFn({ data: { ...auth(), kind: item.purpose, ref: item.ref } });
      haptic("success");
      toast.success(`${item.title} deployed!`);
      await refresh();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && !busy && onClose()} title={item?.title ?? ""}>
      {item && (
        <div className="space-y-4">
          <div className="glass flex items-center gap-4 p-4">
            {item.image && <img src={item.image} alt="" className="h-20 w-20 object-contain drop-shadow-lg" />}
            <div className="min-w-0">
              {item.subtitle && <p className="text-[13px] leading-snug text-copy">{item.subtitle}</p>}
              <p className="mt-1 text-[26px] font-semibold tracking-tight text-ink tabular">
                {fmtGram(item.price)} <span className="text-[14px] font-medium text-copy">GRAM</span>
              </p>
            </div>
          </div>
          <button className="pill pill--dot w-full" disabled={!!busy} onClick={payWallet}>
            {busy === "wallet" || busy === "confirming" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {busy === "confirming" ? "Confirming payment…" : `Pay ${fmtGram(item.price)} GRAM with wallet`}
          </button>
          {item.allowBalance && (
            <button className="pill pill--ink w-full" disabled={!!busy || balance < item.price} onClick={payBalance}>
              {busy === "balance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              Use GRAM balance · {fmtGram(balance)}
            </button>
          )}
          <p className="text-center text-[12px] leading-relaxed text-copy">
            Payments go to the PUBG treasury in GRAM (TON). Any TON wallet works.
          </p>
        </div>
      )}
    </Sheet>
  );
}
