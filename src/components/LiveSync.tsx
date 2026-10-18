"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Lightweight real-time sync: poll the group's change marker and re-render the
 * server components when a friend adds or edits something. Swap for Supabase
 * Realtime / websockets later without touching the rest of the page.
 */
export function LiveSync({ groupId, version }: { groupId: string; version: number }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/g/${groupId}/version`, { cache: "no-store" });
        const { version: latest } = (await res.json()) as { version: number };
        if (!cancelled && latest !== version) router.refresh();
      } catch {
        // offline or server restarting: try again next tick
      }
    };
    const timer = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [groupId, version, router]);
  return null;
}
