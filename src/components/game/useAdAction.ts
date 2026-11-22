import { useState } from "react";
import { toast } from "sonner";
import { showRewardedVideo } from "@/lib/ads";
import { recordAdFn } from "@/lib/game.functions";
import { auth, errMsg, useRefresh } from "@/hooks/use-game";
import { haptic } from "@/lib/telegram-client";
import { RULES } from "@/lib/game-rules";

/** Watch one rewarded video and credit it on the server. */
export function useAdAction() {
  const [busy, setBusy] = useState(false);
  const refresh = useRefresh();
  const watch = async (opts: { silent?: boolean } = {}) => {
    if (busy) return false;
    setBusy(true);
    try {
      const done = await showRewardedVideo();
      if (!done) {
        toast("Watch to the end to get the loot");
        return false;
      }
      const r = await recordAdFn({ data: auth() });
      if (!r.ok) {
        toast(r.error);
        return false;
      }
      haptic("success");
      if (!opts.silent) toast.success(`+${RULES.adReward} PUBG · +${RULES.adBoostMinutes} min 2x boost`, { description: `${r.adsToday} videos today` });
      await refresh("state", "missions");
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { watch, busy };
}
