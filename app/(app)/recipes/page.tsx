import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";
import { RecipeManager, RecipeListItem } from "@/components/recipes/recipe-manager";

async function fetchMyRecipes(userId: string): Promise<RecipeListItem[]> {
  const recipes = await prisma.recipe.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      publication: true,
    },
  });

  return recipes;
}

export default async function RecipesPage() {
  const session = await getServerSession();
  
  if (!session) {
    redirect("/login");
  }

  const recipes = await fetchMyRecipes(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Recipes
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Manage your recipes
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Publish your AI-generated and custom recipes to share them on your cookbook
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="rounded-full bg-pink-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-500"
        >
          + New recipe
        </Link>
      </div>

      <RecipeManager initialRecipes={recipes} />
    </div>
  );
}

