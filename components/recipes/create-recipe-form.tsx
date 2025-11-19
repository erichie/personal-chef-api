"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { IngredientJSON, StepJSON } from "@/lib/types";

const ingredientUnits = [
  "lb",
  "oz",
  "cup",
  "cups",
  "tbsp",
  "tsp",
  "can",
  "box",
  "bag",
  "package",
  "whole",
  "piece",
  "pieces",
  "slices",
  "cloves",
  "large",
  "quart",
];

const emptyIngredient = { name: "", qty: "", unit: "", notes: "" };

function parseList(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

interface IngredientRow {
  name: string;
  qty: string;
  unit: string;
  notes: string;
}

interface RecipeFormProps {
  mode: "create" | "edit";
  recipeId?: string;
  initialData?: {
    title: string;
    description?: string | null;
    ingredients?: IngredientJSON[];
    steps?: StepJSON[];
  };
}

export function RecipeForm({ mode, recipeId, initialData }: RecipeFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(() => {
    if (initialData?.ingredients && initialData.ingredients.length > 0) {
      return initialData.ingredients.map((ingredient) => ({
        name: ingredient.name || "",
        qty:
          ingredient.qty !== undefined && ingredient.qty !== null
            ? String(ingredient.qty)
            : "",
        unit: ingredient.unit || "",
        notes: ingredient.notes || "",
      }));
    }
    return [emptyIngredient];
  });
  const [structuredSteps, setStructuredSteps] = useState<string[]>(() => {
    if (initialData?.steps && initialData.steps.length > 0) {
      return initialData.steps
        .sort((a, b) => a.order - b.order)
        .map((step) => step.text);
    }
    return [""];
  });
  const [useStructuredSteps, setUseStructuredSteps] = useState(
    initialData?.steps && initialData.steps.length > 0
  );
  const [stepsTextarea, setStepsTextarea] = useState(() => {
    if (initialData?.steps && initialData.steps.length > 0) {
      return initialData.steps
        .sort((a, b) => a.order - b.order)
        .map((step) => step.text)
        .join("\n");
    }
    return "";
  });
  const [publish, setPublish] = useState(mode === "create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function addIngredient() {
    setIngredientRows((rows) => [...rows, { ...emptyIngredient }]);
  }

  function updateIngredient(
    index: number,
    field: keyof IngredientRow,
    value: string
  ) {
    setIngredientRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function removeIngredient(index: number) {
    setIngredientRows((rows) =>
      rows.length === 1 ? [emptyIngredient] : rows.filter((_, i) => i !== index)
    );
  }

  function addStructuredStep() {
    setStructuredSteps((prev) => [...prev, ""]);
  }

  function updateStructuredStep(index: number, value: string) {
    setStructuredSteps((prev) =>
      prev.map((step, i) => (i === index ? value : step))
    );
  }

  function removeStructuredStep(index: number) {
    setStructuredSteps((prev) =>
      prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)
    );
  }

  function handleStructuredToggle(checked: boolean) {
    if (checked && !useStructuredSteps) {
      const parsed = parseList(stepsTextarea);
      setStructuredSteps(parsed.length ? parsed : [""]);
    }
    if (!checked && useStructuredSteps) {
      setStepsTextarea(structuredSteps.join("\n"));
    }
    setUseStructuredSteps(checked);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const filteredIngredients = ingredientRows
      .map((row) => ({
        name: row.name.trim(),
        qty: row.qty.trim(),
        unit: row.unit.trim(),
        notes: row.notes.trim(),
      }))
      .filter((row) => row.name);

    const parsedIngredients: IngredientJSON[] = filteredIngredients.map(
      (row) => ({
        name: row.name,
        ...(row.qty
          ? isNaN(Number(row.qty))
            ? { qty: row.qty }
            : { qty: Number(row.qty) }
          : {}),
        ...(row.unit ? { unit: row.unit } : {}),
        ...(row.notes ? { notes: row.notes } : {}),
      })
    );

    const parsedSteps: StepJSON[] = useStructuredSteps
      ? structuredSteps
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text, index) => ({
            order: index + 1,
            text,
          }))
      : parseList(stepsTextarea).map((entry, index) => ({
          order: index + 1,
          text: entry,
        }));

    const payload = {
      title,
      description,
      source: "web",
      ...(mode === "create" ? { publish } : {}),
      ingredients: parsedIngredients,
      steps: parsedSteps,
    };

    const endpoint =
      mode === "create" ? "/api/recipes" : `/api/recipes/${recipeId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(
        data?.message ||
          (mode === "create"
            ? "Failed to create recipe"
            : "Failed to update recipe")
      );
      setIsSubmitting(false);
      return;
    }

    router.push("/recipes");
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Title
        </label>
        <input
          type="text"
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 focus:border-pink-500 focus:outline-none"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Description
        </label>
        <textarea
          className="w-full rounded-2xl border border-zinc-200 px-4 py-3 focus:border-pink-500 focus:outline-none"
          rows={3}
          value={description ?? ""}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700">
            Ingredients
          </label>
          <button
            type="button"
            onClick={addIngredient}
            className="text-sm font-medium text-pink-600 hover:underline"
          >
            + Add ingredient
          </button>
        </div>
        {ingredientRows.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-4"
          >
            <input
              type="text"
              placeholder="Ingredient name"
              value={row.name}
              onChange={(event) =>
                updateIngredient(index, "name", event.target.value)
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none sm:col-span-2"
              required={index === 0}
            />
            <input
              type="text"
              placeholder="Qty"
              value={row.qty}
              onChange={(event) =>
                updateIngredient(index, "qty", event.target.value)
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
            />
            <select
              value={row.unit}
              onChange={(event) =>
                updateIngredient(index, "unit", event.target.value)
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none bg-white"
            >
              <option value="">Unit</option>
              {ingredientUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Notes"
              value={row.notes}
              onChange={(event) =>
                updateIngredient(index, "notes", event.target.value)
              }
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none sm:col-span-4"
            />
            {ingredientRows.length > 1 && (
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="text-left text-sm text-red-500 hover:underline sm:col-span-4"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700">Steps</label>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={useStructuredSteps}
              onChange={(event) =>
                handleStructuredToggle(event.target.checked)
              }
              className="h-4 w-4 rounded border-zinc-300 text-pink-600 focus:ring-pink-500"
            />
            Structured mode
          </label>
        </div>
        {useStructuredSteps ? (
          <div className="space-y-3">
            {structuredSteps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3"
              >
                <span className="text-sm font-semibold text-pink-500">
                  {index + 1}.
                </span>
                <input
                  type="text"
                  value={step}
                  onChange={(event) =>
                    updateStructuredStep(index, event.target.value)
                  }
                  placeholder="Describe this step"
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                />
                {structuredSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStructuredStep(index)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addStructuredStep}
              className="text-sm font-medium text-pink-600 hover:underline"
            >
              + Add step
            </button>
          </div>
        ) : (
          <textarea
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 focus:border-pink-500 focus:outline-none"
            rows={6}
            placeholder="Rinse rice"
            value={stepsTextarea}
            onChange={(event) => setStepsTextarea(event.target.value)}
          />
        )}
      </div>

      {mode === "create" && (
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <input
            id="publish"
            type="checkbox"
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-pink-600 focus:ring-pink-500"
          />
          <label htmlFor="publish" className="text-sm text-zinc-600">
            Publish automatically after saving
          </label>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-pink-600 py-3 text-base font-semibold text-white transition hover:bg-pink-500 disabled:opacity-60"
      >
        {isSubmitting
          ? mode === "create"
            ? "Saving..."
            : "Updating..."
          : mode === "create"
          ? "Save recipe"
          : "Update recipe"}
      </button>
    </form>
  );
}

