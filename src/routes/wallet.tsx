import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Circle, ExternalLink, Loader2, Wallet as WalletIcon } from "lucide-react";
import { useWallet, useGameState, auth, errMsg, useRefresh } from "@/hooks/use-game";
import { Masthead, StateGate } from "@/components/game/Masthead";
import { GlassCard } from "@/components/game/GlassCard";
import { DotText } from "@/components/game/DotText";
import { waitForPayment } from "@/components/game/PaySheet";
import { cancelWithdrawFn, checkCommunityFn, payWithdrawFeeFn, requestWithdrawFn, swapFn } from "@/lib/game.functions";
import { connectWallet, payWithWallet, walletAddress } from "@/lib/ton-client";
import { PUBG_ICON, PUBG_MARKET_URL, RULES, checkWithdraw, fmtGram, fmtPubg, quoteSwap, withdrawMin, type Currency } from "@/lib/game-rules";
import { haptic, openTgLink } from "@/lib/telegram-client";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet & withdrawals — PUBG" },
      { name: "description", content: "Swap mined $PUBG to GRAM and withdraw to any TON wallet." },
      { property: "og:title", content: "Wallet & withdrawals — PUBG" },
      { property: "og:description", content: "Swap PUBG to GRAM and cash out from 0.5 GRAM." },
    ],
  }),
  component: WalletPage,
});

const REASONS: Record<string, string> = {
  mining: "Mining claim", ad: "Video loot", mission: "Mission", gift: "Gift", invite_bonus: "Recruit bonus", recruit_active: "Recruit activated",
  squad_l1: "Squad mining", squad_l2: "Squad mining L2", squad_purchase_l1: "Squad purchase", squad_purchase_l2: "Squad purchase L2",
  swap_out: "Swapped to GRAM", swap_in: "Swap received", buy_server: "Server bought", buy_operator: "Operator recruited", withdraw_hold: "Withdrawal", withdraw_refund: "Withdrawal returned",
};

function WalletPage() {
  const w = useWallet();
  const st = useGameState();
  const refresh = useRefresh();
  const d = w.data;
  const [amount, setAmount] = useState("");
  const [addr, setAddr] = useState("");
  const [joined, setJoined] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("GRAM");
  const [swapAmt, setSwapAmt] = useState("");
  const market = st.data?.market;
  const community = st.data?.config.community ?? null;

  useEffect(() => {
    if (d?.wallet && !addr) setAddr(d.wallet);
  }, [d?.wallet]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void walletAddress().then((a) => a && !addr && setAddr(a)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verifyCommunity = async () => {
    setChecking(true);
    try {
      const r = await checkCommunityFn({ data: auth() });
      setJoined(r.joined);
      if (!r.joined) toast("Join the community first, then tap Verify");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setChecking(false);
    }
  };

  const amt = Number(amount);
  const bal = d ? (currency === "GRAM" ? d.gram : d.balance) : 0;
  const check = d ? checkWithdraw({ currency, amount: amt, balance: bal, joinedCommunity: joined ?? d.joinedCommunity, referrals: d.refCount, adsTotal: d.adsTotal }) : null;

  const payFee = async (p: { paymentId: string; address: string; amountNano: string; payload: string }) => {
    setBusy("fee");
    try {
      await payWithWallet(p);
      toast("Fee sent", { description: "Confirming on TON…" });
      const ok = await waitForPayment(p.paymentId);
      if (ok) {
        haptic("success");
        toast.success("Withdrawal queued — you’ll get a message when it’s sent");
      } else toast("Still confirming — it will update automatically");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
      await refresh("wallet", "state");
    }
  };

  const submit = async () => {
    setBusy("submit");
    try {
      const r = await requestWithdrawFn({ data: { ...auth(), amount: amt, wallet: addr, currency } });
      await refresh("wallet", "state");
      setAmount("");
      setBusy(null);
      await payFee(r.payment);
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(null);
    }
  };

  const swapN = Number(swapAmt);
  const swapOut = market ? quoteSwap(swapN, market.pubgPerGram, market.swapFee) : 0;
  const doSwap = async () => {
    setBusy("swap");
    try {
      const r = await swapFn({ data: { ...auth(), pubg: swapN } });
      haptic("success");
      toast.success(`Swapped ${fmtPubg(r.pubg, 0)} PUBG → ${fmtGram(r.gram, 6)} GRAM`);
      setSwapAmt("");
      await refresh("wallet", "state");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <Masthead lead="Swap" dots="PUBG" line2="cash out GRAM" intro={`Swap mined PUBG to GRAM at the live market price, then withdraw from ${RULES.withdrawMinGram} GRAM to any TON wallet.`} />
      <StateGate isLoading={w.isLoading} error={w.error}>
        {d && (
          <>
            <GlassCard variant="speed" video className="entrance">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <p className="card__title text-[19px]">
                    PUBG balance
                    <br />
                    <span className="text-on-card-soft">mined in the drop zone</span>
                  </p>
                  <img src={PUBG_ICON} alt="PUBG" className="h-10 w-10 rounded-full border border-glass-line" />
                </div>
                <div className="mt-5 flex items-end gap-2" style={{ height: 40 }}>
                  <DotText text={d.balance.toFixed(2)} r={2.4} pitch={6} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[12.5px] text-on-card-soft">
                  <div className="rounded-[12px] bg-glass/20 p-2.5">
                    <p>GRAM balance</p>
                    <p className="text-[16px] font-semibold text-on-card tabular">{fmtGram(d.gram, 6)}</p>
                  </div>
                  <div className="rounded-[12px] bg-glass/20 p-2.5">
                    <p>PUBG price</p>
                    <p className="text-[16px] font-semibold text-on-card tabular">{market?.pubgUsd ? `$${market.pubgUsd.toFixed(8)}` : "—"}</p>
                  </div>
                </div>
                <button className="pill pill--ghost pill--sm mt-4" onClick={() => openTgLink(PUBG_MARKET_URL)}>
                  PUBG chart on STON.fi <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </GlassCard>

            <GlassCard variant="context" className="entrance mt-[var(--gap)]">
              <div className="p-4">
                <p className="card__title text-[17px]">Swap PUBG → GRAM</p>
                <p className="text-[12.5px] text-on-card-soft tabular">
                  1 GRAM = {fmtPubg(market?.pubgPerGram ?? 0, 0)} PUBG · {Math.round((market?.swapFee ?? RULES.swapFee) * 100)}% fee · min {fmtPubg(RULES.swapMinPubg, 0)} PUBG
                </p>
                <div className="mt-3 flex gap-2">
                  <input className="field tabular" inputMode="decimal" placeholder="PUBG amount" value={swapAmt} onChange={(e) => setSwapAmt(e.target.value.replace(",", "."))} />
                  <button className="pill pill--sm !h-12" onClick={() => setSwapAmt(String(Math.floor(d.balance)))}>Max</button>
                </div>
                <p className="mt-2 text-[13px] text-on-card-soft tabular">You get ≈ {fmtGram(swapOut, 6)} GRAM</p>
                <button className="pill mt-3 w-full" disabled={busy === "swap" || swapN < RULES.swapMinPubg || swapN > d.balance} onClick={doSwap}>
                  {busy === "swap" && <Loader2 className="h-4 w-4 animate-spin" />} Swap to GRAM
                </button>
              </div>
            </GlassCard>

            <section className="glass mt-[var(--gap)] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">Withdraw</h2>
                <div className="flex gap-1.5">
                  {(["GRAM", "PUBG"] as const).map((c) => (
                    <button key={c} className="chip !h-7" data-on={currency === c} onClick={() => setCurrency(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Req ok={check?.amountOk ?? false} label={`Minimum ${fmtPubg(withdrawMin(currency), 2)} ${currency} · you have ${currency === "GRAM" ? fmtGram(d.gram, 6) : fmtPubg(d.balance)}`} />
                <Req ok={joined ?? d.joinedCommunity} label="Join our community">
                  {community && (
                    <span className="flex gap-1.5">
                      <button className="pill pill--ink pill--sm !h-7" onClick={() => openTgLink(`https://t.me/${community}`)}>
                        Join
                      </button>
                      <button className="pill pill--sm !h-7" disabled={checking} onClick={verifyCommunity}>
                        {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                      </button>
                    </span>
                  )}
                </Req>
                <Req ok={check?.activityOk ?? false} label={`Invite ${RULES.withdrawAltReferrals} friend or watch ${RULES.withdrawAltAds} videos (${Math.min(d.adsTotal, RULES.withdrawAltAds)}/${RULES.withdrawAltAds})`} />
                <Req ok label={`Network fee ${RULES.withdrawFee} GRAM, paid from your wallet`} />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex gap-2">
                  <input className="field tabular" inputMode="decimal" placeholder={`${currency} amount (min ${withdrawMin(currency)})`} value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
                  <button className="pill pill--sm !h-12" onClick={() => setAmount(String(Math.floor(bal * 10000) / 10000))}>
                    Max
                  </button>
                </div>
                <div className="flex gap-2">
                  <input className="field" placeholder="TON wallet address" value={addr} onChange={(e) => setAddr(e.target.value)} />
                  <button
                    className="pill pill--sm !h-12"
                    aria-label="Connect wallet"
                    onClick={async () => {
                      try {
                        const a = await connectWallet();
                        if (a) setAddr(a);
                      } catch (e) {
                        toast.error(errMsg(e));
                      }
                    }}
                  >
                    <WalletIcon className="h-4 w-4" />
                  </button>
                </div>
                <button className="pill pill--dot w-full" disabled={!check?.ok || !addr || !!busy} onClick={submit}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy === "fee" ? "Confirming fee…" : "Withdraw"}
                </button>
              </div>
            </section>

            {d.withdrawals.length > 0 && (
              <section className="mt-7">
                <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Withdrawals</h2>
                <div className="glass divide-y divide-border/60">
                  {d.withdrawals.map((x) => (
                    <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold tabular">{x.currency === "GRAM" ? fmtGram(x.amount) : fmtPubg(x.amount)} {x.currency}</p>
                        <p className="text-[11.5px] text-copy">{new Date(x.created_at).toLocaleString()}</p>
                      </div>
                      {x.status === "awaiting_fee" ? (
                        <span className="flex gap-1.5">
                          <button
                            className="pill pill--dot pill--sm"
                            disabled={!!busy}
                            onClick={async () => {
                              try {
                                const p = await payWithdrawFeeFn({ data: { ...auth(), id: x.id } });
                                await payFee(p);
                              } catch (e) {
                                toast.error(errMsg(e));
                              }
                            }}
                          >
                            Pay fee
                          </button>
                          <button
                            className="pill pill--sm"
                            onClick={async () => {
                              try {
                                await cancelWithdrawFn({ data: { ...auth(), id: x.id } });
                                toast.success("Cancelled — GRAM returned");
                                await refresh("wallet", "state");
                              } catch (e) {
                                toast.error(errMsg(e));
                              }
                            }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="chip !h-7" data-on={x.status === "paid"}>
                          {x.status === "pending" ? "Processing" : x.status === "paid" ? "Sent" : "Returned"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-7">
              <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Activity</h2>
              <div className="glass divide-y divide-border/60">
                {d.ledger.length === 0 && <p className="p-4 text-[13px] text-copy">No activity yet.</p>}
                {d.ledger.map((l, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-[13.5px] font-medium">{REASONS[l.reason] ?? l.reason}</p>
                      <p className="text-[11px] text-copy">{new Date(l.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`text-[13.5px] font-semibold tabular ${l.amount >= 0 ? "text-success" : "text-ink"}`}>
                      {l.amount >= 0 ? "+" : ""}
                      {l.currency === "GRAM" ? fmtGram(l.amount, 6) : fmtPubg(l.amount, 4)} {l.currency}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </StateGate>
    </div>
  );
}

function Req({ ok, label, children }: { ok: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {ok ? <Check className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-copy/50" />}
      <span className={`flex-1 text-[13px] ${ok ? "text-ink" : "text-copy"}`}>{label}</span>
      {!ok && children}
    </div>
  );
}
