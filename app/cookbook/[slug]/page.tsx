import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCookbookBySlug } from "@/lib/cookbook-utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const { user } = await getPublicCookbookBySlug(slug);
    return {
      title: `${user.displayName || "Cookbook"} | Personal Chef`,
      description:
        user.bio ||
        "Discover community recipes created and published on Personal Chef.",
    };
  } catch {
    return {
      title: "Cookbook not found",
    };
  }
}

export default async function PublicCookbookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  let data;
  try {
    const { slug } = await params;
    data = await getPublicCookbookBySlug(slug);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-4xl space-y-8 rounded-3xl border border-zinc-200 bg-white p-10">
        <div className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-wide text-pink-500">
            Personal Chef Cookbook
          </p>
          <h1 className="text-4xl font-semibold text-zinc-900">
            {data.user.displayName || "Community cookbook"}
          </h1>
          {data.user.bio && (
            <p className="text-lg text-zinc-600">{data.user.bio}</p>
          )}
        </div>

        {data.publications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-10 text-center text-zinc-500">
            No published recipes yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {data.publications.map((publication) => (
              <article
                key={publication.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <p className="text-xs uppercase tracking-wide text-pink-500">
                  {publication.publishedAt
                    ? new Date(publication.publishedAt).toLocaleDateString()
                    : "Published"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-900">
                  {publication.recipe.title}
                </h2>
                <p className="mt-1 line-clamp-3 text-sm text-zinc-600">
                  {publication.recipe.description || publication.excerpt}
                </p>
                <a
                  href={`/recipes/${publication.slug}`}
                  className="mt-4 inline-flex items-center text-sm font-medium text-pink-600 hover:underline"
                >
                  View recipe →
                </a>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

