"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RecipePublication {
  id: string;
  slug: string | null;
  isPublished: boolean;
  publishedAt: string | null;
}

export interface RecipeListItem {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  publication?: RecipePublication | null;
}

interface Props {
  initialRecipes: RecipeListItem[];
}

export function RecipeManager({ initialRecipes }: Props) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const publishedCount = useMemo(
    () => recipes.filter((recipe) => recipe.publication?.isPublished).length,
    [recipes]
  );

  async function publishRecipe(recipeId: string) {
    setActiveRecipeId(recipeId);
    setError(null);

    const response = await fetch(`/api/recipes/${recipeId}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.message || "Failed to publish recipe");
      setActiveRecipeId(null);
      return;
    }

    const payload = await response.json();
    setRecipes((prev) =>
      prev.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              publication: {
                id: payload.publication.id,
                slug: payload.publication.slug,
                isPublished: payload.publication.isPublished,
                publishedAt: payload.publication.publishedAt,
              },
            }
          : recipe
      )
    );
    setActiveRecipeId(null);
    router.refresh();
  }

  async function unpublishRecipe(recipeId: string) {
    setActiveRecipeId(recipeId);
    setError(null);

    const response = await fetch(`/api/recipes/${recipeId}/publish`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload?.message || "Failed to unpublish recipe");
      setActiveRecipeId(null);
      return;
    }

    setRecipes((prev) =>
      prev.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              publication: recipe.publication
                ? { ...recipe.publication, isPublished: false }
                : null,
            }
          : recipe
      )
    );
    setActiveRecipeId(null);
    router.refresh();
  }

  function copyShareLink(slug: string | null | undefined) {
    if (!slug) return;
    const shareUrl = `${window.location.origin}/recipes/${slug}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {
      setError("Failed to copy link");
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-sm text-zinc-500">Published recipes</p>
        <p className="text-3xl font-semibold text-zinc-900">{publishedCount}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {recipes.map((recipe) => {
          const isPublished = recipe.publication?.isPublished;

          return (
            <div
              key={recipe.id}
              className="rounded-2xl border border-zinc-200 bg-white p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {new Date(recipe.createdAt).toLocaleDateString()}
                  </p>
                  <h3 className="text-xl font-semibold text-zinc-900">
                    {recipe.title}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {recipe.description || "No description yet."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/recipes/manage/${recipe.id}/edit`}
                    className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => copyShareLink(recipe.publication?.slug || null)}
                    disabled={!isPublished}
                    className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
                  >
                    Copy link
                  </button>
                  {isPublished ? (
                    <button
                      onClick={() => unpublishRecipe(recipe.id)}
                      disabled={activeRecipeId === recipe.id}
                      className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
                    >
                      {activeRecipeId === recipe.id
                        ? "Unpublishing..."
                        : "Unpublish"}
                    </button>
                  ) : (
                    <button
                      onClick={() => publishRecipe(recipe.id)}
                      disabled={activeRecipeId === recipe.id}
                      className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:opacity-60"
                    >
                      {activeRecipeId === recipe.id ? "Publishing..." : "Publish"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {recipes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
            You haven&apos;t added any recipes yet. Head to the New Recipe page to
            get started.
          </div>
        )}
      </div>
    </div>
  );
}

