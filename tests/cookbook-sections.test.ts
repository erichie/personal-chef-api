import { describe, it, expect } from "vitest";
import { formatCookbookSections } from "../lib/cookbook-utils";

describe("formatCookbookSections", () => {
  it("groups recipes by section and returns ungrouped recipes", () => {
    const publishedAt = new Date("2025-01-01T00:00:00Z");

    const sections = [
      {
        id: "section-1",
        name: "Weeknight winners",
        description: "Fast and fun",
        recipes: [
          {
            recipe: {
              id: "recipe-1",
              title: "Pasta",
              description: "Creamy pasta",
              imageUrl: null,
              tags: null,
              ingredients: [],
              steps: [],
              cuisine: "ITALIAN",
              publication: {
                slug: "pasta",
                publishedAt,
                excerpt: null,
                shareImageUrl: null,
                isPublished: true,
              },
            },
          },
          {
            recipe: {
              id: "recipe-2",
              title: "Draft soup",
              description: null,
              imageUrl: null,
              tags: null,
              ingredients: [],
              steps: [],
              cuisine: "OTHER",
              publication: null,
            },
          },
        ],
      },
    ];

    const publications = [
      {
        slug: "pasta",
        publishedAt,
        excerpt: null,
        shareImageUrl: null,
        recipe: {
          id: "recipe-1",
          title: "Pasta",
          description: "Creamy pasta",
          imageUrl: null,
          tags: null,
          ingredients: [],
          steps: [],
          cuisine: "ITALIAN",
        },
      },
      {
        slug: "salad",
        publishedAt,
        excerpt: null,
        shareImageUrl: null,
        recipe: {
          id: "recipe-3",
          title: "Salad",
          description: "Fresh greens",
          imageUrl: null,
          tags: null,
          ingredients: [],
          steps: [],
          cuisine: "OTHER",
        },
      },
    ];

    const result = formatCookbookSections(
      sections as never,
      publications as never
    );

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].recipes).toHaveLength(1);
    expect(result.sections[0].recipes[0].title).toBe("Pasta");
    expect(result.ungrouped).toHaveLength(1);
    expect(result.ungrouped[0].title).toBe("Salad");
  });
});

