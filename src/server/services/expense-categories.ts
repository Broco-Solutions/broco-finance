import "server-only";
import { prisma } from "@/server/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio."),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export async function listCategories() {
  return prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true } } },
  });
}

export async function createCategory(input: CategoryInput) {
  const data = categorySchema.parse(input);
  try {
    const cat = await prisma.expenseCategory.create({ data: { name: data.name } });
    revalidatePath("/expenses");
    return cat;
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      throw new Error("Ya existe una categoria con ese nombre.");
    }
    throw e;
  }
}

export async function updateCategory(id: string, input: CategoryInput) {
  const data = categorySchema.parse(input);
  try {
    const cat = await prisma.expenseCategory.update({ where: { id }, data: { name: data.name } });
    revalidatePath("/expenses");
    return cat;
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      throw new Error("Ya existe una categoria con ese nombre.");
    }
    throw e;
  }
}

export async function deleteCategory(id: string) {
  const cat = await prisma.expenseCategory.findUnique({
    where: { id },
    select: { _count: { select: { expenses: true } } },
  });
  if (!cat) throw new Error("Categoria no encontrada.");
  if (cat._count.expenses > 0) {
    throw new Error("No se puede eliminar la categoria porque tiene gastos asociados.");
  }
  await prisma.expenseCategory.delete({ where: { id } });
  revalidatePath("/expenses");
}
