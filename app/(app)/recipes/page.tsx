import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { prisma } from "@/lib/prisma";
import { listCookbookSections } from "@/lib/cookbook-utils";
import {
  RecipeManager,
  RecipeListItem,
} from "@/components/recipes/recipe-manager";

async function fetchMyRecipes(userId: string): Promise<RecipeListItem[]> {
  const recipes = await prisma.recipe.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      publication: true,
      cookbookSectionEntries: {
        select: {
          sectionId: true,
        },
      },
    },
  });

  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    createdAt: recipe.createdAt.toISOString(),
    publication: recipe.publication
      ? {
          id: recipe.publication.id,
          slug: recipe.publication.slug,
          isPublished: recipe.publication.isPublished,
          publishedAt: recipe.publication.publishedAt?.toISOString() ?? null,
        }
      : null,
    sectionIds: recipe.cookbookSectionEntries.map((entry) => entry.sectionId),
  }));
}

export default async function RecipesPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const [recipes, sections] = await Promise.all([
    fetchMyRecipes(session.user.id),
    listCookbookSections(session.user.id),
  ]);

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
            Publish your AI-generated and custom recipes to share them on your
            cookbook
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="rounded-full bg-pink-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-500"
        >
          + New recipe
        </Link>
      </div>

      <RecipeManager
        initialRecipes={recipes}
        sections={sections.map((section) => ({
          id: section.id,
          name: section.name,
        }))}
      />
    </div>
  );
}

