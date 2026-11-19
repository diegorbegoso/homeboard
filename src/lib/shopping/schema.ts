import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullish();

export const itemFieldsSchema = z.object({
  name: z.string().trim().min(1, "Escribe qué hay que comprar").max(120, "Máximo 120 caracteres"),
  quantity: optionalText(40),
  note: optionalText(200),
});

export const addItemSchema = itemFieldsSchema.extend({ id: z.uuid() });
export const updateItemSchema = itemFieldsSchema.extend({ id: z.uuid() });
export const toggleItemSchema = z.object({ id: z.uuid(), isDone: z.boolean() });
export const itemIdSchema = z.object({ id: z.uuid() });

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  note: string | null;
  is_done: boolean;
  created_at: string;
  deleted_at: string | null;
};
