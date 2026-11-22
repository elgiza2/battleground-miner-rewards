// TON Connect wallet payments (browser only; loaded on demand).
import type { TonConnectUI } from "@tonconnect/ui";

let ui: TonConnectUI | null = null;

export async function getTonConnect() {
  if (ui) return ui;
  const { TonConnectUI } = await import("@tonconnect/ui");
  ui = new TonConnectUI({ manifestUrl: `${window.location.origin}/api/public/tonconnect-manifest` });
  return ui;
}

async function ensureConnected(t: TonConnectUI) {
  await t.connectionRestored;
  if (t.connected) return;
  await t.openModal();
  await new Promise<void>((resolve, reject) => {
    const off = t.onStatusChange((w) => {
      if (w) {
        off();
        resolve();
      }
    });
    const offModal = t.onModalStateChange((s) => {
      if (s.status === "closed" && !t.connected) {
        off();
        offModal();
        reject(new Error("Wallet not connected"));
      }
    });
  });
}

export async function payWithWallet(p: { address: string; amountNano: string; payload: string }) {
  const t = await getTonConnect();
  await ensureConnected(t);
  await t.sendTransaction({
    validUntil: Math.floor(Date.now() / 1000) + 600,
    messages: [{ address: p.address, amount: p.amountNano, payload: p.payload }],
  });
  return t.account?.address ?? null;
}

export async function walletAddress() {
  const t = await getTonConnect();
  await t.connectionRestored;
  return t.account?.address ?? null;
}

export async function connectWallet() {
  const t = await getTonConnect();
  await ensureConnected(t);
  return t.account?.address ?? null;
}
