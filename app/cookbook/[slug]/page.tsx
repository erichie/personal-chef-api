import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  formatCookbookSections,
  getPublicCookbookBySlug,
} from "@/lib/cookbook-utils";
import { PublicCookbookView } from "@/components/cookbook/public-cookbook";

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

  const { sections, ungrouped } = formatCookbookSections(
    data.sections,
    data.publications
  );

  const serializableSections = sections.map((section) => ({
    ...section,
    recipes: section.recipes.map((recipe) => ({
      ...recipe,
      publishedAt: recipe.publishedAt ? recipe.publishedAt.toString() : null,
    })),
  }));

  const serializableUngrouped = ungrouped.map((recipe) => ({
    ...recipe,
    publishedAt: recipe.publishedAt ? recipe.publishedAt.toString() : null,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 py-12">
      <div className="mx-auto max-w-4xl">
        <PublicCookbookView
          user={data.user}
          sections={serializableSections}
          ungrouped={serializableUngrouped}
        />
      </div>
    </div>
  );
}

