import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";
import { RecipeForm } from "@/components/recipes/create-recipe-form";
import type { IngredientJSON, StepJSON } from "@/lib/types";
import type { Prisma } from "@prisma/client";

function castJsonArray<T>(
  value: Prisma.JsonValue | null | undefined
): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const { recipeId } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: {
      id: recipeId,
      userId: session.user.id,
    },
  });

  if (!recipe) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Edit recipe
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Update {recipe.title}
          </h1>
          <p className="text-sm text-zinc-500">
            Adjust ingredients or steps, then save to keep things in sync on web
            and mobile.
          </p>
        </div>
        <Link
          href="/recipes"
          className="rounded-full border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          Back to recipes
        </Link>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-8">
        <RecipeForm
          mode="edit"
          recipeId={recipe.id}
          initialData={{
            title: recipe.title,
            description: recipe.description,
            ingredients: castJsonArray<IngredientJSON>(
              recipe.ingredients as Prisma.JsonValue
            ),
            steps: castJsonArray<StepJSON>(
              recipe.steps as Prisma.JsonValue
            ),
          }}
        />
      </div>
    </div>
  );
}

