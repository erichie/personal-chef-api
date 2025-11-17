import { prisma } from "./prisma";
import { errors } from "./api-errors";

const MAX_SLUG_ATTEMPTS = 25;

export function slugifyCookbookSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

async function resolveUniqueCookbookSlug(baseSlug: string, userId?: string) {
  const slugBase = baseSlug || "cookbook";

  for (let i = 0; i < MAX_SLUG_ATTEMPTS; i++) {
    const attempt = i === 0 ? slugBase : `${slugBase}-${i + 1}`;
    const existing = await prisma.user.findFirst({
      where: {
        cookbookSlug: attempt,
        ...(userId ? { NOT: { id: userId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return attempt;
    }
  }

  throw new Error("Failed to generate unique cookbook slug");
}

export async function ensureCookbookSlug(userId: string, slugInput?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      email: true,
      friendCode: true,
      cookbookSlug: true,
    },
  });

  if (!user) {
    throw errors.notFound("User not found");
  }

  if (!slugInput && user.cookbookSlug) {
    return user;
  }

  const baseValue =
    slugInput ||
    user.displayName ||
    user.friendCode ||
    user.email ||
    "cookbook";

  const finalSlug = await resolveUniqueCookbookSlug(
    slugifyCookbookSlug(baseValue),
    slugInput ? user.id : undefined
  );

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { cookbookSlug: finalSlug },
    select: {
      id: true,
      cookbookSlug: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
    },
  });

  return updated;
}

export async function getPublicCookbookBySlug(slug: string) {
  const user = await prisma.user.findFirst({
    where: { cookbookSlug: slug },
    select: {
      id: true,
      cookbookSlug: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    throw errors.notFound("Cookbook not found");
  }

  const publications = await prisma.recipePublication.findMany({
    where: {
      authorId: user.id,
      isPublished: true,
    },
    include: {
      recipe: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
  });

  return { user, publications };
}

export async function getCookbookForUser(userId: string) {
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      cookbookSlug: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
    },
  });

  if (!userRecord) {
    throw errors.notFound("User not found");
  }

  let user = userRecord;

  if (!user.cookbookSlug) {
    const ensured = await ensureCookbookSlug(userId);
    user = {
      ...user,
      cookbookSlug: ensured.cookbookSlug ?? undefined,
      displayName: ensured.displayName ?? user.displayName,
      bio: ensured.bio ?? user.bio,
      avatarUrl: ensured.avatarUrl ?? user.avatarUrl,
    };
  }

  const recipes = await prisma.recipe.findMany({
    where: { userId },
    include: {
      publication: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return { user, recipes };
}

