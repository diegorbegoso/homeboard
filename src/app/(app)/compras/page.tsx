import type { Metadata } from "next";
import type { ShoppingItem } from "@/lib/shopping/schema";
import { createClient } from "@/lib/supabase/server";
import { ShoppingList } from "./shopping-list";

export const metadata: Metadata = { title: "Compras — HomeBoard" };

export default async function ComprasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const { data: items } = membership
    ? await supabase
        .from("shopping_items")
        .select("id, name, quantity, note, is_done, created_at, deleted_at")
        .eq("household_id", membership.household_id)
        .is("deleted_at", null)
        .order("is_done", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: null };

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-8">
      <h1>Compras</h1>
      <ShoppingList
        initialItems={(items as ShoppingItem[] | null) ?? []}
        householdId={membership?.household_id ?? ""}
      />
    </main>
  );
}
