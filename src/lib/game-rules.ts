// Pure business rules shared by the server and the UI. Values come from the owner's brief.

export const TREASURY_ADDRESS = "UQAp1QxnLJ2z44IooUovvtVShw7hJBEdxCRV3RlbCYC3D8qj";
export const GRAM_MARKET_URL =
  "https://app.ston.fi/swap?chartVisible=false&ft=GRAM&tt=EQBmR1S2TdeCDMl956IxzoZ7IPx4f-D2s6Fj2seoUxRy1dbG";
export const ADSGRAM_BLOCK_ID = "43448";

export const RULES = {
  withdrawMin: 1,
  withdrawFee: 0.05,
  withdrawAltAds: 25,
  withdrawAltReferrals: 1,
  freeAdsServerGoal: 300,
  freeSquadServerGoal: 50,
  adReward: 0.00005,
  adBoostMinutes: 10,
  adMinGapSeconds: 8,
  adDailyCap: 1000,
  storageHours: 8,
  inviteBonus: 0.002,
  squadL1: 0.2,
  squadL2: 0.05,
  purchaseL1: 0.1,
  purchaseL2: 0.03,
  battlePassPrice: 0.1,
  giftAmount: 0.001,
} as const;

export type WithdrawCheck = {
  amountOk: boolean;
  balanceOk: boolean;
  communityOk: boolean;
  activityOk: boolean;
  ok: boolean;
};

export function checkWithdraw(input: {
  amount: number;
  balance: number;
  joinedCommunity: boolean;
  referrals: number;
  adsTotal: number;
}): WithdrawCheck {
  const amountOk = Number.isFinite(input.amount) && input.amount >= RULES.withdrawMin;
  const balanceOk = input.amount <= input.balance;
  const communityOk = input.joinedCommunity;
  const activityOk =
    input.referrals >= RULES.withdrawAltReferrals || input.adsTotal >= RULES.withdrawAltAds;
  return { amountOk, balanceOk, communityOk, activityOk, ok: amountOk && balanceOk && communityOk && activityOk };
}

/** Ad Hunter Crate can be earned again for every 300 videos watched. */
export function adsServerProgress(adsTotal: number, timesClaimed: number) {
  const used = timesClaimed * RULES.freeAdsServerGoal;
  const progress = Math.max(0, adsTotal - used);
  return { progress: Math.min(progress, RULES.freeAdsServerGoal), ready: progress >= RULES.freeAdsServerGoal };
}

export function squadServerReady(referrals: number, alreadyClaimed: boolean) {
  return !alreadyClaimed && referrals >= RULES.freeSquadServerGoal;
}

export function toNano(amount: number): bigint {
  const [whole = "0", frac = ""] = amount.toFixed(9).split(".");
  return BigInt(whole) * 1_000_000_000n + BigInt(frac.padEnd(9, "0"));
}

export function fmtGram(n: number, digits = 4) {
  if (!Number.isFinite(n)) return "0";
  if (n !== 0 && Math.abs(n) < 0.0001) return n.toFixed(6);
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}
