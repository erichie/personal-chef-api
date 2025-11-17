"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DiscoverRecipe {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tags: unknown;
  userId: string;
  slug?: string | null;
  isPublished?: boolean | null;
  score?: number;
  ownerName?: string | null;
  ingredients?: unknown;
  steps?: unknown;
}

interface Props {
  recipe: DiscoverRecipe;
  isOwn: boolean;
}

function asList(items: unknown): string[] {
  if (Array.isArray(items)) {
    return items.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = item as any;
        return (
          obj.instruction ||
          obj.text ||
          obj.name ||
          obj.ingredient ||
          JSON.stringify(item)
        );
      }
      return String(item);
    });
  }
  return [];
}

export function DiscoverRecipeCard({ recipe, isOwn }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const ingredients = asList(recipe.ingredients);
  const steps = asList(recipe.steps);

  async function saveRecipe(publish: boolean) {
    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to save recipe");
      }

      setStatus(
        publish
          ? "Recipe published to your cookbook!"
          : "Recipe saved to your drafts."
      );
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setStatus(error.message);
      } else {
        setStatus("Failed to save recipe");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-pink-500">
        {recipe.ownerName ? `By ${recipe.ownerName}` : "Shared"}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-zinc-900">
        {recipe.title}
      </h3>
      <p className="mt-1 line-clamp-3 text-sm text-zinc-600">
        {recipe.description || "No description provided."}
      </p>
      <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
        <span>{recipe.score ?? 0} score</span>
        <button
          onClick={() => setIsOpen(true)}
          className="font-medium text-pink-600 hover:underline"
        >
          View
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-pink-500">
                  Discover recipe
                </p>
                <h2 className="text-3xl font-semibold text-zinc-900">
                  {recipe.title}
                </h2>
                <p className="text-sm text-zinc-500">
                  {recipe.ownerName ? `Shared by ${recipe.ownerName}` : ""}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-500"
              >
                Close
              </button>
            </div>

            {recipe.description && (
              <p className="mt-4 text-zinc-600">{recipe.description}</p>
            )}

            {ingredients.length > 0 && (
              <section className="mt-6">
                <h3 className="text-lg font-semibold text-zinc-900">
                  Ingredients
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600">
                  {ingredients.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {steps.length > 0 && (
              <section className="mt-6">
                <h3 className="text-lg font-semibold text-zinc-900">Steps</h3>
                <ol className="mt-2 space-y-2 text-sm text-zinc-600">
                  {steps.map((step, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="font-semibold text-pink-500">
                        {index + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {recipe.slug && (
                <Link
                  href={`/recipes/${recipe.slug}`}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  View public page
                </Link>
              )}
              {!isOwn && (
                <>
                  <button
                    onClick={() => saveRecipe(false)}
                    disabled={isSaving}
                    className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
                  >
                    Save as draft
                  </button>
                  <button
                    onClick={() => saveRecipe(true)}
                    disabled={isSaving}
                    className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:opacity-60"
                  >
                    Publish to my cookbook
                  </button>
                </>
              )}
              {isOwn && (
                <Link
                  href="/recipes"
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Manage in Recipes
                </Link>
              )}
            </div>

            {status && (
              <p className="mt-3 text-sm text-zinc-600">
                {status}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

