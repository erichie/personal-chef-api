-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'declined', 'blocked');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('pending', 'viewed', 'saved', 'declined');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('upvote', 'downvote');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "friendCode" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "cookbookSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chefIntake" JSONB,
    "inventory" JSONB,
    "mealPlans" JSONB,
    "groceryList" JSONB,
    "achievements" JSONB,
    "streaks" JSONB,
    "tokenState" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "servings" INTEGER,
    "totalMinutes" INTEGER,
    "cuisine" TEXT NOT NULL DEFAULT 'OTHER',
    "tags" JSONB,
    "ingredients" JSONB NOT NULL,
    "steps" JSONB,
    "embedding" vector(384),
    "embeddingVersion" INTEGER DEFAULT 1,
    "source" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipePublication" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "excerpt" TEXT,
    "shareImageUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipePost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "text" TEXT,
    "photoUrl" TEXT,
    "rating" INTEGER,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "postId" TEXT,
    "recipeId" TEXT,
    "mealPlanPostId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "days" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "text" TEXT,
    "photoUrl" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanShare" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" TEXT,
    "status" "ShareStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeShare" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "message" TEXT,
    "status" "ShareStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVote" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_cookbookSlug_key" ON "User"("cookbookSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");

-- CreateIndex
CREATE INDEX "Recipe_userId_createdAt_idx" ON "Recipe"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecipePublication_recipeId_key" ON "RecipePublication"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipePublication_slug_key" ON "RecipePublication"("slug");

-- CreateIndex
CREATE INDEX "RecipePublication_authorId_idx" ON "RecipePublication"("authorId");

-- CreateIndex
CREATE INDEX "RecipePublication_isPublished_publishedAt_idx" ON "RecipePublication"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "Friendship_userId_idx" ON "Friendship"("userId");

-- CreateIndex
CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

-- CreateIndex
CREATE INDEX "Friendship_status_idx" ON "Friendship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userId_friendId_key" ON "Friendship"("userId", "friendId");

-- CreateIndex
CREATE INDEX "RecipePost_userId_idx" ON "RecipePost"("userId");

-- CreateIndex
CREATE INDEX "RecipePost_recipeId_idx" ON "RecipePost"("recipeId");

-- CreateIndex
CREATE INDEX "RecipePost_createdAt_idx" ON "RecipePost"("createdAt");

-- CreateIndex
CREATE INDEX "PostLike_postId_idx" ON "PostLike"("postId");

-- CreateIndex
CREATE INDEX "PostLike_userId_idx" ON "PostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "PostComment_postId_idx" ON "PostComment"("postId");

-- CreateIndex
CREATE INDEX "PostComment_userId_idx" ON "PostComment"("userId");

-- CreateIndex
CREATE INDEX "PostComment_createdAt_idx" ON "PostComment"("createdAt");

-- CreateIndex
CREATE INDEX "FeedActivity_userId_idx" ON "FeedActivity"("userId");

-- CreateIndex
CREATE INDEX "FeedActivity_createdAt_idx" ON "FeedActivity"("createdAt");

-- CreateIndex
CREATE INDEX "FeedActivity_activityType_idx" ON "FeedActivity"("activityType");

-- CreateIndex
CREATE INDEX "RecipeUsage_userId_usedAt_idx" ON "RecipeUsage"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "RecipeUsage_recipeId_usedAt_idx" ON "RecipeUsage"("recipeId", "usedAt");

-- CreateIndex
CREATE INDEX "RecipeUsage_userId_recipeId_usedAt_idx" ON "RecipeUsage"("userId", "recipeId", "usedAt");

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_endpoint_idx" ON "AiUsage"("endpoint");

-- CreateIndex
CREATE INDEX "AiUsage_userId_endpoint_createdAt_idx" ON "AiUsage"("userId", "endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "MealPlan_userId_idx" ON "MealPlan"("userId");

-- CreateIndex
CREATE INDEX "MealPlan_userId_createdAt_idx" ON "MealPlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MealPlanPost_userId_idx" ON "MealPlanPost"("userId");

-- CreateIndex
CREATE INDEX "MealPlanPost_mealPlanId_idx" ON "MealPlanPost"("mealPlanId");

-- CreateIndex
CREATE INDEX "MealPlanPost_createdAt_idx" ON "MealPlanPost"("createdAt");

-- CreateIndex
CREATE INDEX "MealPlanPostLike_postId_idx" ON "MealPlanPostLike"("postId");

-- CreateIndex
CREATE INDEX "MealPlanPostLike_userId_idx" ON "MealPlanPostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanPostLike_postId_userId_key" ON "MealPlanPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "MealPlanPostComment_postId_idx" ON "MealPlanPostComment"("postId");

-- CreateIndex
CREATE INDEX "MealPlanPostComment_userId_idx" ON "MealPlanPostComment"("userId");

-- CreateIndex
CREATE INDEX "MealPlanPostComment_createdAt_idx" ON "MealPlanPostComment"("createdAt");

-- CreateIndex
CREATE INDEX "MealPlanShare_senderId_idx" ON "MealPlanShare"("senderId");

-- CreateIndex
CREATE INDEX "MealPlanShare_recipientId_idx" ON "MealPlanShare"("recipientId");

-- CreateIndex
CREATE INDEX "MealPlanShare_mealPlanId_idx" ON "MealPlanShare"("mealPlanId");

-- CreateIndex
CREATE INDEX "MealPlanShare_recipientId_status_idx" ON "MealPlanShare"("recipientId", "status");

-- CreateIndex
CREATE INDEX "RecipeShare_senderId_idx" ON "RecipeShare"("senderId");

-- CreateIndex
CREATE INDEX "RecipeShare_recipientId_idx" ON "RecipeShare"("recipientId");

-- CreateIndex
CREATE INDEX "RecipeShare_recipeId_idx" ON "RecipeShare"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeShare_recipientId_status_idx" ON "RecipeShare"("recipientId", "status");

-- CreateIndex
CREATE INDEX "RecipeVote_recipeId_idx" ON "RecipeVote"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeVote_userId_idx" ON "RecipeVote"("userId");

-- CreateIndex
CREATE INDEX "RecipeVote_voteType_idx" ON "RecipeVote"("voteType");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVote_recipeId_userId_key" ON "RecipeVote"("recipeId", "userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipePublication" ADD CONSTRAINT "RecipePublication_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipePublication" ADD CONSTRAINT "RecipePublication_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipePost" ADD CONSTRAINT "RecipePost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipePost" ADD CONSTRAINT "RecipePost_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "RecipePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "RecipePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedActivity" ADD CONSTRAINT "FeedActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeUsage" ADD CONSTRAINT "RecipeUsage_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPost" ADD CONSTRAINT "MealPlanPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPost" ADD CONSTRAINT "MealPlanPost_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPostLike" ADD CONSTRAINT "MealPlanPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MealPlanPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPostLike" ADD CONSTRAINT "MealPlanPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPostComment" ADD CONSTRAINT "MealPlanPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MealPlanPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPostComment" ADD CONSTRAINT "MealPlanPostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanShare" ADD CONSTRAINT "MealPlanShare_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanShare" ADD CONSTRAINT "MealPlanShare_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanShare" ADD CONSTRAINT "MealPlanShare_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVote" ADD CONSTRAINT "RecipeVote_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVote" ADD CONSTRAINT "RecipeVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
