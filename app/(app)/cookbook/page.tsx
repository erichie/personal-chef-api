import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { getCookbookForUser } from "@/lib/cookbook-utils";
import { getRequestBaseUrl } from "@/lib/request-helpers";
import { CookbookSettings } from "@/components/cookbook/cookbook-settings";
import { CookbookSectionsManager } from "@/components/cookbook/cookbook-sections-manager";

export default async function CookbookPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const [{ user, recipes, sections }] = await Promise.all([
    getCookbookForUser(session.user.id),
  ]);

  const baseUrl = await getRequestBaseUrl();
  const shareUrl = user.cookbookSlug
    ? `${baseUrl}/cookbook/${user.cookbookSlug}`
    : null;

  const published = recipes.filter((recipe) => recipe.publication?.isPublished);
  const drafts = recipes.filter((recipe) => !recipe.publication?.isPublished);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-8">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          My cookbook
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          {user.displayName || "Your cookbook"}
        </h1>
        {user.bio && (
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">{user.bio}</p>
        )}

        <div className="mt-6">
          <CookbookSettings initialSlug={user.cookbookSlug} shareUrl={shareUrl} />
        </div>
      </section>

      <CookbookSectionsManager
        sections={sections}
        recipes={recipes.map((recipe) => ({
          id: recipe.id,
          title: recipe.title,
        }))}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">Published</h2>
            <p className="text-sm text-zinc-500">
              These recipes are visible on your public cookbook page.
            </p>
          </div>
          <Link
            href="/recipes/new"
            className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-500"
          >
            + New recipe
          </Link>
        </div>

        {published.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
            Publish a recipe to make it appear here.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {published.map((recipe) => (
              <article
                key={recipe.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <p className="text-xs uppercase tracking-wide text-pink-500">
                  Live
                </p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                  {recipe.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-sm text-zinc-600">
                  {recipe.description || "No description provided."}
                </p>
                <Link
                  href={
                    recipe.publication?.slug
                      ? `/recipes/${recipe.publication.slug}`
                      : "/recipes"
                  }
                  className="mt-4 inline-flex items-center text-sm font-medium text-pink-600 hover:underline"
                >
                  View shared recipe →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900">Drafts</h2>
          <p className="text-sm text-zinc-500">
            Only you can see these. Publish them from the recipes manager.
          </p>
        </div>

        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
            No drafts yet. Start a new recipe to save it as a draft.
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6">
            {drafts.map((recipe) => (
              <div
                key={recipe.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {recipe.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Created {new Date(recipe.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href="/recipes"
                  className="text-sm font-medium text-pink-600 hover:underline"
                >
                  Publish from manager →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

