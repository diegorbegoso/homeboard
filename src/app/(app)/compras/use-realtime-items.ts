"use client";

import { useEffect, useState } from "react";
import type { ShoppingItem } from "@/lib/shopping/schema";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeItems(householdId: string, onChange: (item: ShoppingItem) => void): { live: boolean } {
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!householdId) return;

    const supabase = createClient();

    let channel = supabase.channel(`compras:${householdId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "shopping_items",
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        onChange(payload.new as ShoppingItem);
      },
    );

    supabase.realtime
      .setAuth()
      .then(() => {
        channel = channel.subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setLive(false);
          } else if (status === "SUBSCRIBED") {
            setLive(true);
          }
        });
      })
      .catch(() => {
        setLive(false);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, onChange]);

  return { live };
}
