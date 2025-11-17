import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRequestBaseUrl } from "@/lib/request-helpers";

interface PublicRecipePayload {
  publication: {
    slug: string;
    excerpt: string | null;
    isPublished: boolean;
    publishedAt: string | null;
  };
  recipe: {
    title: string;
    description: string | null;
    imageUrl: string | null;
    ingredients: unknown;
    steps: unknown;
  };
  author: {
    displayName: string | null;
    bio: string | null;
  };
}

async function fetchRecipe(slug: string): Promise<PublicRecipePayload> {
  const baseUrl = await getRequestBaseUrl();
  const response = await fetch(`${baseUrl}/api/public/recipes/${slug}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("NOT_FOUND");
  }

  return response.json();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const payload = await fetchRecipe(slug);
    return {
      title: `${payload.recipe.title} | Personal Chef`,
      description:
        payload.publication.seoDescription ||
        payload.recipe.description ||
        "Shared on Personal Chef",
    };
  } catch {
    return {
      title: "Recipe not found",
    };
  }
}

function renderList(items: unknown): string[] {
  if (Array.isArray(items)) {
    return items.map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = item as any;
        // Try common field names for steps and ingredients
        return obj.instruction || obj.text || obj.name || obj.ingredient || String(item);
      }
      return String(item);
    });
  }
  return [];
}

export default async function PublicRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  let payload: PublicRecipePayload;
  try {
    const { slug } = await params;
    payload = await fetchRecipe(slug);
  } catch {
    notFound();
  }

  const ingredients = renderList(payload.recipe.ingredients);
  const steps = renderList(payload.recipe.steps);

  return (
    <div className="min-h-screen bg-zinc-50 py-10">
      <div className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-zinc-200 bg-white p-10">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-pink-500">
            Shared recipe
          </p>
          <h1 className="text-4xl font-semibold text-zinc-900">
            {payload.recipe.title}
          </h1>
          <p className="text-lg text-zinc-600">{payload.recipe.description}</p>
          <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            By {payload.author.displayName || "Personal Chef user"}
          </div>
        </div>

        {ingredients.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900">
              Ingredients
            </h2>
            <ul className="mt-3 space-y-2">
              {ingredients.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="rounded-2xl bg-zinc-50 px-4 py-2 text-sm text-zinc-600"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {steps.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold text-zinc-900">Steps</h2>
            <ol className="mt-3 space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="text-sm font-bold text-pink-500">
                    {index + 1}.
                  </span>
                  <p className="text-sm text-zinc-600">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

