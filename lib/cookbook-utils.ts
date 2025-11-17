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

type PublicationWithRecipe = {
  slug: string | null;
  publishedAt: Date | null;
  excerpt: string | null;
  shareImageUrl: string | null;
  isPublished?: boolean | null;
  recipe: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    tags: unknown;
    ingredients: unknown;
    steps: unknown;
    cuisine: string;
  };
};

type SectionWithRecipes = {
  id: string;
  name: string;
  description: string | null;
  recipes: Array<{
    recipe: {
      id: string;
      title: string;
      description: string | null;
      imageUrl: string | null;
      tags: unknown;
      ingredients: unknown;
      steps: unknown;
      cuisine: string;
      publication: PublicationWithRecipe | null;
    };
  }>;
};

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

  const sections = await prisma.cookbookSection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      recipes: {
        include: {
          recipe: {
            include: {
              publication: true,
            },
          },
        },
      },
    },
  });

  const publishedRecipes = await prisma.recipePublication.findMany({
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

  return { user, sections, publications: publishedRecipes };
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
      cookbookSectionEntries: {
        select: {
          sectionId: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const sections = await prisma.cookbookSection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      recipes: {
        select: {
          recipeId: true,
        },
      },
    },
  });

  return { user, recipes, sections };
}

export async function listCookbookSections(userId: string) {
  return prisma.cookbookSection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      recipes: {
        select: {
          recipeId: true,
        },
      },
    },
  });
}

export async function createCookbookSection(
  userId: string,
  input: { name: string; description?: string | null }
) {
  return prisma.cookbookSection.create({
    data: {
      userId,
      name: input.name.trim(),
      description: input.description || null,
    },
  });
}

export async function updateCookbookSection(
  userId: string,
  sectionId: string,
  input: { name?: string; description?: string | null }
) {
  const section = await prisma.cookbookSection.findUnique({
    where: { id: sectionId },
    select: { id: true, userId: true },
  });

  if (!section || section.userId !== userId) {
    throw errors.notFound("Section not found");
  }

  return prisma.cookbookSection.update({
    where: { id: sectionId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description || null }
        : {}),
    },
  });
}

export async function deleteCookbookSection(userId: string, sectionId: string) {
  const section = await prisma.cookbookSection.findUnique({
    where: { id: sectionId },
    select: { id: true, userId: true },
  });

  if (!section || section.userId !== userId) {
    throw errors.notFound("Section not found");
  }

  await prisma.cookbookSectionRecipe.deleteMany({
    where: { sectionId },
  });

  await prisma.cookbookSection.delete({
    where: { id: sectionId },
  });
}

export async function modifySectionRecipes(
  userId: string,
  sectionId: string,
  recipeIds: string[],
  action: "add" | "remove"
) {
  if (recipeIds.length === 0) {
    return;
  }

  const section = await prisma.cookbookSection.findUnique({
    where: { id: sectionId },
    select: { id: true, userId: true },
  });

  if (!section || section.userId !== userId) {
    throw errors.notFound("Section not found");
  }

  const recipes = await prisma.recipe.findMany({
    where: {
      id: { in: recipeIds },
      userId,
    },
    select: { id: true },
  });

  const validIds = recipes.map((r) => r.id);

  if (validIds.length === 0) {
    return;
  }

  if (action === "add") {
    await prisma.cookbookSectionRecipe.createMany({
      data: validIds.map((id) => ({
        sectionId,
        recipeId: id,
      })),
      skipDuplicates: true,
    });
  } else {
    await prisma.cookbookSectionRecipe.deleteMany({
      where: {
        sectionId,
        recipeId: { in: validIds },
      },
    });
  }
}

export function mapPublicationToRecipe(publication: PublicationWithRecipe) {
  return {
    id: publication.recipe.id,
    slug: publication.slug,
    publishedAt: publication.publishedAt,
    excerpt: publication.excerpt,
    shareImageUrl: publication.shareImageUrl,
    title: publication.recipe.title,
    description: publication.recipe.description,
    imageUrl: publication.recipe.imageUrl,
    tags: publication.recipe.tags,
    ingredients: publication.recipe.ingredients,
    steps: publication.recipe.steps,
    cuisine: publication.recipe.cuisine,
  };
}

export function formatCookbookSections(
  sections: SectionWithRecipes[],
  publications: PublicationWithRecipe[]
) {
  const sectionPayload = sections.map((section) => {
    const sectionRecipes = section.recipes
      .map((entry) => {
        const publication = entry.recipe.publication as
          | (PublicationWithRecipe & { isPublished?: boolean })
          | null;
        if (!publication || !publication.isPublished) {
          return null;
        }
        return mapPublicationToRecipe({
          slug: publication.slug,
          publishedAt: publication.publishedAt,
          excerpt: publication.excerpt,
          shareImageUrl: publication.shareImageUrl,
          recipe: {
            id: entry.recipe.id,
            title: entry.recipe.title,
            description: entry.recipe.description,
            imageUrl: entry.recipe.imageUrl,
            tags: entry.recipe.tags,
            ingredients: entry.recipe.ingredients,
            steps: entry.recipe.steps,
            cuisine: entry.recipe.cuisine,
          },
        });
      })
      .filter((item): item is ReturnType<typeof mapPublicationToRecipe> => !!item);

    return {
      id: section.id,
      name: section.name,
      description: section.description,
      recipes: sectionRecipes,
    };
  });

  const sectionRecipeIds = new Set(
    sectionPayload.flatMap((section) => section.recipes.map((recipe) => recipe.id))
  );

  const ungrouped = publications
    .filter((publication) => !sectionRecipeIds.has(publication.recipe.id))
    .map(mapPublicationToRecipe);

  return { sections: sectionPayload, ungrouped };
}

