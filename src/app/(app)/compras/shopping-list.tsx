"use client";

import { Trash } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useOptimistic, useRef, useState, useTransition } from "react";
import { Toaster, toast } from "sonner";
import type { ShoppingItem } from "@/lib/shopping/schema";
import { itemFieldsSchema } from "@/lib/shopping/schema";
import { addItem, deleteItem, restoreItem, toggleItem, updateItem } from "./actions";
import { useRealtimeItems } from "./use-realtime-items";

type OptimisticAction =
  | { type: "add"; item: ShoppingItem }
  | { type: "toggle"; id: string; isDone: boolean }
  | { type: "delete"; id: string }
  | { type: "restore"; item: ShoppingItem }
  | { type: "update"; id: string; name: string; quantity: string | null; note: string | null };

// The realtime echo of our own write can arrive before the Server Action resolves: never list an id twice.
function upsertItem(state: ShoppingItem[], item: ShoppingItem): ShoppingItem[] {
  return state.some((it) => it.id === item.id) ? state.map((it) => (it.id === item.id ? item : it)) : [...state, item];
}

function applyOptimistic(state: ShoppingItem[], action: OptimisticAction): ShoppingItem[] {
  switch (action.type) {
    case "add":
      return upsertItem(state, action.item);
    case "toggle":
      return state.map((item) => (item.id === action.id ? { ...item, is_done: action.isDone } : item));
    case "delete":
      return state.filter((item) => item.id !== action.id);
    case "restore":
      return upsertItem(state, action.item);
    case "update":
      return state.map((item) =>
        item.id === action.id ? { ...item, name: action.name, quantity: action.quantity, note: action.note } : item,
      );
  }
}

export function ShoppingList({ initialItems, householdId }: { initialItems: ShoppingItem[]; householdId: string }) {
  const [confirmedItems, setConfirmedItems] = useState(initialItems);
  const [optimisticItems, dispatch] = useOptimistic(confirmedItems, applyOptimistic);
  const [, startTransition] = useTransition();
  const shouldReduceMotion = useReducedMotion() ?? false;

  const arrivalRef = useRef<{ counter: number; timer: ReturnType<typeof setTimeout> | null }>({
    counter: 0,
    timer: null,
  });
  const remoteDelays = useRef<Map<string, number>>(new Map());

  const handleRemoteChange = useCallback((incoming: ShoppingItem) => {
    setConfirmedItems((prev) => {
      if (incoming.deleted_at) {
        remoteDelays.current.delete(incoming.id);
        return prev.filter((it) => it.id !== incoming.id);
      }
      const exists = prev.some((it) => it.id === incoming.id);
      if (exists) {
        return prev.map((it) => (it.id === incoming.id ? incoming : it));
      }
      // New item from realtime — assign stagger delay
      const ref = arrivalRef.current;
      if (ref.timer) clearTimeout(ref.timer);
      const delay = ref.counter * 40;
      ref.counter += 1;
      ref.timer = setTimeout(() => {
        ref.counter = 0;
        ref.timer = null;
      }, 400);
      remoteDelays.current.set(incoming.id, delay);
      return [...prev, incoming];
    });
  }, []);

  const { live } = useRealtimeItems(householdId, handleRemoteChange);

  const spring = { type: "spring" as const, stiffness: 500, damping: 40 };

  const pending = optimisticItems.filter((item) => !item.is_done);
  const done = optimisticItems.filter((item) => item.is_done);

  async function handleAdd(formData: FormData) {
    const name = (formData.get("name") as string)?.trim() ?? "";
    const quantity = (formData.get("quantity") as string)?.trim() || undefined;
    const parsed = itemFieldsSchema.safeParse({ name, quantity: quantity ?? "", note: "" });
    if (!parsed.success) return;

    const id = crypto.randomUUID();
    const optimisticItem: ShoppingItem = {
      id,
      name: parsed.data.name,
      quantity: parsed.data.quantity ?? null,
      note: null,
      is_done: false,
      created_at: new Date().toISOString(),
      deleted_at: null,
    };
    dispatch({ type: "add", item: optimisticItem });
    const result = await addItem({ id, name: parsed.data.name, quantity: parsed.data.quantity, note: null });
    if (result.ok) setConfirmedItems((prev) => upsertItem(prev, optimisticItem));
  }

  function handleDelete(item: ShoppingItem) {
    startTransition(async () => {
      dispatch({ type: "delete", id: item.id });
      const result = await deleteItem({ id: item.id });
      if (result.ok) setConfirmedItems((prev) => prev.filter((it) => it.id !== item.id));
    });
    toast(`Borraste ${item.name}`, {
      duration: 5000,
      action: {
        label: "Deshacer",
        onClick: () => {
          startTransition(async () => {
            dispatch({ type: "restore", item });
            const result = await restoreItem({ id: item.id });
            if (result.ok) setConfirmedItems((prev) => upsertItem(prev, item));
          });
        },
      },
    });
  }

  function handleToggle(item: ShoppingItem) {
    const isDone = !item.is_done;
    startTransition(async () => {
      dispatch({ type: "toggle", id: item.id, isDone });
      await toggleItem({ id: item.id, isDone });
    });
  }

  function handleUpdate(item: ShoppingItem, newName: string) {
    const parsed = itemFieldsSchema.safeParse({ name: newName, quantity: "", note: "" });
    if (!parsed.success) return;
    startTransition(async () => {
      dispatch({ type: "update", id: item.id, name: parsed.data.name, quantity: item.quantity, note: item.note });
      const result = await updateItem({
        id: item.id,
        name: parsed.data.name,
        quantity: item.quantity,
        note: item.note,
      });
      if (result.ok) {
        setConfirmedItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, name: parsed.data.name } : it)));
      }
    });
  }

  function renderItem(item: ShoppingItem) {
    return (
      <ItemRow
        key={item.id}
        item={item}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        shouldReduceMotion={shouldReduceMotion}
        spring={spring}
        remoteDelay={remoteDelays.current.get(item.id) ?? 0}
      />
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />

      {!live && (
        <p role="status" className="text-sm text-muted-foreground">
          Sin sincronización en vivo — recarga para ver lo último
        </p>
      )}

      <AddForm onAdd={handleAdd} />

      {pending.length > 0 && <h2 className="text-lg font-heading font-extrabold">Por comprar</h2>}
      <ul className="flex flex-col divide-y divide-border">
        <AnimatePresence>{pending.map(renderItem)}</AnimatePresence>
      </ul>

      {optimisticItems.length === 0 && <p className="text-center text-muted-foreground">Nada por comprar. ¡Qué paz!</p>}

      {done.length > 0 && <h2 className="text-lg font-heading font-extrabold">Comprado</h2>}
      <ul className="flex flex-col divide-y divide-border">
        <AnimatePresence>{done.map(renderItem)}</AnimatePresence>
      </ul>
    </>
  );
}

type SpringConfig = { type: "spring"; stiffness: number; damping: number };

function AddForm({ onAdd }: { onAdd: (formData: FormData) => Promise<void> }) {
  const [addError, setAddError] = useState<string | null>(null);

  async function action(formData: FormData) {
    const name = (formData.get("name") as string)?.trim() ?? "";
    const quantity = (formData.get("quantity") as string)?.trim() || undefined;
    const parsed = itemFieldsSchema.safeParse({ name, quantity: quantity ?? "", note: "" });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setAddError(null);
    await onAdd(formData);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="item-name" className="text-sm font-medium">
          Qué hay que comprar
        </label>
        <input
          id="item-name"
          name="name"
          type="text"
          className="rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-quantity" className="text-sm font-medium">
          Cantidad
        </label>
        <input
          id="item-quantity"
          name="quantity"
          type="text"
          className="rounded-input border border-border bg-muted px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
      {addError && (
        <p role="alert" className="text-sm text-destructive">
          {addError}
        </p>
      )}
      <button type="submit" className="rounded-full bg-primary py-3 text-sm font-medium text-on-primary">
        Añadir
      </button>
    </form>
  );
}

function ItemRow({
  item,
  onToggle,
  onDelete,
  onUpdate,
  shouldReduceMotion,
  spring,
  remoteDelay,
}: {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  onUpdate: (item: ShoppingItem, name: string) => void;
  shouldReduceMotion: boolean;
  spring: SpringConfig;
  remoteDelay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  return (
    <motion.li
      data-testid="item"
      layout={!shouldReduceMotion}
      initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: 6, transition: { duration: 0.1 } }}
      transition={shouldReduceMotion ? {} : { ...spring, delay: remoteDelay / 1000 }}
      className="flex min-h-11 items-center gap-3 py-2"
    >
      <input
        type="checkbox"
        checked={item.is_done}
        onChange={() => onToggle(item)}
        aria-label={item.name}
        className="h-5 w-5 shrink-0 accent-primary"
      />
      <span className={`flex-1 text-sm ${item.is_done ? "line-through text-muted-foreground" : ""}`}>
        {editing ? (
          <span className="flex gap-2 items-center">
            <input
              aria-label="Nombre"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-input border border-border bg-muted px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => {
                onUpdate(item, editName);
                setEditing(false);
              }}
              className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-on-primary min-h-11"
            >
              Guardar
            </button>
          </span>
        ) : (
          <>
            {item.name}
            {item.quantity && <span className="ml-1 text-xs text-muted-foreground">({item.quantity})</span>}
          </>
        )}
      </span>
      {!editing && (
        <>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setEditName(item.name);
            }}
            className="min-h-11 px-2 text-xs text-muted-foreground"
          >
            Editar {item.name}
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            aria-label={`Borrar ${item.name}`}
            className="min-h-11 px-2 text-destructive"
          >
            <Trash size={18} />
          </button>
        </>
      )}
    </motion.li>
  );
}
