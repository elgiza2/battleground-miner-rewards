import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchCatalog, fetchMissions, fetchSquad, fetchState, fetchWallet } from "@/lib/game.functions";
import { initData } from "@/lib/telegram-client";

export function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export const auth = () => ({ initData: initData() });

export function useGameState() {
  const ready = useReady();
  return useQuery({
    queryKey: ["state"],
    queryFn: () => fetchState({ data: auth() }),
    enabled: ready,
    refetchInterval: 60_000,
    retry: 1,
  });
}
export function useCatalog() {
  const ready = useReady();
  return useQuery({ queryKey: ["catalog"], queryFn: () => fetchCatalog({ data: auth() }), enabled: ready });
}
export function useMissions() {
  const ready = useReady();
  return useQuery({ queryKey: ["missions"], queryFn: () => fetchMissions({ data: auth() }), enabled: ready });
}
export function useSquad() {
  const ready = useReady();
  return useQuery({ queryKey: ["squad"], queryFn: () => fetchSquad({ data: auth() }), enabled: ready });
}
export function useWallet() {
  const ready = useReady();
  return useQuery({ queryKey: ["wallet"], queryFn: () => fetchWallet({ data: auth() }), enabled: ready });
}

export function useRefresh() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all((keys.length ? keys : ["state", "catalog", "missions", "squad", "wallet"]).map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export const errMsg = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? "Something went wrong";
  return m.length > 140 ? "Something went wrong. Try again." : m;
};
