import { describe, expect, it } from "vitest";
import { RULES, adsServerProgress, checkWithdraw, quoteSwap, squadServerReady, toNano } from "@/lib/game-rules";

const base = { currency: "GRAM" as const, amount: 0.5, balance: 5, joinedCommunity: true, referrals: 0, adsTotal: 25 };

describe("withdraw rules", () => {
  it("GRAM withdrawals start at 0.5 GRAM", () => {
    expect(checkWithdraw({ ...base, amount: 0.49 }).ok).toBe(false);
    expect(checkWithdraw({ ...base, amount: 0.5 }).ok).toBe(true);
  });
  it("withdraw fee is 0.05 GRAM", () => {
    expect(RULES.withdrawFee).toBe(0.05);
  });
  it("requires joining the community", () => {
    expect(checkWithdraw({ ...base, joinedCommunity: false }).ok).toBe(false);
  });
  it("needs 1 invite or 25 videos", () => {
    expect(checkWithdraw({ ...base, adsTotal: 24, referrals: 0 }).ok).toBe(false);
    expect(checkWithdraw({ ...base, adsTotal: 0, referrals: 1 }).ok).toBe(true);
    expect(checkWithdraw({ ...base, adsTotal: 25, referrals: 0 }).ok).toBe(true);
  });
});

describe("free servers", () => {
  it("Ad Hunter Crate needs 300 videos", () => {
    expect(adsServerProgress(299, 0).ready).toBe(false);
    expect(adsServerProgress(300, 0).ready).toBe(true);
    expect(adsServerProgress(500, 1).ready).toBe(false);
  });
  it("Squad Beacon needs 50 invites", () => {
    expect(squadServerReady(49, false)).toBe(false);
    expect(squadServerReady(50, false)).toBe(true);
    expect(squadServerReady(80, true)).toBe(false);
  });
});

describe("swap and payments", () => {
  it("swaps PUBG to GRAM at market rate minus 5% fee", () => {
    expect(quoteSwap(11000, 11000)).toBe(0.95);
  });
  it("converts GRAM to nano", () => {
    expect(toNano(0.05)).toBe(50_000_000n);
  });
});

describe("activation and daily contest", () => {
  it("activation costs 0.1 GRAM", () => expect(RULES.activationPrice).toBe(0.1));
  it("daily contest pays 100,000 PUBG to exactly 10 places", () => {
    expect(RULES.contestPool).toBe(100000);
    expect(RULES.contestShares).toHaveLength(10);
    expect(RULES.contestShares.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
