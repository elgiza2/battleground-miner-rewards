import { describe, expect, it } from "vitest";
import { BOT_LAUNCH_URL, NEWS_EMOJI, boldBotHtml, newsEmoji, startCaption } from "@/lib/bot-presentation";

describe("Bot presentation rules", () => {
  it("uses the user's exact mini app launch destination", () => {
    expect(BOT_LAUNCH_URL).toBe("https://t.me/Dropeybot?startapp");
  });
  it("retains only verified NewsEmoji custom emoji", () => {
    expect(boldBotHtml('🎁 <tg-emoji emoji-id="1">🔥</tg-emoji>' + newsEmoji("play")))
      .toBe(`<b> ${newsEmoji("play")}</b>`);
    expect(NEWS_EMOJI["play"]?.id).toBe("5264919878082509254");
  });
  it("makes the whole bot message bold", () => {
    expect(boldBotHtml("<b>Title</b>\nBody")).toBe("<b>Title\nBody</b>");
  });
  it("escapes player names in start messages", () => {
    expect(startCaption("<player>")).toContain("&lt;PLAYER&gt;");
  });
});