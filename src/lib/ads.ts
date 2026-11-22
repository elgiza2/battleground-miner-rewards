import { ADSGRAM_BLOCK_ID } from "./game-rules";

type AdController = { show: () => Promise<{ done?: boolean; error?: boolean }> };
type AdsgramApi = { init: (o: { blockId: string }) => AdController };

let controller: AdController | null = null;

/** Shows one rewarded video. Resolves true only when the viewer finished it. */
export async function showRewardedVideo(): Promise<boolean> {
  const api = (window as unknown as { Adsgram?: AdsgramApi }).Adsgram;
  if (!api?.init) {
    if (import.meta.env.DEV) {
      await new Promise((r) => setTimeout(r, 900));
      return true;
    }
    throw new Error("Videos are available inside Telegram");
  }
  controller ??= api.init({ blockId: ADSGRAM_BLOCK_ID });
  try {
    const r = await controller.show();
    return r?.done !== false;
  } catch {
    return false;
  }
}
