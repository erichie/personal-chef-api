"use client";

import { useMemo, useState } from "react";

interface PublicRecipe {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  cuisine: string;
  publishedAt: string | null;
  excerpt: string | null;
}

interface PublicSection {
  id: string;
  name: string;
  description?: string | null;
  recipes: PublicRecipe[];
}

interface PublicCookbookProps {
  user: {
    displayName?: string | null;
    bio?: string | null;
  };
  sections: PublicSection[];
  ungrouped: PublicRecipe[];
}

function matchesQuery(value: string | null | undefined, query: string) {
  if (!value) return false;
  return value.toLowerCase().includes(query);
}

function RecipeCard({ recipe }: { recipe: PublicRecipe }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-pink-500">
        {recipe.publishedAt
          ? new Date(recipe.publishedAt).toLocaleDateString()
          : "Published"}
      </p>
      <h3 className="mt-1 text-xl font-semibold text-zinc-900">
        {recipe.title}
      </h3>
      <p className="mt-1 line-clamp-3 text-sm text-zinc-600">
        {recipe.description || recipe.excerpt || "No description provided."}
      </p>
      {recipe.slug && (
        <a
          href={`/recipes/${recipe.slug}`}
          className="mt-4 inline-flex items-center text-sm font-medium text-pink-600 hover:underline"
        >
          View recipe →
        </a>
      )}
    </article>
  );
}

export function PublicCookbookView({
  user,
  sections,
  ungrouped,
}: PublicCookbookProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!normalizedQuery) {
      return null;
    }

    const matches: PublicRecipe[] = [];

    sections.forEach((section) => {
      if (matchesQuery(section.name, normalizedQuery)) {
        matches.push(...section.recipes);
        return;
      }

      section.recipes.forEach((recipe) => {
        if (
          matchesQuery(recipe.title, normalizedQuery) ||
          matchesQuery(recipe.description, normalizedQuery) ||
          matchesQuery(recipe.excerpt, normalizedQuery)
        ) {
          matches.push(recipe);
        }
      });
    });

    ungrouped.forEach((recipe) => {
      if (
        matchesQuery(recipe.title, normalizedQuery) ||
        matchesQuery(recipe.description, normalizedQuery) ||
        matchesQuery(recipe.excerpt, normalizedQuery)
      ) {
        matches.push(recipe);
      }
    });

    const unique = new Map(matches.map((recipe) => [recipe.id, recipe]));

    return Array.from(unique.values());
  }, [normalizedQuery, sections, ungrouped]);

  return (
    <div className="space-y-8 rounded-3xl border border-zinc-200 bg-white p-10">
      <div className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-wide text-pink-500">
          Personal Chef Cookbook
        </p>
        <h1 className="text-4xl font-semibold text-zinc-900">
          {user.displayName || "Community cookbook"}
        </h1>
        {user.bio && (
          <p className="text-lg text-zinc-600">{user.bio}</p>
        )}
      </div>

      <div>
        <label className="text-xs uppercase text-zinc-500">Search</label>
        <input
          type="text"
          placeholder="Search sections or recipes..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-2 focus:border-pink-500 focus:outline-none"
        />
      </div>

      {searchResults ? (
        <div>
          <p className="text-sm text-zinc-500">
            {searchResults.length} recipe
            {searchResults.length === 1 ? "" : "s"} match your search
          </p>
          {searchResults.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center text-zinc-500">
              No results found.
            </div>
          ) : (
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {searchResults.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.id}
              className="space-y-3 rounded-2xl border border-zinc-200 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase text-zinc-500">Section</p>
                  <h2 className="text-2xl font-semibold text-zinc-900">
                    {section.name}
                  </h2>
                  {section.description && (
                    <p className="text-sm text-zinc-600">{section.description}</p>
                  )}
                </div>
              </div>
              {section.recipes.length === 0 ? (
                <p className="text-sm text-zinc-500">No published recipes yet.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {section.recipes.map((recipe) => (
                    <RecipeCard key={recipe.id} recipe={recipe} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {ungrouped.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-zinc-200 p-5">
              <div>
                <p className="text-xs uppercase text-zinc-500">Section</p>
                <h2 className="text-2xl font-semibold text-zinc-900">
                  Ungrouped
                </h2>
                <p className="text-sm text-zinc-600">
                  Recipes not yet assigned to a section.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {ungrouped.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

