"use client";

import { useState, FormEvent } from "react";

interface Props {
  initialSlug: string | null;
  shareUrl: string | null;
}

export function CookbookSettings({ initialSlug, shareUrl }: Props) {
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [currentShareUrl, setCurrentShareUrl] = useState(shareUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/me/cookbook", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slug: slug.trim().toLowerCase() }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload?.message || "Failed to update slug");
      setIsSubmitting(false);
      return;
    }

    setCurrentShareUrl(payload?.shareUrl ?? currentShareUrl);
    setSlug(payload?.cookbookSlug ?? slug);
    setStatus("Slug updated!");
    setIsSubmitting(false);
  }

  async function copyShareLink() {
    if (!currentShareUrl) return;
    await navigator.clipboard.writeText(currentShareUrl);
    setStatus("Link copied to clipboard");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-zinc-900">Cookbook settings</h3>
      <p className="text-sm text-zinc-500">
        Set a public slug for your cookbook. Only lowercase letters, numbers,
        and dashes are allowed.
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Slug
            </div>
            <div className="mt-1 flex rounded-xl border border-zinc-200">
              <span className="flex items-center px-3 text-sm text-zinc-500">
                cookbook/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(event) =>
                  setSlug(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())
                }
                className="flex-1 rounded-r-xl border-l border-zinc-200 px-3 py-2 text-sm focus:outline-none"
                placeholder="my-food-blog"
                required
                minLength={3}
                maxLength={64}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-pink-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save slug"}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 p-4">
        <p className="text-sm font-medium text-zinc-700">Share link</p>
        {currentShareUrl ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
              {currentShareUrl}
            </code>
            <button
              type="button"
              onClick={copyShareLink}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Copy link
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Set a slug to generate your share link.
          </p>
        )}
      </div>

      {status && <p className="mt-3 text-sm text-green-600">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

