import Link from "next/link";
import { getRequestBaseUrl } from "@/lib/request-helpers";
import { getServerSession } from "@/lib/server-session";
import { DiscoverRecipeCard } from "@/components/discover/discover-recipe-card";

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
}

async function fetchDiscoverRecipes(): Promise<DiscoverRecipe[]> {
  const baseUrl = await getRequestBaseUrl();
  const response = await fetch(`${baseUrl}/api/recipes/discover?count=6`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  return payload.recipes ?? [];
}

export default async function DashboardPage() {
  const session = await getServerSession();
  const recipes = await fetchDiscoverRecipes();
  const currentUserId = session?.user.id;

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 p-8 text-white">
        <p className="text-sm uppercase tracking-widest text-white/80">
          Create
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold">
              Build new recipes straight from the browser.
            </h1>
            <p className="mt-2 max-w-2xl text-lg text-white/80">
              Recipes you add here sync to your BetterAuth account so they show
              up on mobile and in discovery.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/recipes/new"
              className="rounded-full bg-white px-6 py-3 text-base font-semibold text-pink-600 transition hover:bg-white/90"
            >
              + New Recipe
            </Link>
            <Link
              href="/cookbook"
              className="rounded-full border border-white/60 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              View my cookbook
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">
              Discover Recipes
            </h2>
            <p className="text-sm text-zinc-500">
              Browse recently shared dishes from the community and publish the
              ones you like.
            </p>
          </div>
          <Link
            href="/recipes"
            className="text-sm font-medium text-pink-600 hover:underline"
          >
            Manage your recipes →
          </Link>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <DiscoverRecipeCard
              key={recipe.id}
              recipe={recipe}
              isOwn={recipe.userId === currentUserId}
            />
          ))}
          {recipes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-zinc-500">
              No recipes to discover yet. Invite friends or publish one of your
              creations!
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
