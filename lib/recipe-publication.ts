import { prisma } from "./prisma";
import { errors } from "./api-errors";
import { getRecipeVoteStatsWithUserVote } from "./recipe-utils";
import type { Prisma } from "@prisma/client";

const MAX_SLUG_ATTEMPTS = 25;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

async function resolveUniqueSlug(base: string, existingId?: string) {
  const baseSlug = base || "recipe";

  for (let i = 0; i < MAX_SLUG_ATTEMPTS; i++) {
    const attempt = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;

    const existing = await prisma.recipePublication.findFirst({
      where: {
        slug: attempt,
        ...(existingId ? { NOT: { id: existingId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return attempt;
    }
  }

  throw new Error("Failed to generate unique recipe slug");
}

export async function publishRecipe({
  recipeId,
  userId,
  slug,
  excerpt,
  shareImageUrl,
  seoTitle,
  seoDescription,
  metadata,
}: {
  recipeId: string;
  userId: string;
  slug?: string;
  excerpt?: string;
  shareImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  metadata?: Prisma.JsonValue;
}) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
  });

  if (!recipe) {
    throw errors.notFound("Recipe not found");
  }

  if (recipe.userId !== userId) {
    throw errors.forbidden("You do not own this recipe");
  }

  const existingPublication = await prisma.recipePublication.findUnique({
    where: { recipeId },
  });

  const finalSlug = await resolveUniqueSlug(
    slug ? slugify(slug) : slugify(recipe.title),
    existingPublication?.id
  );

  const now = new Date();

  return prisma.recipePublication.upsert({
    where: { recipeId },
    create: {
      recipeId,
      authorId: userId,
      slug: finalSlug,
      excerpt: excerpt ?? null,
      shareImageUrl: shareImageUrl ?? null,
      seoTitle: seoTitle ?? null,
      seoDescription: seoDescription ?? null,
      metadata: metadata ?? null,
      isPublished: true,
      publishedAt: now,
    },
    update: {
      slug: finalSlug,
      excerpt: excerpt ?? null,
      shareImageUrl: shareImageUrl ?? null,
      seoTitle: seoTitle ?? null,
      seoDescription: seoDescription ?? null,
      metadata: metadata ?? null,
      isPublished: true,
      publishedAt: existingPublication?.publishedAt ?? now,
      updatedAt: now,
    },
    include: {
      recipe: true,
    },
  });
}

export async function unpublishRecipe({
  recipeId,
  userId,
}: {
  recipeId: string;
  userId: string;
}) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { userId: true },
  });

  if (!recipe) {
    throw errors.notFound("Recipe not found");
  }

  if (recipe.userId !== userId) {
    throw errors.forbidden("You do not own this recipe");
  }

  return prisma.recipePublication.updateMany({
    where: { recipeId, authorId: userId },
    data: {
      isPublished: false,
    },
  });
}

export async function getPublicRecipeBySlug(slug: string, currentUserId?: string) {
  const publication = await prisma.recipePublication.findFirst({
    where: {
      slug,
      isPublished: true,
    },
    include: {
      recipe: true,
      author: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
  });

  if (!publication) {
    throw errors.notFound("Recipe not found");
  }

  const votes = await getRecipeVoteStatsWithUserVote(
    publication.recipeId,
    currentUserId ?? null
  );

  return {
    publication,
    recipe: publication.recipe,
    author: publication.author,
    votes,
  };
}

export async function listRecipePublicationsForUser(userId: string) {
  return prisma.recipePublication.findMany({
    where: {
      authorId: userId,
    },
    include: {
      recipe: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

