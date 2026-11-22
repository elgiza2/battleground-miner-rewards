// Pure business rules shared by the server and the UI. Values come from the owner's brief.

export const TREASURY_ADDRESS = "UQAp1QxnLJ2z44IooUovvtVShw7hJBEdxCRV3RlbCYC3D8qj";
export const COIN = "PUBG";
export const PUBG_JETTON = "EQBmR1S2TdeCDMl956IxzoZ7IPx4f-D2s6Fj2seoUxRy1dbG";
export const PUBG_MARKET_URL = `https://app.ston.fi/swap?chartVisible=false&ft=GRAM&tt=${PUBG_JETTON}`;
export const PUBG_ICON = `https://asset.ston.fi/img/${PUBG_JETTON}/492ec6c52f41364c6b703130d3ea1156d0dd7947830fc35682f093603d4ddeab`;
export const MONETAG_ZONE = "12323205";

export const RULES = {
  withdrawMinPubg: 10000,
  withdrawMinGram: 0.5,
  withdrawFee: 0.05, // GRAM, paid from the player's wallet
  withdrawAltAds: 25,
  withdrawAltReferrals: 1,
  freeAdsServerGoal: 300,
  freeSquadServerGoal: 50,
  adReward: 0.5, // PUBG per video
  adBoostMinutes: 10,
  adMinGapSeconds: 8,
  adDailyCap: 1000,
  storageHours: 8,
  inviteBonus: 25, // PUBG
  recruitActiveBonus: 30, // PUBG, when a recruit watches 10 videos
  squadL1: 0.2,
  squadL2: 0.05,
  purchaseL1: 0.1, // of GRAM spent, paid in GRAM
  purchaseL2: 0.03,
  battlePassPrice: 0.1, // GRAM
  giftAmount: 10, // PUBG
  swapFee: 0.05,
  swapMinPubg: 1000,
} as const;

export type Currency = "PUBG" | "GRAM";

export type WithdrawCheck = {
  amountOk: boolean;
  balanceOk: boolean;
  communityOk: boolean;
  activityOk: boolean;
  ok: boolean;
};

export const withdrawMin = (c: Currency) => (c === "GRAM" ? RULES.withdrawMinGram : RULES.withdrawMinPubg);

export function checkWithdraw(input: {
  currency: Currency;
  amount: number;
  balance: number;
  joinedCommunity: boolean;
  referrals: number;
  adsTotal: number;
}): WithdrawCheck {
  const amountOk = Number.isFinite(input.amount) && input.amount >= withdrawMin(input.currency);
  const balanceOk = input.amount <= input.balance;
  const communityOk = input.joinedCommunity;
  const activityOk =
    input.referrals >= RULES.withdrawAltReferrals || input.adsTotal >= RULES.withdrawAltAds;
  return { amountOk, balanceOk, communityOk, activityOk, ok: amountOk && balanceOk && communityOk && activityOk };
}

/** GRAM received for swapping PUBG at the market rate, minus the swap fee. */
export function quoteSwap(pubg: number, pubgPerGram: number, fee: number = RULES.swapFee) {
  if (!(pubg > 0) || !(pubgPerGram > 0)) return 0;
  return Math.floor((pubg / pubgPerGram) * (1 - fee) * 1e6) / 1e6;
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

export function fmtPubg(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}
