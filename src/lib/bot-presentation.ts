export const BOT_LAUNCH_URL = "https://t.me/Dropeybot?startapp";

// IDs verified with Telegram getStickerSet("NewsEmoji"). Never substitute another pack.
export const NEWS_EMOJI: Record<string, { id: string; emoji: string }> = {
  play: { id: "5264919878082509254", emoji: "▶️" },
  fire: { id: "5424972470023104089", emoji: "🔥" },
  news: { id: "5424818078833715060", emoji: "📣" },
  server: { id: "5282843764451195532", emoji: "🖥" },
  gem: { id: "5427168083074628963", emoji: "💎" },
  crown: { id: "5217822164362739968", emoji: "👑" },
  check: { id: "5206607081334906820", emoji: "✔️" },
  shield: { id: "5251203410396458957", emoji: "🛡" },
  bolt: { id: "5456140674028019486", emoji: "⚡️" },
};

export function stripEmoji(text: string) {
  return text.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\u20E3]/gu, "");
}

export function newsEmoji(key: string) {
  const item = NEWS_EMOJI[key];
  return item ? `<tg-emoji emoji-id="${item.id}">${item.emoji}</tg-emoji>` : "";
}

export function boldBotHtml(html: string) {
  const custom: string[] = [];
  const held = html.replace(/<tg-emoji emoji-id="(\d+)">[\s\S]*?<\/tg-emoji>/g, (_match, id: string) => {
    const item = Object.values(NEWS_EMOJI).find((e) => e.id === id);
    if (!item) return "";
    custom.push(`<tg-emoji emoji-id="${item.id}">${item.emoji}</tg-emoji>`);
    return `NEWS_EMOJI_${custom.length - 1}_END`;
  });
  const clean = stripEmoji(held).replace(/<\/?(?:b|strong)>/g, "");
  return `<b>${clean.replace(/NEWS_EMOJI_(\d+)_END/g, (_m, index: string) => custom[Number(index)] ?? "")}</b>`;
}

export function startCaption(name: string) {
  const safe = name.toUpperCase().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return boldBotHtml(`${newsEmoji("play")} WELCOME TO PUBG, ${safe}\n\nMine PUBG. Swap to GRAM. Cash out.\n\n${newsEmoji("server")} Deploy servers — mine around the clock\n${newsEmoji("gem")} Open airdrop crates — instant loot\n${newsEmoji("fire")} Build your squad — earn 20% of their mining\n\nActivate mining for 0.1 GRAM. Tap PLAY.`);
}