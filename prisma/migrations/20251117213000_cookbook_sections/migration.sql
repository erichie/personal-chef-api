-- CreateTable
CREATE TABLE "CookbookSection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookbookSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookbookSectionRecipe" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookbookSectionRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CookbookSection_userId_name_key" ON "CookbookSection"("userId", "name");

-- CreateIndex
CREATE INDEX "CookbookSection_userId_idx" ON "CookbookSection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CookbookSectionRecipe_sectionId_recipeId_key" ON "CookbookSectionRecipe"("sectionId", "recipeId");

-- CreateIndex
CREATE INDEX "CookbookSectionRecipe_recipeId_idx" ON "CookbookSectionRecipe"("recipeId");

-- AddForeignKey
ALTER TABLE "CookbookSection" ADD CONSTRAINT "CookbookSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookbookSectionRecipe" ADD CONSTRAINT "CookbookSectionRecipe_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CookbookSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookbookSectionRecipe" ADD CONSTRAINT "CookbookSectionRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

