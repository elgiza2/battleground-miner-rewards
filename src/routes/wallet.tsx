import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Circle, ExternalLink, Loader2, Wallet as WalletIcon } from "@/components/game/GlassIcons";
import { useWallet, useGameState, auth, errMsg, useRefresh } from "@/hooks/use-game";
import { Masthead, StateGate } from "@/components/game/Masthead";
import { GlassCard } from "@/components/game/GlassCard";
import { DotText } from "@/components/game/DotText";
import { waitForPayment } from "@/components/game/PaySheet";
import { cancelWithdrawFn, checkCommunityFn, payWithdrawFeeFn, requestWithdrawFn, swapFn } from "@/lib/game.functions";
import { connectWallet, payWithWallet, walletAddress } from "@/lib/ton-client";
import { PUBG_MARKET_URL, RULES, checkWithdraw, fmtGram, fmtPubg, quoteSwap, withdrawMin, type Currency } from "@/lib/game-rules";
import { art } from "@/lib/art";
import { Button } from "@/components/ui/button";
import { haptic, openTgLink } from "@/lib/telegram-client";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet & withdrawals — PUBG" },
      { name: "description", content: "Swap mined $PUBG to GRAM and withdraw to any TON wallet." },
      { property: "og:title", content: "Wallet & withdrawals — PUBG" },
      { property: "og:description", content: "Swap PUBG to GRAM and cash out from 0.5 GRAM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [step, setStep] = useState<0 | 1 | 2>(0);
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
      setStep(0);
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
                  <img src={art("logo")} alt="PUBG" className="h-10 w-10 rounded-full border border-glass-line" />
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
                <Button variant="ghost" className="pill pill--ghost pill--sm mt-4" onClick={() => openTgLink(PUBG_MARKET_URL)}>
                  PUBG chart on STON.fi <ExternalLink className="h-3.5 w-3.5" />
                </Button>
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
                  <Button variant="ghost" className="pill pill--sm !h-12" onClick={() => setSwapAmt(String(Math.floor(d.balance)))}>Max</Button>
                </div>
                <p className="mt-2 text-[13px] text-on-card-soft tabular">You get ≈ {fmtGram(swapOut, 6)} GRAM</p>
                <Button variant="ghost" className="pill mt-3 w-full" disabled={busy === "swap" || swapN < RULES.swapMinPubg || swapN > d.balance} onClick={doSwap}>
                  {busy === "swap" && <Loader2 className="h-4 w-4 animate-spin" />} Swap to GRAM
                </Button>
              </div>
            </GlassCard>

            <section className="withdraw-flow mt-7" aria-label="Withdrawal">
              <div className="flex items-center justify-between">
                <h2 className="text-[21px] font-semibold">Withdraw</h2>
                <WalletIcon className="h-9 w-9" />
              </div>
              <div className="mb-5 grid grid-cols-3 gap-3" aria-label="Withdrawal steps">
                {["1 · Amount", "2 · Destination", "3 · Review"].map((label, i) => (
                  <span key={label} className="withdraw-step" data-current={step === i} aria-current={step === i ? "step" : undefined}>{label}</span>
                ))}
              </div>
              {step === 0 && (
                <div className="space-y-4">
                  <div className="flex gap-2" role="group" aria-label="Withdrawal currency">
                    {(["GRAM", "PUBG"] as const).map((c) => (
                      <Button key={c} variant="ghost" className="chip" data-on={currency === c} aria-pressed={currency === c} onClick={() => { setCurrency(c); setAmount(""); }}>{c}</Button>
                    ))}
                  </div>
                  <p className="text-[13px] text-copy">Available <b className="text-ink tabular">{currency === "GRAM" ? fmtGram(bal, 6) : fmtPubg(bal)} {currency}</b> · Minimum {withdrawMin(currency)}</p>
                  <label className="block text-[13px] font-medium" htmlFor="withdraw-amount">Amount</label>
                  <div className="flex gap-2">
                    <input id="withdraw-amount" className="field tabular" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} />
                    <Button variant="ghost" className="pill pill--sm !h-12" onClick={() => setAmount(String(Math.floor(bal * 10000) / 10000))}>Max</Button>
                  </div>
                  {amount && !check?.amountOk && <p className="text-[12px] text-copy" role="status">Enter at least {withdrawMin(currency)} {currency}.</p>}
                  {amt > bal && <p className="text-[12px] text-copy" role="status">Amount exceeds your available balance.</p>}
                  <Button variant="ghost" className="pill pill--dot w-full" disabled={!check?.amountOk || !Number.isFinite(amt) || amt > bal || !!busy} onClick={() => setStep(1)}>Continue</Button>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-4">
                  <label className="block text-[13px] font-medium" htmlFor="withdraw-address">Receiving TON wallet</label>
                  <input id="withdraw-address" className="field" placeholder="UQ… or EQ…" value={addr} onChange={(e) => setAddr(e.target.value)} />
                  <Button variant="ghost" className="pill w-full" onClick={async () => {
                    try { const a = await connectWallet(); if (a) setAddr(a); }
                    catch (e) { toast.error(errMsg(e)); }
                  }}><WalletIcon className="h-5 w-5" /> Connect wallet</Button>
                  <div className="space-y-3 border-y border-border py-4">
                    <Req ok={joined ?? d.joinedCommunity} label="Community membership">
                      {community && <span className="flex flex-wrap gap-1.5">
                        <Button variant="ghost" className="pill pill--sm" onClick={() => openTgLink(`https://t.me/${community}`)}>Join</Button>
                        <Button variant="ghost" className="pill pill--sm" disabled={checking} onClick={verifyCommunity}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}</Button>
                      </span>}
                    </Req>
                    <Req ok={check?.activityOk ?? false} label={`${RULES.withdrawAltReferrals} referral or ${RULES.withdrawAltAds} videos · ${Math.min(d.adsTotal, RULES.withdrawAltAds)}/${RULES.withdrawAltAds} videos`} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="pill flex-1" onClick={() => setStep(0)}>Back</Button>
                    <Button variant="ghost" className="pill pill--dot flex-1" disabled={!check?.ok || !addr.trim() || !!busy} onClick={() => setStep(2)}>Review</Button>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <dl className="withdraw-review text-[14px]">
                    <div><dt className="text-copy">You receive</dt><dd className="tabular">{currency === "GRAM" ? fmtGram(amt, 6) : fmtPubg(amt)} {currency}</dd></div>
                    <div><dt className="text-copy">To wallet</dt><dd className="font-mono text-[12px]">{addr}</dd></div>
                    <div><dt className="text-copy">Separate fee</dt><dd>{RULES.withdrawFee} GRAM</dd></div>
                  </dl>
                  <p className="mb-5 text-[13px] leading-relaxed text-copy">The amount is reserved when you confirm. Pay the separate {RULES.withdrawFee} GRAM fee from your connected wallet to queue the payout. You can cancel an unpaid request below.</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="pill" disabled={!!busy} onClick={() => setStep(1)}>Back</Button>
                    <Button variant="ghost" className="pill pill--dot flex-1" disabled={!check?.ok || !addr.trim() || !!busy} onClick={submit}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy === "fee" ? "Confirming fee…" : "Confirm & pay fee"}
                    </Button>
                  </div>
                </div>
              )}
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
                          <Button variant="ghost"
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
                          </Button>
                          <Button variant="ghost"
                            className="pill pill--sm"
                            onClick={async () => {
                              try {
                                await cancelWithdrawFn({ data: { ...auth(), id: x.id } });
                                toast.success("Cancelled — balance returned");
                                await refresh("wallet", "state");
                              } catch (e) {
                                toast.error(errMsg(e));
                              }
                            }}
                          >
                            Cancel
                          </Button>
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
