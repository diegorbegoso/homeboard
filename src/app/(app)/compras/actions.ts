"use server";

import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import type { PushPayload } from "@/lib/push/send";
import { buildItemPush, sendPushToHousehold } from "@/lib/push/send";
import type { ShoppingItem } from "@/lib/shopping/schema";
import { addItemSchema, itemIdSchema, toggleItemSchema, updateItemSchema } from "@/lib/shopping/schema";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const ITEM_SELECT = "id, name, quantity, note, is_done, created_at, deleted_at" as const;

function notify(householdId: string, exceptUserId: string, payload: PushPayload): void {
  void sendPushToHousehold(householdId, exceptUserId, payload).catch((err) =>
    log.error("push.failed", { message: String(err) }),
  );
}

export async function addItem(input: unknown): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_autenticado" };

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "sin_hogar" };

  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "datos_invalidos" };

  const { error } = await supabase.from("shopping_items").upsert(
    {
      id: parsed.data.id,
      name: parsed.data.name,
      quantity: parsed.data.quantity ?? null,
      note: parsed.data.note ?? null,
      household_id: membership.household_id,
      created_by: user.id,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "error_inesperado" };

  void supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle()
    .then(({ data: profile }) => {
      notify(
        membership.household_id,
        user.id,
        buildItemPush("added", profile?.display_name ?? "Alguien", parsed.data.name),
      );
    });

  revalidatePath("/compras");
  return { ok: true };
}

export async function updateItem(input: unknown): Promise<ActionResult<ShoppingItem>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_autenticado" };

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "sin_hogar" };

  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "datos_invalidos" };

  const { data, error } = await supabase
    .from("shopping_items")
    .update({ name: parsed.data.name, quantity: parsed.data.quantity ?? null, note: parsed.data.note ?? null })
    .eq("id", parsed.data.id)
    .select(ITEM_SELECT)
    .maybeSingle();
  if (error) return { ok: false, error: "error_inesperado" };
  if (!data) return { ok: false, error: "no_encontrado" };

  revalidatePath("/compras");
  return { ok: true, data };
}

export async function toggleItem(input: unknown): Promise<ActionResult<ShoppingItem>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_autenticado" };

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "sin_hogar" };

  const parsed = toggleItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "datos_invalidos" };

  const { isDone, id } = parsed.data;
  const { data, error } = await supabase
    .from("shopping_items")
    .update({
      is_done: isDone,
      done_by: isDone ? user.id : null,
      done_at: isDone ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select(ITEM_SELECT)
    .maybeSingle();
  if (error) return { ok: false, error: "error_inesperado" };
  if (!data) return { ok: false, error: "no_encontrado" };

  if (isDone) {
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: profile }) => {
        notify(membership.household_id, user.id, buildItemPush("done", profile?.display_name ?? "Alguien", data.name));
      });
  }

  revalidatePath("/compras");
  return { ok: true, data };
}

export async function deleteItem(input: unknown): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_autenticado" };

  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "datos_invalidos" };

  const { data, error } = await supabase
    .from("shopping_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "error_inesperado" };
  if (!data) return { ok: false, error: "no_encontrado" };

  revalidatePath("/compras");
  return { ok: true };
}

export async function restoreItem(input: unknown): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_autenticado" };

  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "datos_invalidos" };

  const { data, error } = await supabase
    .from("shopping_items")
    .update({ deleted_at: null })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "error_inesperado" };
  if (!data) return { ok: false, error: "no_encontrado" };

  revalidatePath("/compras");
  return { ok: true };
}
