import { MONETAG_ZONE } from "./game-rules";

const SDK_FN = `show_${MONETAG_ZONE}`;
let loading: Promise<void> | null = null;

/** Injects the Monetag SDK once (browser only). */
export function loadAdSdk() {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as Record<string, unknown>)[SDK_FN]) return Promise.resolve();
  loading ??= new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://libtl.com/sdk.js";
    s.async = true;
    s.dataset["zone"] = MONETAG_ZONE;
    s.dataset["sdk"] = SDK_FN;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return loading;
}

/** Shows one rewarded video. Resolves true only when the viewer finished it. */
export async function showRewardedVideo(): Promise<boolean> {
  await loadAdSdk();
  const show = (window as unknown as Record<string, unknown>)[SDK_FN] as undefined | (() => Promise<unknown>);
  if (typeof show !== "function") {
    if (import.meta.env.DEV) {
      await new Promise((r) => setTimeout(r, 900));
      return true;
    }
    throw new Error("Video is loading — try again in a moment");
  }
  try {
    await show();
    return true;
  } catch {
    return false;
  }
}
