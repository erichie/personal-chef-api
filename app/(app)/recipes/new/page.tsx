import Link from "next/link";
import { RecipeForm } from "@/components/recipes/create-recipe-form";

export default function NewRecipePage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            New recipe
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Add a fresh creation
          </h1>
          <p className="text-sm text-zinc-500">
            Fill in the basics and publish instantly to share with friends.
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
        <RecipeForm mode="create" />
      </div>
    </div>
  );
}

