"use client";

import { useState } from "react";

interface SectionRecipeInfo {
  recipeId: string;
}

interface SectionInfo {
  id: string;
  name: string;
  description?: string | null;
  recipes: SectionRecipeInfo[];
}

interface RecipeOption {
  id: string;
  title: string;
}

interface CookbookSectionsManagerProps {
  sections: SectionInfo[];
  recipes: RecipeOption[];
}

export function CookbookSectionsManager({
  sections,
  recipes,
}: CookbookSectionsManagerProps) {
  const [items, setItems] = useState(sections);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  async function createSection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setStatus(null);
    try {
      const response = await fetch("/api/cookbook/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to create section");
      }
      const { section } = await response.json();
      setItems((prev) => [...prev, { ...section, recipes: [] }]);
      setName("");
      setDescription("");
      setStatus("Section created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create section");
    } finally {
      setCreating(false);
    }
  }

  async function renameSection(
    sectionId: string,
    updates: { name?: string; description?: string }
  ) {
    try {
      const response = await fetch(`/api/cookbook/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to update section");
      }
      setItems((prev) =>
        prev.map((section) =>
          section.id === sectionId ? { ...section, ...updates } : section
        )
      );
      setStatus("Section updated");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update section");
    }
  }

  async function deleteSection(sectionId: string) {
    try {
      const response = await fetch(`/api/cookbook/sections/${sectionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to delete section");
      }
      setItems((prev) => prev.filter((section) => section.id !== sectionId));
      setStatus("Section deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to delete section");
    }
  }

  async function modifyRecipes(
    sectionId: string,
    recipeId: string,
    action: "add" | "remove"
  ) {
    try {
      const response = await fetch(
        `/api/cookbook/sections/${sectionId}/recipes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeIds: [recipeId], action }),
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || "Failed to update section recipes");
      }
      setItems((prev) =>
        prev.map((section) => {
          if (section.id !== sectionId) return section;
          if (action === "add") {
            if (section.recipes.find((entry) => entry.recipeId === recipeId)) {
              return section;
            }
            return {
              ...section,
              recipes: [...section.recipes, { recipeId }],
            };
          }
          return {
            ...section,
            recipes: section.recipes.filter((entry) => entry.recipeId !== recipeId),
          };
        })
      );
      setStatus("Section updated");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to update section recipes"
      );
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">
            Cookbook sections
          </h2>
          <p className="text-sm text-zinc-500">
            Organize your recipes into themed mini cookbooks.
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2"
        onSubmit={createSection}
      >
        <div className="sm:col-span-1">
          <label className="text-xs uppercase text-zinc-500">Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
            required
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-xs uppercase text-zinc-500">Description</label>
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:opacity-60"
          >
            {creating ? "Creating..." : "Add section"}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {items.map((section) => {
          const assignedIds = new Set(
            section.recipes.map((entry) => entry.recipeId)
          );
          const filterValue = filters[section.id]?.toLowerCase() ?? "";
          const availableRecipes = recipes.filter((recipe) => {
            if (assignedIds.has(recipe.id)) return false;
            if (!filterValue) return true;
            return recipe.title.toLowerCase().includes(filterValue);
          });

          return (
            <div
              key={section.id}
              className="space-y-3 rounded-2xl border border-zinc-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <input
                    type="text"
                    value={section.name}
                    onChange={(event) =>
                      setItems((prev) =>
                        prev.map((item) =>
                          item.id === section.id
                            ? { ...item, name: event.target.value }
                            : item
                        )
                      )
                    }
                    onBlur={(event) =>
                      renameSection(section.id, { name: event.target.value })
                    }
                    className="w-full rounded-xl border border-transparent px-2 text-lg font-semibold text-zinc-900 focus:border-pink-500 focus:outline-none"
                  />
                  <textarea
                    className="mt-1 w-full rounded-xl border border-transparent px-2 text-sm text-zinc-600 focus:border-pink-500 focus:outline-none"
                    value={section.description ?? ""}
                    onChange={(event) =>
                      setItems((prev) =>
                        prev.map((item) =>
                          item.id === section.id
                            ? { ...item, description: event.target.value }
                            : item
                        )
                      )
                    }
                    onBlur={(event) =>
                      renameSection(section.id, {
                        description: event.target.value,
                      })
                    }
                    placeholder="Add a short description"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => deleteSection(section.id)}
                  className="text-sm text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase text-zinc-500">
                  Assigned recipes
                </p>
                {section.recipes.length === 0 ? (
                  <p className="text-sm text-zinc-500">No recipes yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {section.recipes.map((entry) => {
                      const recipe = recipes.find((r) => r.id === entry.recipeId);
                      if (!recipe) return null;
                      return (
                        <span
                          key={recipe.id}
                          className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm"
                        >
                          {recipe.title}
                          <button
                            type="button"
                            onClick={() =>
                              modifyRecipes(section.id, recipe.id, "remove")
                            }
                            className="text-xs text-zinc-500 hover:text-red-500"
                          >
                            Remove
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {recipes.length > 0 && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search recipes..."
                    value={filters[section.id] ?? ""}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        [section.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  />
                  {availableRecipes.length > 0 ? (
                    <select
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                      defaultValue=""
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value) {
                          modifyRecipes(section.id, value, "add");
                          event.target.value = "";
                        }
                      }}
                    >
                      <option value="">Add recipe...</option>
                      {availableRecipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No recipes match this search.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {status && (
        <p className="text-sm text-zinc-500">
          {status}
        </p>
      )}
    </div>
  );
}

