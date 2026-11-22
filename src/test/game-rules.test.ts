import { describe, expect, it } from "vitest";
import { RULES, adsServerProgress, checkWithdraw, squadServerReady, toNano } from "@/lib/game-rules";

const base = { amount: 1, balance: 5, joinedCommunity: true, referrals: 0, adsTotal: 25 };

describe("withdraw rules", () => {
  it("minimum withdrawal is 1 GRAM", () => {
    expect(checkWithdraw({ ...base, amount: 0.99 }).ok).toBe(false);
    expect(checkWithdraw({ ...base, amount: 1 }).ok).toBe(true);
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

describe("payments", () => {
  it("converts GRAM to nano", () => {
    expect(toNano(0.05)).toBe(50_000_000n);
  });
});
